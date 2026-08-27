# Plan 071: Ưu tiên thư viện bài tập và chỉ nhắc kế hoạch cho học viên có gói

> **Hướng dẫn thực thi**: Follow plan step by step. Chạy verification của từng
> behavior slice trước khi chuyển bước. Nếu gặp STOP condition, dừng và báo cáo.
>
> **Drift check**: Trước khi sửa, xác nhận `Pricing.jsx` vẫn quyết định
> `showProgressPrompt` từ `Boolean(user)` + `pricingViewMode`, và `/exercises`
> vẫn mặc định render trình tạo lịch tập với thư viện nằm trong modal. Nếu hai
> contract này đã đổi, cập nhật plan trước khi implement.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 004, 033, 047, 049
- **Category**: bug | ui | access-policy | tests
- **Planned at**: 2026-08-26
- **Status**: DONE / LOCAL VERIFIED

## Why This Matters

Homepage đang hiển thị lời nhắc “Kế hoạch hôm nay đã sẵn sàng” cho mọi tài khoản
đăng nhập nếu local pricing persona là `customer`; role HLV/admin, user thường và
HT Fitness+ đều có thể thấy dù không có Order coaching active. Đồng thời trang
`/exercises` đặt trình tạo lịch tập PDF làm nội dung chính và giấu dữ liệu bài tập
sau modal, trái với tên “Hệ thống bài tập”. Kết quả cần fail-closed theo entitlement
backend và đưa thư viện bài tập lên màn hình đầu mà không làm mất planner/PDF hiện có.

## Current State

- `client/src/sections/Pricing.jsx:78-82` dùng `Boolean(user)` và
  `viewMode === "customer"`; không kiểm tra Order hoặc trainer entitlement.
- `server/src/services/serviceAccessPolicy.service.js:142-219` đã phân biệt
  `coaching_customer`, `trainer`, Fitness+ và user thường từ nguồn backend canonical.
- `server/src/services/todayDashboard.service.js:21-98` xác định Order active bằng
  `status === "approved"` và `sessions > 0` cho dashboard.
- `client/src/pages/ExercisesPage/ExercisesPage.jsx:184-316` mở đầu bằng planner;
  thư viện chỉ xuất hiện qua `ExerciseListModal`.
- `client/src/hooks/useExercisesLogic.js:23` đã tải tối đa 500 bài từ service hiện có.
- `Exercise` hiện có các field cần giữ: `name`, `imageUrl`, `muscleGroup`,
  `description`; technical difficulty tiếp tục đọc dữ liệu hiện có, không đổi schema.
- `/exercises` là public route có SEO, sitemap và prerender sẵn; route không đổi.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused client | `npm run test:unit:client -- --run <test files>` | exit 0 |
| Focused server | `npm run test:unit:server -- --run <test files>` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- `docs/plans/071-prioritize-exercise-library-and-gate-student-prompt.md`
- `docs/plans/README.md`
- `server/src/services/todayDashboard.service.js`
- `server/src/controllers/todayDashboard.controller.js`
- `server/src/routes/todayDashboard.routes.js`
- `server/src/controllers/__tests__/todayDashboard.integration.test.js`
- `client/src/services/todayDashboard.service.js`
- `client/src/sections/Pricing.jsx`
- `e2e/mock-api.cjs`
- `e2e/home-progress-entry.spec.js`
- `e2e/exercises-library.spec.js`
- `client/src/pages/ExercisesPage/ExercisesPage.jsx`
- `client/src/pages/ExercisesPage/ExerciseLibrary.jsx`
- `client/src/pages/ExercisesPage/ExerciseDetailDialog.jsx`
- `client/src/pages/ExercisesPage/WorkoutPlanner.jsx`
- `client/src/pages/ExercisesPage/__tests__/ExercisesPage.test.jsx`
- `client/src/pages/ExercisesPage/exerciseLibraryFilters.js`
- `client/src/hooks/useExercisesLogic.js`
- `client/src/services/exercise.service.js`
- `client/src/i18n/locales/vi/exercises.json`
- `client/src/i18n/locales/en/exercises.json`

**Out of scope**:

- Không đổi `Exercise` schema hoặc quy trình admin đánh giá kỹ thuật.
- Không xóa/sửa dữ liệu production hoặc fixture staging.
- Không đổi quota registry, số lượt, pricing hoặc quyền truy cập `/exercises`.
- Không đổi auth cookies, CSRF, JWT, `client/src/utils/api.js` hoặc route login.
- Không refactor toàn bộ `Pricing.jsx` hay các planner component hiện có.
- Không thêm public route/sitemap/prerender entry mới.

## Steps

### Step 1: Chỉ hiển thị prompt cho coaching customer không đồng thời là HLV

Thêm read-only endpoint Today Dashboard trả eligibility tối thiểu từ resolver backend
canonical. `eligible` chỉ true khi actor có `coaching_customer` và không có `trainer`;
user thường, Fitness+ only, trainer role, admin role và user có TrainerSubscription đều
fail-closed. Pricing dùng TanStack Query/service hiện có và chỉ render prompt sau khi
response xác nhận `eligible: true`.

**Behavior**: học viên có Order approved/còn buổi thấy prompt; mọi loại tài khoản khác
không thấy dù `pricingViewMode === "customer"`.

**Blast radius**: Today Dashboard route/controller/service, Pricing consumer, mock/E2E
và integration test; không đổi dashboard day contract.

**Depends on**: none.

**Verify**: focused server integration + homepage E2E tests pass.

### Step 2: Đưa thư viện bài tập lên màn hình mặc định

Tách library và planner thành hai surface rõ ràng. `/exercises` mặc định hiển thị search,
lọc nhóm cơ, kết quả responsive và detail dialog. Card/detail phải giữ đúng tên bài tập,
hình ảnh, nhóm cơ chính và mô tả. Danh sách render tăng dần 24 bài/lần để không dựng
toàn bộ catalog 400+ trong DOM ngay từ đầu. Nút “Tạo lịch tập PDF” là action phụ và mở
planner hiện có; planner tiếp tục chọn nhóm cơ, thêm bài, cảnh báo rời trang, góp ý và
export PDF. Technical difficulty chỉ tái sử dụng field/component hiện tại; không thêm
data rule.

**Behavior**: người dùng thấy bài tập ngay khi mở trang, không cần mở modal; planner chỉ
mount sau action chủ động và có đường quay lại thư viện.

**Blast radius**: Exercises page, components mới, hook/service và locale; không đổi API
hay schema.

**Depends on**: none; write ownership độc lập với Step 1.

**Verify**: component tests chứng minh default library, bốn field, filter/detail và
planner secondary; client lint pass.

### Step 3: Tích hợp, kiểm tra responsive và SEO factual copy

Re-trace cả hai contract, sửa import/copy phát sinh, giữ canonical `/exercises` và JSON-LD
hiện có. Browser inspect desktop + mobile trong một batch; modal/drawer lock scroll,
focus/keyboard/Escape và không tạo horizontal overflow. SEO/copy không tuyên bố dữ liệu
media không có thật.

**Behavior**: desktop/mobile đều tìm và đọc bài tập rõ ràng; popup homepage đúng account
matrix; không có regression planner/PDF.

**Blast radius**: chỉ file in-scope và verification artifacts.

**Depends on**: Steps 1-2.

**Verify**: focused tests, client lint/build, UI regression gate và `git diff --check`.

## Test Plan

- Server integration qua `GET /api/today-dashboard/prompt-eligibility`:
  active coaching customer true; user thường, trainer/admin, TrainerSubscription và
  Fitness+ only false; unauthenticated giữ 401 từ `protect`.
- Homepage E2E: authenticated coaching customer thấy prompt; trainer role và user có
  trainer access không thấy khi pricing persona vẫn là customer; dismiss giữ nguyên.
- Exercises component: thư viện là mặc định; card/detail render `name`, `imageUrl`,
  `muscleGroup`, `description`; search/filter/empty/error/retry; mở/đóng planner.
- Browser manual: desktop 1440x900, mobile 390x844; kiểm tra focus, Escape, document
  scroll lock, no horizontal overflow và ảnh fallback.

## Verification Results

- `npx vitest run src/pages/ExercisesPage/__tests__/ExercisesPage.test.jsx`:
  **5/5 pass**, gồm regression guard cho customer theme wrapper.
- `npx vitest run src/controllers/__tests__/todayDashboard.integration.test.js`:
  **13/13 pass**, gồm coaching customer, user thường, HLV, admin, trainer plan,
  Fitness+ only và unauthenticated.
- `npm run lint --prefix client`: **pass, 0 warning/error do task tạo ra**.
- `npx vite build`: **pass** sau diff cuối; workstream UI cũng đã chạy release build
  đầy đủ thành công trước integration.
- `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high`:
  **0 regression mới, 0 high-confidence blocking**.
- Playwright focused `exercises-library.spec.js` + `home-progress-entry.spec.js`:
  **8/8 test hiện `ok`**. Runner local không tự teardown web servers nên phải dừng thủ
  công sau khi đủ 8 kết quả; exit code cuối 1 đến từ `Ctrl+C`, không có assertion fail.
- Sau code review, chạy lại `exercises-library.spec.js`: **2/2 test hiện `ok`**, gồm
  initial focus, Tab trap, focus restoration và document scroll lock; runner vẫn cần
  `Ctrl+C` sau khi trả đủ kết quả.
- Browser manual: desktop **1440x900** và mobile **390x844** đều `overflowX = 0`;
  modal focus đúng nút đóng, Escape hoạt động, body scroll lock được khôi phục, planner
  chỉ mount sau CTA, filter đúng và console không có error.
- `git diff --check` trên toàn bộ file in-scope: **pass**.
- Independent code review không phát hiện finding BLOCK/HIGH. Finding MED về filter bị
  kẹt khi đổi locale đã được đóng bằng remount library theo language key; ba finding LOW
  về customer theme, plural tiếng Anh và focus/scroll-lock coverage cũng đã được sửa và
  verify lại bằng 5 component tests, 2 E2E assertions, lint/build và UI audit.

## Done Criteria

- [x] Prompt chỉ hiện cho `coaching_customer` không đồng thời có trainer entitlement.
- [x] Account HLV/admin/user thường/Fitness+ only không thấy prompt dù persona customer.
- [x] `/exercises` mặc định hiển thị thư viện với tên, ảnh, nhóm cơ và mô tả.
- [x] Planner/PDF vẫn hoạt động và chỉ mở như action phụ.
- [x] Không đổi Exercise schema, technical difficulty admin workflow hoặc access policy registry.
- [x] Loading/error/retry/empty/keyboard/mobile states có regression guard phù hợp.
- [x] Focused tests, lint, build, UI regression gate và `git diff --check` đạt.
- [x] Không còn debug instrumentation hoặc import/code thừa do thay đổi tạo ra.
- [x] Row Plan 071 trong `docs/plans/README.md` phản ánh kết quả thực tế.

## STOP Conditions

- Resolver canonical không phân biệt được coaching customer và trainer entitlement.
- Fix yêu cầu thay đổi schema, migration/backfill hoặc ghi dữ liệu thật.
- Target file có thay đổi user mới chồng lên cùng symbols sau drift check.
- Cần đổi auth/CSRF/JWT hoặc route public `/exercises` để hoàn thành.
- Cùng verification fail ba vòng với một root cause chưa thu hẹp được.

## Maintenance Notes

- Prompt visibility là product entitlement, không được quay lại suy luận từ localStorage,
  role frontend hoặc tên gói.
- Nếu Exercise vượt quá giới hạn tải hiện tại, chuyển library sang server pagination/facets
  bằng plan riêng; planner vẫn cần catalog bài để chọn.
- Dữ liệu fixture/staging và chuẩn hóa taxonomy nhóm cơ cần quy trình data cleanup riêng,
  không xóa âm thầm trong UI redesign.
