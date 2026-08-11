# Plan 043: Đồng bộ catalog test công khai vào local và staging

> **Hướng dẫn thực thi**: production chỉ là nguồn `GET` công khai. Mọi mutation phải bị khóa vào
> `htcoaching_local` hoặc `htcoaching_staging`, chạy dry-run trước apply và không mang `_id` production sang target.
>
> **Drift check**: xác nhận 20 tên Exercise và 20 label Food còn tồn tại chính xác ở source; Exercise phủ đủ
> 11 `muscleGroup`, Food giữ tỷ lệ 7 đạm / 7 tinh bột / 6 chất béo. Nếu thiếu bất kỳ item nào thì STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM — ghi dữ liệu local/staging, có nguy cơ nhầm database nếu thiếu guard
- **Depends on**: 041, 042
- **Category**: tooling + data fixture + tests
- **Planned at**: 2026-08-11
- **Approval**: APPROVED — owner yêu cầu kéo khoảng 20 bài tập và 20 thực phẩm vào local rồi staging
- **Implementation**: COMPLETE — LOCAL + STAGING VERIFIED 2026-08-11

## Why This Matters

Local và staging cần một catalog nhỏ nhưng đủ đại diện để kiểm thử Workout/Meal Plan mà không sao chép toàn bộ
production. Fixture phải lặp lại an toàn, có nguồn rõ ràng và tuyệt đối không tạo đường ghi ngược vào production.

## Scope

### In scope

- Đọc 20 Exercise và 20 Food theo tên/label chính xác từ public production API.
- Exercise phủ đủ 11 nhóm cơ hiện có; Food gồm 7 nguồn đạm, 7 tinh bột và 6 chất béo.
- Dry-run mặc định; `--apply` mới ghi dữ liệu.
- Local chỉ chấp nhận MongoDB localhost và database `htcoaching_local`.
- Staging dùng guard môi trường hiện có, confirmation riêng và database `htcoaching_staging`.
- Fixture có marker quản lý riêng; rerun idempotent và cleanup chỉ xóa fixture do script tạo.
- Giữ nutrition/provenance/allergen fields source cung cấp; không bịa giá hoặc metadata.

### Out of scope

- Không ghi, xóa hoặc update production.
- Không sao chép toàn bộ catalog, user, hội thoại, health data hoặc dữ liệu nhạy cảm.
- Không overwrite record staging/local trùng tên nhưng không do fixture quản lý.
- Không deploy code, commit hoặc push.

## Steps

### Step 1: Regression guards cho manifest và target safety

Viết test xác nhận manifest 20/20, Exercise phủ đủ nhóm cơ kỳ vọng, Food đúng 7/7/6 và target guard từ chối
localhost/database/confirmation sai.

**Verify RED**: focused Vitest fail trước khi module đồng bộ tồn tại.

### Step 2: Implement importer idempotent

Tạo adapter cho response public API, exact selection, sanitization theo schema và chính sách upsert. Record chưa tồn tại
được insert với marker; managed record được update; unmanaged collision được skip. Dry-run chỉ tính plan, không mutation.

**Verify**: focused Vitest pass và output không chứa URI/secret/raw payload.

### Step 3: Apply và verify local

Chạy dry-run rồi apply vào `mongodb://127.0.0.1:27017/htcoaching_local?replicaSet=rs0`. Query lại đúng manifest,
11 nhóm cơ và tỷ lệ macro.

### Step 4: Apply và verify staging

Chạy qua Doppler staging config với confirmation riêng. Guard phải xác nhận `APP_ENV=staging`, các outbound side effect
bị tắt và connected database đúng `htcoaching_staging`; sau đó query DB/API staging để xác minh.

### Step 5: Quality gates và evidence

Chạy focused test, secret scan, data-boundary scan và `git diff --check`; cập nhật plan bằng kết quả thật.

## Test Plan

- `cd server && npx vitest run src/scripts/__tests__/publicTestCatalogSync.test.js`
- local dry-run/apply/verify
- staging dry-run/apply/verify với confirmation explicit
- `npm run security:secrets`
- `npm run security:data-boundaries`
- `git diff --check`

## Done Criteria

- [x] Local có đúng 20 Exercise fixture, phủ đủ 11 nhóm cơ.
- [x] Local có đúng 20 Food fixture, đúng 7 đạm / 7 tinh bột / 6 chất béo.
- [x] Staging có cùng manifest, không collision và không overwrite dữ liệu sẵn có.
- [x] Rerun không tạo duplicate; cleanup chỉ nhắm marker của Plan 043.
- [x] Production chỉ nhận request GET và không có code path mutation.
- [x] Test/safety/security/diff gates có evidence thật.

## STOP Conditions

- Source thiếu/thừa item, nhóm cơ hoặc macro manifest drift.
- Target URI/database không khớp local hoặc staging contract.
- Staging config không qua `assertStagingOperation` hoặc thiếu confirmation.
- Có collision unmanaged khiến target không thể đạt coverage yêu cầu mà không overwrite dữ liệu.
- Mutation count hoặc verify count khác dry-run plan.

## Maintenance Notes

- Khi đổi label/tên production, cập nhật manifest và test cùng lúc; không fuzzy-match.
- Marker fixture là metadata vận hành ở collection, không mở rộng schema/API công khai.
- Chỉ thêm item mới khi thật sự cần tăng coverage; catalog test nhỏ giúp QA ổn định hơn.

## Validation Evidence

- Source production public API exact-check: `20` Exercise và `20` Food; không có source mutation.
- Local dry-run: `20/20` insert, `0` collision; apply transaction verify `20` Exercise / `11` nhóm cơ /
  `20` Food / `7-7-6`; rerun dry-run báo `0` insert và `20` managed update mỗi collection.
- Doppler drift check: `dev_personal` hiện trỏ local nên bị guard từ chối; config `stg` được xác minh bằng metadata
  đã khử secret, đúng database `htcoaching_staging`, đúng staging origins và tắt jobs/email/retention/build hook.
- Staging dry-run: `20/20` insert, `0` collision; apply transaction có cùng verify `20 / 11 / 20 / 7-7-6`.
- Staging rerun: `0` insert và `20` managed update mỗi collection, chứng minh idempotency.
- Public staging API: match `20` Exercise / `11` nhóm cơ / `20` Food; collection totals là `21/21` vì fixture
  staging cũ tồn tại độc lập.
- Focused Vitest: `5/5` pass. Full server unit/integration: `645/645` pass (`131` files).
- `node --check`, secret scan, repository data-boundary (`0` violation) và `git diff --check`: pass.
- Client build/E2E: không chạy vì thay đổi chỉ là server-side data tool, không đổi runtime route/UI/API contract.
