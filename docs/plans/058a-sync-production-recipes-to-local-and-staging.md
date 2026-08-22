# Plan 058A: Đồng bộ 10 công thức production vào local và staging

> **Hướng dẫn thực thi**: Chạy từng bước theo thứ tự, luôn chạy dry-run trước apply.
> Nếu target guard, source manifest hoặc verification không khớp thì dừng; không đổi
> sang production database và không ghi đè recipe không do script này quản lý.
>
> **Drift check**: Xác nhận `Recipe` vẫn dùng `slug` unique, public detail vẫn trả
> `ingredients`/`instructions`, và staging database canonical vẫn là
> `htcoaching_staging` trước khi chạy mutation.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: HIGH — ghi dữ liệu staging và lấy nội dung từ production public API
- **Depends on**: 043, 057, 058
- **Category**: migration / data / tests
- **Planned at**: 2026-08-21
- **Status**: DONE / LOCAL + STAGING VERIFIED

## Why This Matters

Browser QA trước đó chỉ proxy GET 10 recipe production nên dữ liệu biến mất khi proxy
dừng. Local API hiện chỉ có `staging-demo-protein-bowl`, khiến UI nutrition/review không
có đủ recipe thực tế để đánh giá. Cần một sync idempotent, có ownership marker và target
guard để giữ đúng 10 recipe ở cả local lẫn staging mà không tác động production.

## Current State

- `client/.env.development:1` trỏ frontend tới `http://localhost:5000/api`.
- `server/src/models/Recipe.js` dùng `slug` unique và chứa nội dung recipe đầy đủ.
- `server/src/scripts/publicTestCatalogSync.js` chỉ sync `foods` và `exercises`.
- `server/src/scripts/stagingSeed.js:126-234` có thể import recipe nhưng kéo theo toàn
  bộ staging fixtures và không hỗ trợ target local.
- Production public API có 747 recipe; 10 slug đã chọn bao phủ món thực vật, cá và hải sản.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused test | `npm test --prefix server -- src/scripts/__tests__/publicRecipeCatalogSync.test.js` | exit 0 |
| Local dry-run | `npm run preflight:recipe-catalog:local --prefix server` | database `htcoaching_local`, 10 actions |
| Local apply | `npm run sync:recipe-catalog:local --prefix server` | verified 10 |
| Staging dry-run | chạy script qua Doppler staging với confirmation variable | database `htcoaching_staging`, 10 actions |
| Staging apply | chạy script qua Doppler staging với `--apply` | verified 10 |
| Server QA | `npm run test:unit:server` | exit 0 |

## Scope

**In scope**:

- `server/src/scripts/publicRecipeCatalogSync.contract.js`
- `server/src/scripts/publicRecipeCatalogSync.js`
- `server/src/scripts/__tests__/publicRecipeCatalogSync.test.js`
- `server/package.json`
- `docs/plans/058a-sync-production-recipes-to-local-and-staging.md`
- `docs/plans/README.md`

**Out of scope**:

- Production database mutation, schema/index changes, cleanup recipe khác.
- Thay đổi Recipe API/UI hoặc tự động deploy staging code.
- Copy `_id`, review, bookmark hoặc dữ liệu user từ production.

## Steps

### Step 1: Khóa manifest, sanitization và target guards

Tạo contract cho đúng 10 slug production. Local chỉ chấp nhận localhost +
`htcoaching_local`; staging tái sử dụng `validateStagingOperation` và confirmation riêng.
Sanitizer chỉ giữ field thuộc `Recipe` schema, ép `isPublished: true`, giới hạn độ dài và
từ chối source payload thiếu name/ingredients/instructions.

**Behavior**: source hoặc target drift làm preflight fail trước khi connect/write.

**Verify**: focused Vitest chứng minh manifest 10 unique slug, sanitizer và hai target guard.

### Step 2: Sync idempotent qua public API

Fetch detail của từng slug từ production public API, build plan theo `slug`, insert record
thiếu, update record có marker của plan 058A và từ chối collision với record unmanaged.
Apply trong transaction; verify đủ 10 published recipe, đủ nội dung và marker đúng.

**Behavior**: dry-run không ghi; apply lần đầu insert 10; apply lại chỉ update 10 record
được quản lý, không tạo duplicate.

**Verify**: focused Vitest pass và `node --check` cho hai script.

### Step 3: Apply local rồi staging

Chạy local dry-run/apply/verify trước. Sau đó dùng Doppler staging, explicit confirmation,
dry-run rồi apply. Cuối cùng gọi public API staging và local/read-model tương ứng để xác
nhận danh sách public nhìn thấy 10 recipe đã sync ngoài fixture có sẵn.

**Behavior**: cả hai database lưu đủ cùng manifest 10 slug; production chỉ bị GET.

**Verify**: output apply có `verified.recipes = 10`; API list/detail trả recipe và nội dung.

## Test Plan

- Manifest: đúng 10 slug unique và chỉ source production được duyệt.
- Sanitizer: giữ field hợp lệ, drop `_id`/`nutrition`/field lạ, reject payload thiếu nội dung.
- Ownership: insert missing, update marker của plan 058A, reject unmanaged collision.
- Target: local host/database exact; staging safety + confirmation exact.
- Focused test trước, sau đó full server unit suite theo `$qa server`.

## Done Criteria

- [x] Script có dry-run/apply, target guard và marker ownership.
- [x] Focused test và full server tests pass.
- [x] Local `htcoaching_local` verify đủ 10 recipe.
- [x] Staging `htcoaching_staging` verify đủ 10 recipe.
- [x] Production chỉ có read requests, không mutation.
- [x] `git diff --check` pass và không có secret/debug log mới.
- [x] Row plan 058A được cập nhật trạng thái thực tế.

## Verification Evidence

- Focused sync contract: 1 file / 7 tests pass.
- Full server QA: 180 files / 922 tests pass, exit 0.
- Local preflight trước apply: `insert: 10`, `update: 0`.
- Local apply: verify `recipes: 10`, `completeRecipes: 10`.
- Local preflight sau apply: `insert: 0`, `update: 10`; không tạo duplicate.
- Secret scan pass; repository data-boundary scan có 0 violations.
- Local MongoDB replica set `rs0` chạy ở loopback, data path ignored
  `.local-data/mongodb` và database đúng `htcoaching_local`.
- Doppler config được truyền tường minh bằng project `htcoaching-server`, config `stg`;
  target guard xác nhận database `htcoaching_staging` trước mutation.
- Staging preflight trước apply: `insert: 10`, `update: 0`.
- Staging apply: verify `recipes: 10`, `completeRecipes: 10`.
- Staging preflight sau apply: `insert: 0`, `update: 10`; không tạo duplicate.
- Localhost backend và staging public API đều trả tổng `11` recipe: đủ `10/10`
  manifest production cộng với fixture staging độc lập.
- Cả 10 detail API có ingredients; nutrition fail-closed theo Food reference coverage:
  `4` recipe partial có optional nutrients và `6` recipe unavailable.

## STOP Conditions

- Local MongoDB không phải `htcoaching_local` hoặc không hỗ trợ transaction.
- Doppler staging không resolve đúng `htcoaching_staging`/staging safety profile.
- Một trong 10 slug đã tồn tại nhưng không có marker plan 058A.
- Production detail payload thiếu ingredients/instructions hoặc có slug drift.
- Apply/verification fail ba vòng sau sửa có căn cứ.

## Maintenance Notes

- Marker plan 058A là ownership boundary; không dùng script này để quản lý toàn bộ catalog.
- Khi muốn đổi 10 recipe phải sửa manifest + test và review collision trước apply.
- Cleanup không thuộc yêu cầu này; không tự xóa recipe đã sync.
