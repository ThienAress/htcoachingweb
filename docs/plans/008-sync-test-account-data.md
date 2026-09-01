# Plan 008: Đồng bộ đầy đủ tài khoản test vào local và staging

> **Hướng dẫn thực thi**: Production chỉ được đọc đúng tài khoản
> tài khoản test đồng bộ đã được operator xác nhận (email cụ thể không lưu trong repository). Mọi ghi dữ liệu chỉ được phép vào database local
> `htcoaching_local` và staging `htcoaching_staging`. Không lưu document hoặc URI database vào repository.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: HIGH — thao tác dữ liệu xuyên môi trường
- **Depends on**: 007
- **Category**: migration / bug
- **Planned at**: 2026-07-29
- **Execution**: DEPLOYED / VERIFIED ON STAGING

## Why This Matters

Snapshot trước chưa chứng minh đã được ghi vào đúng database mà backend local đang đọc, nên Customer
Dashboard của tài khoản test vẫn trống. Cần truy vết toàn bộ graph document của đúng user, upsert giữ
nguyên `_id` và foreign keys vào hai target đã khóa, sau đó xác minh bằng count và runtime local.

## Current State

- `server/src/config/db.js` kết nối bằng `MONGO_URI`; database runtime phụ thuộc config Doppler dùng khi start backend.
- Database local bắt buộc: `htcoaching_local` trên MongoDB localhost.
- Database staging bắt buộc: `htcoaching_staging`.
- Production là source read-only; không được update, seed, cleanup hoặc scan dữ liệu ngoài graph của exact email.
- Worktree có thay đổi UI chưa commit trong `TodayDashboard.jsx` và `TodayDashboardDayLayout.jsx`; phải giữ nguyên.

## Scope

**In scope**:

- `server/src/scripts/syncTestAccountData.js` — script one-shot có dry-run, target guard và verify counts.
- `server/package.json` — command chạy script nếu cần.
- `server/src/services/todayDashboard.service.js` — giữ trạng thái chưa phân công nhưng cho phép đọc nguồn canonical.
- `server/src/controllers/__tests__/todayDashboard.integration.test.js` — regression cho approved legacy order chưa có trainer.
- `docs/plans/008-sync-test-account-data.md` và `docs/plans/README.md` — kế hoạch/evidence không chứa PII ngoài email test đã được owner chỉ định.
- Dữ liệu liên quan trực tiếp đến exact test user trong production, local và staging.

**Out of scope**:

- Không thay đổi schema hoặc UI Dashboard; contract chỉ nới quyền đọc cho approved legacy order của chính owner.
- Không ghi production và không copy user khác.
- Không lưu snapshot/export production trên filesystem hoặc Git.
- Không xóa dữ liệu target không thuộc exact test user.

## Steps

### Step 1: Reproduce và định vị DB runtime

Xác định tên database từ config `dev_personal`, process backend local và đếm document hiện có của exact
email trong local/staging/production mà không in URI hoặc raw document.

**Verify**: output chỉ gồm environment, database name, user id đã rút gọn và collection counts.

### Step 2: Xây graph dữ liệu và script sync có guard

Khám phá các collection liên quan qua `_id`, email và các reference tới tập ID đã tìm thấy; lặp đến khi
graph ổn định. Script phải khóa source/target database, giữ BSON types, upsert bằng `_id`, hỗ trợ dry-run
và không log raw PII/secret.

**Verify**: dry-run production → local và production → staging không thực hiện write, chỉ báo counts.

### Step 3: Upsert local và staging

Chạy sync riêng từng target. Mọi write dùng `replaceOne({ _id }, document, { upsert: true })`; production
connection chỉ được dùng cho query.

**Verify**: source/target có cùng `_id` và fingerprint cho từng document được đồng bộ.

### Step 4: Xác minh runtime Dashboard

Đảm bảo backend local dùng `htcoaching_local`, restart đúng config nếu cần, sau đó kiểm tra readiness và
Dashboard endpoints/session khi khả thi.

**Verify**: backend readiness trả 200; DB runtime là `htcoaching_local`; các source Dashboard có trong
production phải xuất hiện ở target với count/fingerprint khớp.

## Test Plan

- Test guard từ chối source không phải production và target ngoài hai database cho phép.
- Test graph traversal trên fixture có reference nhiều tầng và không kéo user không liên quan.
- Chạy `npm run test:unit:server` nếu script dùng module có unit test.
- Chạy repository boundary/secret scan để bảo đảm không lưu export hoặc credential.

## Done Criteria

- [ ] Exact user tồn tại trong `htcoaching_local` và `htcoaching_staging` với cùng `_id` như production.
- [ ] Toàn bộ graph document tìm được có count, `_id` và fingerprint khớp source ở cả hai target.
- [ ] Backend local được chứng minh đang đọc `htcoaching_local` và readiness 200.
- [ ] Production không có write; không có raw export/secret trong repository hoặc output bàn giao.
- [ ] UI changes có sẵn không bị sửa hoặc mất.
- [ ] `docs/plans/README.md` được cập nhật trạng thái cuối.

## STOP Conditions

- Source config không thể chứng minh là production hoặc target database không đúng tên đã khóa.
- Exact email match nhiều hơn một User trong source.
- Sync cần xóa document, đổi `_id`, schema hoặc ghi production.
- Không thể xác định quan hệ ownership mà không có nguy cơ copy dữ liệu user khác.

## Maintenance Notes

- Đây là công cụ one-shot cho account test đã chỉ định, không phải pipeline replicate production định kỳ.
- Nếu thêm model Dashboard mới, phải bổ sung reference traversal/fixture trước khi tái sử dụng.

## Execution Evidence

- Root cause: snapshot đã có đủ dữ liệu trong `htcoaching_local`; Dashboard che nguồn vì approved
  legacy order còn 48 buổi nhưng chưa có `trainerId`, dẫn tới `assignment_required` và
  `canViewSources=false`.
- Data graph đã upsert idempotent từ snapshot local sang `htcoaching_staging`: 15 documents trong
  9 collections; 15/15 BSON fingerprints khớp sau write.
- Local runtime: port 5000 kết nối MongoDB localhost và readiness trả HTTP 200.
- API localhost cho ngày `2026-07-06`: HTTP 200, `assignment_required`,
  `canViewSources=true`, coaching source `ready`.
- Mốc dữ liệu test: Coaching Day ở `2026-05-28`, `2026-05-29`, `2026-07-06`;
  Check-in ở `2026-07-21`.
- Quyền ghi vẫn khóa: `canEditJournal=false`, `canSubmitDay=false`, `canComment=false`.
- Regression RED xác nhận lỗi tại `canViewSources=false`; GREEN: targeted 9/9, full server 329/329,
  client 167/167, build 87/87 prerender và bundle budget pass.
- Security/deploy gates: dependency audits, secret scan, repository data boundaries, commercial
  contract gate và `git diff --check` pass. UI/SEO gate không áp dụng cho release backend-only.
- Live production không được query lại trong lượt này vì Render/browser access bị policy chặn; nguồn
  write là snapshot account đã kéo về trước đó theo xác nhận của owner. Production writes: zero.
- Runtime release `40998036f60f120871125651d2b3221c992d92e4` được push lên `staging`.
- Render staging deploy `dep-d9ku96rl550s73afc5p0` đạt `live` đúng runtime release.
- GitHub CI run `30447906475` hoàn tất `success`: server, client, secrets và E2E đều xanh.
- Staging Health and Security run `30447906489` hoàn tất `success`.
- Remote authenticated API của account test tại ngày `2026-07-06` trả HTTP 200,
  `canViewSources=true` và coaching source `ready`.
