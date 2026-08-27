# Plan 073: Nhập dinh dưỡng công thức từ catalog production

> **Hướng dẫn thực thi**: Follow từng behavior slice và chạy verification trước khi
> chuyển bước. Production chỉ là nguồn GET công khai để tạo catalog bàn giao; tuyệt đối
> không gọi mutation, migration hoặc script ghi dữ liệu thật.
>
> **Drift check**: Dừng nếu `Recipe.nutrition`, route Admin Recipe hoặc public
> `view=prerender` không còn khớp Current State bên dưới.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 058A, 059, 072
- **Category**: feature | schema-validation | api | ui | tests | operations
- **Planned at**: 2026-08-27
- **Status**: DONE / LOCAL VERIFIED — ADMIN DRAFT EXPORT + FULL SERVER SUITE BLOCKED

## Why This Matters

Admin đang phải mở từng công thức để nhập dinh dưỡng, trong khi production có hàng
trăm món. Luồng import có preview và ghép bằng cả tên lẫn nguyên liệu cho phép chuyên
gia trả JSON hàng loạt mà không cập nhật nhầm món trùng tên hoặc làm mất nội dung
canonical. Contract cũng phải lưu được mọi nutrient chuyên gia tính, thay vì dừng ở
sáu nhóm đang hiển thị đầu tiên.

## Current State

- `server/src/models/Recipe.js` có sáu core nutrient và `additional`, nhưng cả model,
  controller, express-validator và form Admin đang giới hạn 20 item.
- `client/src/pages/admin/RecipeManagement.jsx` chỉ có action `Thêm công thức`.
- `server/src/services/exerciseInstructionsImport.service.js` là exemplar preview
  token 10 phút, transaction và `bulkWrite` cho JSON Admin.
- `GET https://api.htcoachingweb.io.vn/api/recipes?view=prerender` trả ingredients,
  phân trang tối đa 50; snapshot đầu phiên 2026-08-27 báo 747 công thức public.
- `Recipe.name` không unique, chỉ `slug` unique; tên một mình không đủ an toàn để match.

## UX Brief

- Audience: Admin nhận file đã được chuyên gia dinh dưỡng tính toán.
- Một việc chính: kiểm tra toàn bộ món khớp rồi cập nhật dinh dưỡng an toàn.
- Surface mode: `Operate`; giữ Product palette zinc + orange, action import là secondary.
- Layout A (chọn): action cạnh `Thêm công thức`, modal `file → summary/issues → sample →
  confirm` có scroll riêng. Layout B (loại): khu import inline thường trực vì chiếm chỗ
  quản lý danh sách và làm tác vụ ít dùng cạnh tranh với tìm kiếm.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Backend focused | `npm run test:unit:server -- --run src/routes/__tests__/recipeNutritionImport.routes.integration.test.js src/middlewares/__tests__/recipeNutritionJsonUpload.test.js src/controllers/__tests__/recipeNutrition.integration.test.js` | exit 0 |
| Client focused | `npm run test:unit:client -- --run src/services/__tests__/recipe.service.test.js src/pages/admin/__tests__/recipeNutritionImport.test.js src/pages/admin/__tests__/RecipeNutritionImportModal.test.jsx src/pages/admin/__tests__/RecipeNutritionEditor.test.js` | exit 0 |
| Compile | `npx vite build --config client/vite.config.js` hoặc QA compile command canonical | exit 0 |
| Lint | `npm run lint --prefix client` | exit 0 |
| UI gate | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | không có high mới |

## Scope

**In scope**:

- Shared nutrition normalizer và giới hạn `additional` đồng bộ 60 ở model, API CRUD,
  express-validator và form Admin.
- Upload middleware, strict parser, preview/commit service, controller, route và tests.
- Client service, file guard, modal preview/confirm và action trong Recipe Management.
- Exporter GET-only cùng hai file Markdown rules/catalog production.
- Cập nhật spec, plan và index tài liệu canonical.

**Out of scope**:

- Tự ước tính nutrition trong app hoặc coi JSON chuyên gia là nguồn khoa học tự động.
- Ghi production, migration/backfill, đổi nguyên liệu hoặc publish state.
- Refactor toàn bộ `RecipeManagement.jsx`, `RecipeEditModal.jsx` hoặc `validation.js`.

## Steps

### Step 1: Nhập an toàn một file đã khớp tên và nguyên liệu

Thêm multipart endpoint Admin-only + CSRF. Strict parser validate version, core,
additional và exact fields. Preview query mọi candidate theo tên rồi so toàn bộ danh
sách `{name, measure}`; commit yêu cầu digest token, lặp lại lookup trong transaction
và bulk update đúng `nutrition`.

**Behavior**: file hợp lệ được preview không ghi, sau confirm cập nhật nguyên tử; một
missing/mismatch/ambiguous item chặn toàn bộ.

**Verify**: focused backend tests cho happy path, auth/CSRF, malformed/unknown/duplicate,
name + ingredients mismatch, token mismatch, rollback và field preservation.

### Step 2: Cho phép lưu toàn bộ chất chuyên gia cung cấp

Tách nutrition normalization đang private trong controller thành service dùng chung.
Nâng cùng một constant từ 20 lên 60 tại model/express-validator/form/importer; giữ unit,
reserved label và non-negative contract hiện có.

**Behavior**: CRUD và importer nhận tới 60 chất; public detail tiếp tục render tự động
qua `additional`; document cũ vẫn hợp lệ và không cần migration.

**Verify**: model/API/client helper regressions ở biên 60 và reject 61.

### Step 3: Mở luồng import trong Quản lý Công thức

Thêm secondary action `Nhập Giá trị dinh dưỡng` cạnh CTA tạo. Modal dùng file guard,
preview bắt buộc, summary matched/issues, sample số chất, disabled/loading/error states,
Escape/focus restore, document scroll lock và responsive overflow.

**Behavior**: Admin hiểu file nào chưa khớp và không thể commit trước preview hợp lệ;
sau thành công cache admin/public recipe được invalidate.

**Verify**: service/helper/modal tests, client lint/compile và UI regression gate.

### Step 4: Bàn giao rules và catalog từ production

Tạo exporter allowlist đúng production origin, paginate đủ và render deterministic chỉ
tên + nguyên liệu. File rules giải thích nguồn tính là toàn bộ nguyên liệu, bắt buộc đủ
sáu core và mọi nutrient tính được trong `additional`, kèm schema/example/validation.

**Behavior**: chuyên gia nhận đúng hai file `.md`, catalog count bằng API total tại thời
điểm xuất và không lẫn local/staging hoặc dữ liệu ngoài tên/nguyên liệu.

**Verify**: chạy exporter GET-only; assert page/count, no empty name/ingredient shape,
no duplicate composite identity và heading count bằng production total.

## Test Plan

- Backend integration: preview no-write, commit success, rollback, preserve canonical
  fields, auth/role/CSRF, strict shape, malformed file, duplicate composite identity,
  ingredient mismatch, ambiguous match, token expiry/digest mismatch, 60/61 nutrients.
- Frontend: JSON file guard, multipart fields, commit disabled before valid preview,
  accessible dialog copy và cache invalidation callback.
- Regression: existing recipe nutrition/review tests, client lint/compile, UI audit,
  `git diff --check` và `node --check` cho files mới.

## Done Criteria

- [x] Nút và modal mới chạy đủ `chọn → xem trước → xác nhận`.
- [x] Commit chỉ `$set nutrition`, transaction rollback nếu một item không khớp.
- [x] Admin-only, CSRF, size/type, preview token và strict JSON có test.
- [x] CRUD/importer nhận 60 `additional`, reject 61, không cần migration.
- [x] Hai Markdown được tạo từ toàn bộ public production catalog tại thời điểm xuất.
- [x] Focused QA, lint/compile/UI gate và diff hygiene đạt hoặc blocker ghi rõ.
- [x] Index/spec/plan phản ánh đúng verification thực tế.

## Verification Results

- Backend focused: 4 files, 14 tests pass; cover preview no-write, commit, rollback,
  name + ingredients match, Admin/CSRF, strict JSON, token digest và biên 60/61.
- Client focused: 4 files, 6 tests pass; full client: 127 files, 585 tests pass.
- Client lint pass; compile-only Vite build pass với 2.918 modules transformed.
- UI regression gate: 0 finding mới, 0 high-confidence blocking; 12 baseline finding
  được resolve bởi trạng thái working tree hiện tại.
- `node --check` pass cho 7 file backend/exporter mới; secret scan và repository data
  boundary pass, 0 violation. Tất cả file code/test mới dưới 300 dòng.
- Exporter GET-only tạo đúng 747 heading công thức và 7.760 nguyên liệu từ public
  production; count bằng API total, không trùng định danh `name + ingredients`.
- Full server suite không trả kết quả sau hơn hai phút và đã được dừng; không tuyên bố
  pass. Focused Recipe suite đã chạy lại sau thay đổi cuối và pass.
- Production Admin route chuyển về `/login` do không có session, nên catalog không thể
  xác minh các draft protected. Không tự đăng nhập hoặc lấy credential; file bàn giao là
  toàn bộ public production catalog tại ngày xuất.

## STOP Conditions

- Production pagination/count thay đổi giữa một lần export hoặc response thiếu ingredients.
- Cần ghi production hoặc đổi type/semantics dinh dưỡng để hoàn thành.
- Matching không thể xác định duy nhất bằng tên + nguyên liệu canonical.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Khi đổi shape phải tăng `schemaVersion`; không âm thầm chấp nhận field lạ.
- Không nới global JSON body limit; giữ upload middleware riêng.
- Catalog là snapshot public production, không phải bản sao database hay cơ chế sync.
