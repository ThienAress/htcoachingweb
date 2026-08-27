# Plan 072: Nhập hàng loạt hướng dẫn và độ phức tạp kỹ thuật bài tập

> **Hướng dẫn thực thi**: Follow plan theo từng behavior slice. Chạy verification
> của slice hiện tại trước khi chuyển bước. Không ghi dữ liệu production; production
> chỉ được đọc từ public Exercise API để tạo tài liệu bàn giao.
>
> **Drift check**: Dừng nếu contract `instructions`/`technicalDifficulty`, route
> `/api/exercises` hoặc phần header action của `ExerciseManagement.jsx` không còn
> khớp Current State bên dưới.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 047, 071A
- **Category**: feature | api | ui | tests | operations
- **Planned at**: 2026-08-27
- **Status**: DONE / LOCAL VERIFIED — FULL SERVER + AUTH E2E BLOCKED

## Why This Matters

Thư viện production có hơn một nghìn bài tập nên nhập từng bước setup và chấm
rubric bằng form đơn lẻ không khả thi. Luồng mới cho phép chuyên gia trả JSON theo
tên canonical, Admin preview sai lệch trước khi ghi và cập nhật nguyên tử đúng hai
field chuyên môn mà không làm mất mô tả, ảnh, video hoặc review.

## Current State

- `server/src/models/Exercise.js` có `instructions` tối đa 30 bước và
  `technicalDifficulty` gồm năm tiêu chí 0–2; tên bài tập là unique.
- `server/src/routes/exercise.routes.js` có CRUD Admin + CSRF nhưng chưa có route
  nhập JSON hàng loạt.
- `client/src/pages/admin/ExerciseManagement.jsx` có nút `Thêm nhiều` cho tạo bài
  tập hàng loạt, chưa có luồng nhập bước/rubric.
- Global JSON body limit là 2MB; file chuyên gia có thể lớn nên import phải dùng
  multipart middleware riêng thay vì nới limit cho mọi API.
- Production public API canonical được cấu hình tại
  `https://api.htcoachingweb.io.vn/api`; snapshot 2026-08-27 trả 1.374 bài tập.

## UX Brief

- Audience: Admin HTCOACHING nhập kết quả nghiên cứu từ chuyên gia.
- Một việc chính: xác minh file khớp bài tập rồi cập nhật an toàn.
- Surface mode: `Operate`; giữ Product palette zinc/slate + emerald, không motion
  trang trí, không nested cards.
- Layout A (chọn): `Header → file input → preview summary/list → footer confirm` trong
  modal có scroll riêng. Layout B (loại): form inline trên đầu bảng vì chiếm chỗ
  thường trực và làm loãng tác vụ quản lý danh sách.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Backend focused | `npm run test:unit:server -- --run src/routes/__tests__/exerciseInstructionsImport.routes.integration.test.js src/middlewares/__tests__/exerciseInstructionsJsonUpload.test.js` | exit 0 |
| Client focused | `npm run test:unit:client -- --run src/services/__tests__/exercise.service.test.js src/pages/admin/__tests__/exerciseInstructionsImport.test.js src/pages/admin/__tests__/ExerciseInstructionsImportModal.test.jsx` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 |
| UI gate | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | không có finding high mới |

## Scope

**In scope**:

- Exercise import upload middleware, service, controller, route và focused tests.
- Exercise client service, parser helper, modal Admin và action button.
- JSON rules handoff, production Exercise name/description snapshot và script export
  public catalog có thể chạy lại.
- Cập nhật spec/plan canonical.

**Out of scope**:

- Thay schema Exercise, chạy migration/backfill hoặc ghi production.
- Đổi mô tả, ảnh, video, tên, nhóm cơ, review hoặc công thức tính sao hiện có.
- Refactor toàn bộ `ExerciseManagement.jsx` hoặc `validation.js`.

## Steps

### Step 1: Preview file an toàn qua public Admin API

Tạo upload middleware JSON riêng, strict parser/validator và endpoint multipart
Admin-only + CSRF. Preview ghép tên chính xác, trả tổng matched/missing cùng sample,
không ghi database.

**Behavior**: Admin tải file hợp lệ và biết toàn bộ tên có thể commit hay không.

**Verify**: focused backend tests cho MIME/extension/size, malformed/unknown fields,
duplicate names, role/CSRF và dry-run không ghi.

### Step 2: Commit nguyên tử instructions + technicalDifficulty

Trong transaction, lặp lại preflight tên rồi bulk update đúng hai field. Missing name
hoặc lỗi transaction phải rollback toàn bộ; response báo matched/modified count.

**Behavior**: một file hợp lệ cập nhật đúng bài và không làm đổi field ngoài scope.

**Verify**: integration tests commit, rollback missing name và bảo toàn canonical
fields.

### Step 3: Thêm modal import vào Quản lý bài tập

Tạo component modal riêng với file validation, preview bắt buộc, summary rõ ràng,
confirm disabled khi có mismatch, loading/error states, dialog semantics, Escape,
document scroll lock và responsive overflow. Thêm nút `Thêm nhiều bước bài tập` cạnh
các action hiện có.

**Behavior**: Admin không thể commit trước preview và nhận feedback sau import.

**Verify**: client parser/service tests, lint, build và UI regression gate.

### Step 4: Xuất đúng hai tài liệu cho chuyên gia từ production

Tạo file rule JSON riêng có rubric năm tiêu chí và file chỉ chứa tên + mô tả của toàn
bộ public production catalog. Script chỉ GET host production allowlist, kiểm tra
pagination/count và render Markdown deterministic. Xóa file handoff local 21 bản ghi
cũ sau khi hai file mới đã được xác minh.

**Behavior**: chuyên gia có rules độc lập và danh sách đủ 1.374 bài production, không
lẫn staging/local.

**Verify**: chạy exporter read-only, so count API = count heading, tìm duplicate/missing
name/description và kiểm tra file rule không lẫn catalog.

## Test Plan

- Backend: preview no-write; commit success; duplicate/missing reject; malformed JSON;
  strict fields; role/CSRF; file boundary; field preservation; rollback.
- Frontend: file syntax/shape guard, multipart preview/commit contract và commit chỉ
  bật khi `canImport`.
- Regression: existing Exercise focused tests, lint/build, UI audit và diff check.

## Done Criteria

- [x] Nút và modal mới hoạt động theo `chọn → preview → xác nhận`.
- [x] Backend chỉ cập nhật `instructions` + `technicalDifficulty` và rollback toàn bộ
  khi có tên không khớp.
- [x] Admin-only, CSRF, file type/size và strict JSON contract có test.
- [x] Hai Markdown tách biệt được tạo từ đủ 1.374 bản ghi production public.
- [x] Focused tests, lint/build/UI gate và diff hygiene đạt hoặc blocker được ghi rõ.
- [x] `docs/plans/README.md` cập nhật status thực tế.

## Verification Results

- Backend importer: `2` test files, `11` tests pass; bao gồm preview no-write,
  commit, transaction rollback, Admin/CSRF, strict rubric và token/file mismatch.
- Frontend focused: `3` test files, `8` tests pass; full client: `124` files,
  `580` tests pass.
- Client lint và compile-only Vite build pass (`2.915` modules transformed).
- UI regression gate: `0` finding mới, `0` high-confidence blocking; desktop và
  viewport mobile `390×844` đã được kiểm tra thủ công trong browser local.
- `node --check` pass cho service/controller/middleware/exporter mới; mọi file mới
  sau khi tách module đều dưới `300` dòng.
- Catalog bàn giao có đúng `1.374` heading từ public production API, không có tên
  rỗng hoặc trùng; không có thao tác ghi production.
- Full server suite: blocked vì runner không trả kết quả sau khoảng `7` phút và đã
  được dừng; không tuyên bố pass.
- Authenticated Admin E2E: chưa chạy vì môi trường local không có Admin session;
  truy cập route được chuyển về `/login`.

## STOP Conditions

- Production GET trả phân trang không đầy đủ hoặc count thay đổi giữa các lần đọc.
- Cần ghi dữ liệu production/migration để hoàn thành.
- Contract import buộc phải đổi schema hoặc auth/CSRF core.
- Cùng verification fail ba vòng sau khi đã thu hẹp root cause.

## Maintenance Notes

- Khi schema bước/rubric đổi, phải tăng `schemaVersion` và giữ parser version cũ trong
  compatibility window hoặc báo lỗi nâng cấp rõ ràng.
- Không nới global JSON body limit cho importer; file tiếp tục đi qua middleware riêng.
- Snapshot production là public catalog tại thời điểm xuất, không tự đồng bộ hoặc ghi
  ngược về production.
