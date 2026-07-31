# Plan 006: Chuyển Today thành Customer Dashboard theo module

> **Hướng dẫn thực thi**: Chạy từng verification gate trước khi chuyển bước. Nếu route, auth hoặc
> data contract lệch Current State thì dừng và cập nhật plan, không tự đổi backend/schema.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 003H, 004
- **Category**: feature | ui | routes | tech-debt
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Why This Matters

Today Dashboard ban đầu là read-only overview nhưng hiện render liên tiếp Wellness, Nutrition,
Habit, comment, bốn source sections và Activity Timeline. Người mới không phân biệt được việc cần
làm với dữ liệu tham khảo, đặc biệt trên mobile. Cần giữ read model/API canonical nhưng thay lớp
presentation bằng Customer Dashboard có navigation ổn định và progressive disclosure.

## Assumptions

1. Không đổi endpoint, response contract, schema, retention hoặc authorization backend.
2. `/dashboard` trở thành customer entry canonical; `/today*` và `/progress` vẫn hoạt động qua
   redirect để bảo toàn notification/bookmark/client cũ.
3. Desktop dùng sidebar; mobile dùng bottom navigation 5 mục, không copy mật độ Admin Panel.
4. `dateKey` được giữ khi chuyển Today/Training/Nutrition/Journal.
5. Existing Wellness/Nutrition/Habit/Progress components tiếp tục sở hữu mutation/query hiện tại.

## Current State

- `client/src/App.jsx:166-190` khai báo standalone `/today`, `/today/:dateKey`, `/progress` qua
  `AuthenticatedRoute`; chưa có customer layout/nested routes.
- `client/src/pages/today-dashboard/TodayDashboard.jsx:98-132` sở hữu query, cache update và date
  navigation; `:250-287` render mọi module trong một vertical flow.
- `client/src/layouts/AdminLayout.jsx:31-75,202` là exemplar cho layout + grouped navigation +
  `Outlet`, nhưng Customer Dashboard cần ít mục và mobile bottom nav.
- `client/src/pages/progress/ProgressPage.jsx` tự render marketing `Header/Footer`, nên cần embedded
  mode để dùng bên trong product shell.
- `client/src/sections/Header/Header.jsx:258`, `client/src/sections/Pricing.jsx:54`,
  `client/src/utils/notificationDestination.js:10-11` là các route consumers cần compatibility.
- `client/src/sections/Header/Header.jsx:258-264` vẫn hiển thị đồng thời Dashboard và sáu công cụ
  canonical trong menu tài khoản khách hàng; điều này làm entry point bị trùng dù các module Dashboard
  đã sở hữu deep link tương ứng.
- `client/src/services/todayDashboard.service.js` và backend aggregator không đổi.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Focused unit | `npm run test:unit:client -- --run customerDashboardNavigation` | exit 0 |
| Focused E2E | `npx playwright test e2e/today-dashboard.spec.js e2e/home-progress-entry.spec.js --project=chromium` | all pass |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client unit | `npm run test:unit:client` | all pass |
| Client build | `npm run build --prefix client` | build, prerender, bundle budget pass |
| Full E2E | `npm run test:e2e` | all pass |

## Scope

**In scope**:

- `docs/specs/today-dashboard.md`
- `docs/plans/006-customer-dashboard-information-architecture.md`
- `docs/plans/README.md`
- `client/src/App.jsx`
- `client/src/layouts/CustomerDashboardLayout.jsx`
- `client/src/hooks/useTodayDashboardDay.js`
- `client/src/utils/customerDashboardNavigation.js`
- `client/src/utils/__tests__/customerDashboardNavigation.test.js`
- `client/src/pages/today-dashboard/TodayDashboardIndex.jsx`
- `client/src/pages/today-dashboard/LegacyDashboardRedirect.jsx`
- `client/src/pages/today-dashboard/TodayDashboardDayLayout.jsx`
- `client/src/pages/today-dashboard/TodayDashboard.jsx`
- `client/src/pages/today-dashboard/TodayTraining.jsx`
- `client/src/pages/today-dashboard/TodayNutrition.jsx`
- `client/src/pages/today-dashboard/TodayJournal.jsx`
- `client/src/pages/progress/ProgressPage.jsx`
- `client/src/components/ChatWidget/DeferredChatPanel.jsx`
- `client/src/sections/Header/Header.jsx`
- `client/src/i18n/locales/vi/common.json`
- `client/src/i18n/locales/en/common.json`
- `client/src/sections/Pricing.jsx`
- `e2e/today-dashboard.spec.js`
- `e2e/home-progress-entry.spec.js`
- `e2e/accessibility.spec.js`

**Out of scope**:

- Backend route/controller/service/model, Mongoose schema hoặc migration.
- Thay đổi eligibility, ownership, retention, notification payload hoặc progress formula.
- Refactor các màn hình canonical Booking, Coaching, Workout Plan, Meal Plan.
- Public SEO/sitemap/prerender route mới; dashboard vẫn private/noindex.

## Tasks

### Task 1: Khóa route/date behavior bằng unit test

- [x] Viết failing tests cho path builder/parser: 5 module routes, giữ date và fallback date.
- **Verify**: focused Vitest fail trước implementation, pass sau utility.

### Task 2: Tạo Customer Dashboard product shell

- [x] Tạo lazy `CustomerDashboardLayout` với desktop sidebar, mobile top bar + bottom nav, active
  state, notification/account/home access và `<Outlet>`.
- [x] Navigation chỉ có Hôm nay, Tập luyện, Dinh dưỡng, Nhật ký, Tiến trình.
- [x] Ẩn global chat launcher trên `/dashboard` để không che mobile bottom navigation.
- **Verify**: client lint và mobile E2E không overflow, keyboard links có accessible name/current.

### Task 3: Tách shared day query/state khỏi page lớn

- [x] Chuyển Today query/cache journal update vào `useTodayDashboardDay`.
- [x] Tạo `TodayDashboardDayLayout` sở hữu date header, loading/error/onboarding/partial error và
  outlet context; đổi ngày phải giữ module đang xem.
- **Verify**: existing adapter/unit tests và E2E invalid/active state pass.

### Task 4: Tạo overview và module pages

- [x] `TodayDashboard` chỉ còn overview: next action, completion và module rows; không có full form.
- [x] `TodayTraining` render Schedule/Coaching/Workout/Attendance.
- [x] `TodayNutrition` render Nutrition editor.
- [x] `TodayJournal` render Wellness/Habit/comment/timeline.
- [x] `ProgressPage` hỗ trợ embedded mode trong dashboard shell.
- **Verify**: module navigation E2E, wellness persistence, nutrition view, progress view pass.

### Task 5: Chuyển route consumers và giữ compatibility

- [x] Thêm nested `/dashboard` routes lazy-loaded và protected ở layout boundary.
- [x] `/today`, `/today/:dateKey`, `/progress` redirect replace sang canonical dashboard path.
- [x] Header và homepage CTA dùng `/dashboard`; notification deep links cũ vẫn resolve.
- **Verify**: anonymous destination, legacy redirects, header/notification route E2E pass.

### Task 6: Full UI/impact/cleanup verification

- [x] Re-trace mọi `/today`, `/progress`, dashboard query consumer.
- [x] Chạy lint, client units, build, focused/full E2E, secret/data-boundary và diff check.
- [x] Cập nhật Plan 006 và plan index bằng kết quả thật.

### Task 7: Hợp nhất công cụ khách hàng vào Dashboard

- [x] Menu tài khoản khách hàng chỉ còn một entry `Dashboard học viên`; Ví, Thông báo, Tài khoản,
  hồ sơ khách hàng và Đăng xuất vẫn là global account actions.
- [x] Bốn section trong module Tập luyện dùng CTA rõ nghĩa cho Đăng ký giờ tập, Giáo án online,
  Giáo án tập luyện và Lịch sử check-in; bổ sung shortcut Hệ thống bài tập.
- [x] Module Dinh dưỡng bổ sung shortcut Tính TDEE và tạo meal plan; public Tools dropdown không đổi.
- [x] E2E khóa menu tài khoản không còn route công cụ cũ và chứng minh mọi route vẫn truy cập được
  từ đúng module Dashboard trên desktop.
- **Verify**: `npx playwright test e2e/today-dashboard.spec.js --project=chromium` và
  `npm run lint --prefix client` đều exit 0.

## Test Plan

- Unit: deterministic route builder/parser; không thêm production export chỉ để test.
- E2E desktop/mobile:
  - `/dashboard` mở overview và sidebar/bottom nav đúng active item.
  - Overview không render Wellness/Nutrition full form.
  - Module switch giữ `dateKey`; journal mutation vẫn persist sau reload.
  - Legacy `/today/:dateKey` và `/progress` redirect canonical.
  - Anonymous `/dashboard` đi login và giữ destination.
  - Private route giữ `noindex`, không horizontal overflow, axe không critical violation.
- Không cần server test mới vì API/authorization/data contract không đổi.

## Done Criteria

- [x] Customer click “Kế hoạch hôm nay” vào product dashboard shell, không vào vertical mega-page.
- [x] Overview ngắn, không chứa editor Wellness/Nutrition/Habit.
- [x] 5 navigation items hoạt động trên desktop/mobile và giữ ngày giữa module routes.
- [x] Existing writes/read models không đổi semantics và không duplicate canonical source.
- [x] Legacy deep links, notification, Header và homepage CTA tương thích.
- [x] Loading, onboarding, partial error, invalid date, mobile và accessibility vẫn được bảo vệ.
- [x] Client lint/unit/build và full E2E pass; không có debug/unused import.
- [x] Menu tài khoản khách hàng không còn duplicate tool links; sáu công cụ cũ có lối vào rõ ràng
  trong module Dashboard tương ứng.

## Verification Results

- Customer tool consolidation regression: PASS, 12/12 (auth + Today Dashboard).
- TDD route utility: RED đúng vì module chưa tồn tại; GREEN `1 file / 6 tests`.
- `npm run lint --prefix client` → PASS.
- `npm run test:unit:client` → PASS, 29 files / 167 tests.
- Focused homepage + dashboard E2E → PASS, 11/11.
- Focused dashboard + accessibility E2E → PASS, 13/13.
- `npm run build --prefix client` → PASS; Vite build, 87/87 prerender và bundle budget PASS.
  Dynamic sitemap sources timeout trong môi trường local nên generator giữ sitemap hiện có 780 routes;
  `/dashboard`, `/today` và `/progress` không xuất hiện trong sitemap.
- `npm run test:e2e` → PASS, 61/61.
- `npm run security:secrets` và `npm run security:data-boundaries` → PASS.
- Route/deep-link re-trace và `git diff --check` → PASS.

## Impact Results

- API/schema/auth/retention: không đổi.
- Header và homepage dùng `/dashboard` canonical.
- Server notification/deep links tiếp tục phát `/today` hoặc `/progress`; compatibility redirect đã
  được browser test chứng minh tới đúng canonical route.
- Global HT Assistant launcher bị ẩn trong dashboard để không chặn mobile bottom navigation.
- Customer Dashboard vẫn private, `noindex`, không tham gia sitemap/prerender.

## STOP Conditions

- Cần thay API/schema/auth để render shell hoặc module.
- React Router nesting làm mất auth destination hoặc legacy deep link không thể redirect an toàn.
- Module split tạo hai query key/source of truth cho cùng ngày.
- Cần sửa file ngoài scope mà không có dependency path cụ thể.
- Cùng root cause fail ba vòng sau sửa có căn cứ.

## Maintenance Notes

- `/dashboard` là customer presentation shell, không phải domain/backend mới.
- Khi thêm module, cập nhật utility navigation, desktop/mobile nav, routes và E2E cùng lúc.
- Legacy redirects chỉ được xóa sau khi notification records và external bookmarks hết thời hạn hỗ trợ.
