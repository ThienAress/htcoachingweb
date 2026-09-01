# Plan 074: Harden P1 security và thêm công cụ vận hành HLV

> **Hướng dẫn thực thi**: Follow từng step và chạy focused verification trước khi chuyển step.
> Không chạy migration/production write, không commit/push. Nếu code in-scope bị task khác sửa trong
> lúc thực thi, dừng file đó và reconcile trước khi ghi tiếp.
>
> **Drift check**: `git status --short --branch`, `git diff --stat`, rồi đối chiếu các current-state
> marker bên dưới trước mỗi workstream.

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH
- **Depends on**: 019, 020, 033, 066
- **Category**: security | data | feature | tests
- **Planned at**: 2026-08-28
- **Execution**: DONE / NODE 22 LOCAL FULL — migrations chưa chạy

## Why this matters

Các finding hiện tại cho phép public media nhạy cảm, mass assignment và truy cập chéo HLV, đồng
thời upload có thể giữ nhiều buffer lớn trong RAM. Hai công cụ mới giúp HLV tự hiểu email workflow
mà không làm bẩn dữ liệu, và giúp Admin chuyển assignment có preview/audit thay vì chỉnh rời rạc.

## Current state

- `server/src/controllers/f1Customer/intake.controller.js:37-62` spread `req.body.data` vào update draft.
- `server/src/controllers/coaching.controller.js:389-403` xóa theo user/date nhưng thiếu trainer filter.
- `server/src/controllers/workoutPlan.controller.js:113-184` tạo/đổi client chỉ theo email.
- `server/src/middlewares/coachingUpload.js:20` dùng `multer.memoryStorage()` với file 25 MB.
- `server/src/routes/coaching.routes.js:41` parse file trước khi controller kiểm ownership.
- `server/src/controllers/user.controller.js:50` có deletion inventory chưa đầy đủ.
- `server/src/constants/serviceAccessPolicies.js:74` là nguồn canonical cho service quota.
- `server/src/models/Order.js:58`, `TrainingSchedule.js:5`, `WorkoutPlan.js:40`,
  `CoachingDay.js:10`, `Contract.js:38` có trainer assignment độc lập cần policy chuyển rõ ràng.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Focused server | `npm test --prefix server -- <test-file>` | exit 0 |
| Client unit | `npm run test:unit:client` | exit 0 |
| Server unit | `npm run test:unit:server` | exit 0 |
| Client compile | `npm run build --prefix client` | exit 0 |
| Security | `npm run security:secrets` | exit 0 |
| Boundaries | `npm run security:data-boundaries` | exit 0 |
| Instructions | `npm run agents:validate` | exit 0 |

## Scope

**In scope**: six P1 surfaces, their direct consumers/tests, practice center, admin trainer coordination,
additive schemas/indexes, docs and dry-run migration script.

**Out of scope**: P0 credentials, production/staging writes, payment/wallet mutation, F1 CRM transfer,
signed-contract rewrite, broad UI refactor, `TrainerManagement.old.jsx`, `client/src/utils/api.js`.

## Steps

### Step 1: Block mass assignment và cross-owner mutations

Add step-root allowlist + validators cho F1 draft; ràng buộc trainer trong atomic CoachingDay delete;
enforce approved Order cho create/reassign/publish/duplicate WorkoutPlan.

**Behavior**: payload protected/cross-trainer/arbitrary email bị chặn; valid flow giữ response hiện tại.

**Verify**: focused server integration tests cho ba scenario và negative boundaries.

### Step 2: Private hóa và stream feedback video

Mở route có `dateString/exerciseId`, kiểm ownership trước upload, stream authenticated Cloudinary asset,
lưu metadata ổn định và serialize signed URL sau authorization. Route upload cũ trả deprecation response
không parse body. Tạo dry-run migration idempotent cho record public cũ nhưng không chạy.

**Behavior**: video mới private, 25 MB vẫn được phép, buffer không nằm trong app memory và signed URL
không bị autosave ngược vào DB.

**Verify**: middleware/order integration tests, storage adapter unit tests, client service/page tests.

### Step 3: Hoàn thiện account deletion privacy inventory

Tách canonical service, xóa personal/health/content collections trong transaction, giữ hoặc pseudonymize
financial/legal records theo explicit policy và enqueue external media cleanup retry-safe.

**Behavior**: user deletion không để orphan cá nhân đã liệt kê và không phá immutable financial/legal history.

**Verify**: integration inventory test với fixture trên từng collection in-scope.

### Step 4: Cung cấp Trung tâm thực hành

Thêm policy quota canonical, atomic ledger consume/refund, practice mail renderer/delivery contract,
protected route và page lazy-loaded cho Admin/HLV. Không tạo domain records.

**Behavior**: gửi đúng email đăng nhập; HLV 2/Admin 10 lượt rolling 24h; journey consume 2; failure refund.

**Verify**: registry/service/API integration tests và client state tests.

### Step 5: Cung cấp Admin Điều phối HLV

Thêm read model Orders 30 ngày, preview transfer, capacity resolver, transactional command, append-only audit,
admin route và page hai tab.

**Behavior**: Admin preview rồi transfer đúng collection policy; conflict/idempotency/capacity fail closed;
trainer/user nhận 403 và không thấy navigation.

**Verify**: service/API integration tests, route authorization và client tests.

### Step 6: Re-trace, QA, review và cleanup

Re-run dependency searches, inspect full diff, chạy focused/full gates tương xứng và rà UI desktop/mobile nếu
dev environment sẵn sàng. Không dùng kết quả trước khi diff cuối ổn định.

**Verify**: `git diff --check`, client lint/build/tests, server tests, security scans, agents validator,
UI regression gate; E2E chỉ PASS khi dev servers/test data đáp ứng, nếu không ghi SKIP có lý do.

## Test plan

- Regression: F1 protected fields, cross-trainer CoachingDay delete, WorkoutPlan relationship.
- Upload: ownership-before-parser, stream/no-buffer, authenticated storage, legacy compatibility/remove action.
- Privacy: personal collection deletion + financial/legal retention + media cleanup retry metadata.
- Practice: recipient, entitlement, role limits, multi-unit quota, refund, CSRF/429 metadata, zero domain writes.
- Transfer: 30-day pagination, preview summary, capacity, stale conflict, idempotency, transaction rollback,
  correct moved/retained collections and admin-only authorization.

## Done criteria

- [x] Sáu P1 có regression test và bounded fix.
- [x] Hai page mới lazy-loaded, service-layered và backend-authorized.
- [x] Additive schemas tương thích document cũ; migration không được chạy.
- [x] Không có debug log/unused import/hardcoded secret do task tạo.
- [x] Focused tests, compile/build và security gates được báo bằng evidence thật.
- [x] `docs/plans/README.md` phản ánh trạng thái cuối.

## Implementation evidence

- Feedback video mới stream vào authenticated storage, ownership-before-parser, signed URL không
  persist và cleanup dùng durable Mongo outbox.
- F1 draft dùng step/root/nested allowlist + validators; consent failure không để lại draft PII mới.
- CoachingDay delete giữ trainer ownership; WorkoutPlan create/reassign/publish/duplicate và client
  detail bị ràng buộc approved Order/status.
- Account deletion inventory có F1 linkage fail-closed, retry worker và explicit retained-data boundary.
- Operational `AuditLog`/`TrainerTransfer` được đếm và giữ append-only chờ policy pseudonymization;
  `TrainerTransferLock` tạm được xóa để không tạo orphan khi tài khoản bị xóa.
- Trung tâm thực hành gửi đúng email đăng nhập, per-delivery quota/idempotency, HLV 2/Admin 10.
- Điều phối HLV có Orders 30 ngày, preview/capacity/schedule overlap/stale token/transaction/audit;
  F1 và signed contracts chỉ cảnh báo/giữ nguyên.
- Release prerequisite: apply `20260828-security-operations-indexes.js`; coaching legacy media script
  tiếp tục read-only. Hai migration chưa được chạy trong task.
- Hai production service mới vượt mốc khuyến nghị 300 dòng có chủ đích:
  `coachingPrivateMedia.service.js` giữ cùng một trust boundary cho allowlist/provider/serialization/deletion;
  `practiceCenter.service.js` giữ nguyên state machine claim/quota/refund/idempotency. UI đã được tách để mọi
  component mới dưới 300 dòng; test integration dài hơn 300 dòng vì bao phủ failure matrix xuyên transaction.

## Local verification evidence

- HEAD khi QA: `5e437b063f9b1e66bfe0d093f0349693f7e0b9bc`; working tree dirty trong đúng phạm vi
  audit/feature và `debug.log` có sẵn. Không có thay đổi ở 5 file hotfix bị khóa.
- Client unit: 132 files / 596 tests pass. Server sharded suite: shard 1 `68/335`, shard 2
  `68/397`, shard 3 `67/382` đều pass; focused email catalog cuối: 2 files / 12 tests pass.
- Focused account-deletion retention regression sau review chéo: 1 file / 10 tests pass.
- Client lint pass; Vite compile-only pass (2.930 modules); secret scan, repository data-boundary scan,
  agent validator và `git diff --check` pass.
- UI regression gate pass với 0 finding mới, 12 finding baseline được giải quyết.
- Release build không được tính PASS: Vite compile xong nhưng postbuild bị chặn do sandbox thiếu
  `VITE_API_URL`, network bị từ chối và prerender cố xử lý 1.412 cached routes.
- E2E chưa chạy vì không có dev server/auth test data phù hợp. Không chạy migration, staging/production write,
  commit, push hoặc deploy.

## STOP conditions

- Cần production/staging mutation hoặc rotate credential để tiếp tục.
- Cần xóa/đổi retention financial/legal data mà spec hiện tại không chứng minh.
- Cần sửa `client/src/utils/api.js`, auth/CSRF/JWT flow hoặc nâng quota ngoài contract.
- File ownership chồng lấn với task khác và không thể reconcile an toàn.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance notes

- Signed URL là delivery artifact ngắn hạn, không phải persistence field.
- Practice quota phải tiếp tục đọc registry; không hardcode limit ở controller/UI.
- Transfer policy cần mở rộng explicit trước khi thêm F1 CRM hoặc signed-contract reassignment.
- P0 credential rotation là runbook riêng sau khi database user mới được test và cutover an toàn.
