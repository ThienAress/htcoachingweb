# Plan 015: Mở luồng Theo dõi sức khỏe từ Nghiệp vụ huấn luyện

> **Hướng dẫn thực thi**: Giữ route cũ tương thích, tái sử dụng API và component
> hiện có, không copy dữ liệu vào WorkoutPlan. Nếu ownership backend không còn
> fail-closed theo `trainerId` thì dừng trước khi mở entry navigation.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED — protected navigation và deep link theo client
- **Depends on**: 012, 014
- **Category**: feature | navigation | security | tests
- **Planned at**: 2026-07-31
- **Status**: DONE / LOCAL VERIFIED

## Why This Matters

Wellness Target là dữ liệu client-scoped độc lập với WorkoutPlan nhưng entry hiện
tại bị ẩn trong luồng quản lý học viên/giáo án. HLV cần một entry nghiệp vụ rõ
ràng để tìm đúng học viên, xem tổng quan, target và habit; giáo án chỉ cần context
read-only và một đường dẫn tới nơi chỉnh sửa canonical.

## Current State

- `client/src/sections/Header/Header.jsx:186-239` tạo nhóm Nghiệp vụ huấn luyện
  cho admin/HLV nhưng chưa có `Theo dõi sức khỏe`.
- `client/src/pages/trainer/Dashboard.jsx:16-179` đã tải danh sách qua
  `getTrainerClients` và có đủ loading/error/empty/search/mobile states.
- `client/src/App.jsx:253-265` đã lazy-load `TrainerDashboard` và
  `TrainerClientWorkspace` dưới protected `TrainerLayout`.
- `client/src/pages/trainer/WorkoutPlanClientTargetSummary.jsx` đọc
  `WellnessTarget` và không mutate/copy vào WorkoutPlan.
- `server/src/controllers/coaching.controller.js:178-214` giới hạn HLV theo
  Order `approved`, `sessions > 0`, `trainerId = req.user.id` và dedupe client.
- `server/src/services/wellnessTargetAccess.service.js:32-47` kiểm tra lại
  ownership khi đọc/ghi target; trainer ngoài phạm vi nhận 403.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused client tests | `npm.cmd run test:unit:client -- --run src/pages/trainer/__tests__/trainerClientWorkspace.test.js` | exit 0 |
| Ownership integration | `npm.cmd run test:unit:server -- --run src/controllers/__tests__/trainerOverview.integration.test.js src/controllers/__tests__/wellnessTarget.integration.test.js` | exit 0 |
| Client lint | `npm.cmd run lint --prefix client` | exit 0 |
| Vite compile | `.\node_modules\.bin\vite.cmd build` từ `client/` | exit 0 |
| Diff check | `git diff --check` | exit 0 |

## Scope

**In scope**

- `client/src/App.jsx`
- `client/src/sections/Header/Header.jsx`
- `client/src/layouts/TrainerLayout.jsx`
- `client/src/pages/trainer/Dashboard.jsx`
- `client/src/pages/trainer/TrainerClientWorkspace.jsx`
- `client/src/pages/trainer/trainerClientWorkspace.helpers.js`
- `client/src/pages/trainer/WorkoutPlanClientTargetSummary.jsx`
- `client/src/pages/trainer/__tests__/trainerClientWorkspace.test.js`
- `client/src/i18n/locales/vi/common.json`
- `client/src/i18n/locales/en/common.json`
- `docs/specs/trainer-client-workspace.md`
- `docs/plans/015-expose-health-tracking-workflow.md`
- `docs/plans/README.md`

**Out of scope**

- Backend route/controller/service/schema changes.
- Migration, seed hoặc ghi dữ liệu staging/production.
- Copy WellnessTarget vào WorkoutPlan payload/document.
- Thay đổi semantics của Overview, Habit, Progress hoặc WellnessTarget.
- Public SEO, sitemap và prerender.

## Steps

### Step 1: Khóa route và deep-link contract bằng test

Mở rộng helper test để chứng minh health workspace path encode client ID, giữ tab
và date hợp lệ, đồng thời route legacy không đổi.

**Verify**: focused client test fail trước implementation và pass sau implementation.

### Step 2: Thêm protected health routes và entry navigation

Thêm `/trainer/health` và `/trainer/health/clients/:clientId` dưới
`AdminRoute + TrainerLayout`. Thêm entry cho desktop dropdown, mobile account
actions và Trainer sidebar; dùng translation key mới.

**Verify**: client lint và source trace chỉ ra cả admin/HLV đều có entry.

### Step 3: Tái sử dụng client picker/workspace theo health context

`TrainerDashboard` nhận context từ pathname để đổi heading, CTA và health deep
link nhưng tiếp tục dùng `getTrainerClients`. `TrainerClientWorkspace` giữ back
link đúng surface và ba tab hiện có.

**Verify**: không có API call mới; loading/error/empty/search/mobile states còn đủ.

### Step 4: Chuyển WorkoutPlan summary sang canonical health deep link

Giữ summary read-only và đổi CTA sang route
`/trainer/health/clients/:clientId?tab=wellness`.

**Verify**: helper unit test và search xác nhận WorkoutPlan không chứa target mutation.

### Step 5: Re-trace và verification

Chạy ownership integration, focused/full client regression phù hợp, ESLint,
Vite compile, UI anti-slop scan và `git diff --check`. Cập nhật plan thành DONE
với evidence thật.

## Test Plan

- Unit: legacy workspace path không đổi.
- Unit: health workspace path encode ID và giữ `wellness`/date.
- Unit: invalid tab/date fail closed về route health hợp lệ.
- Integration: client picker chỉ trả Order approved còn buổi của trainer hiện tại.
- Integration: trainer ngoài assignment không đọc/ghi Wellness Target.
- Source/UI: desktop, mobile và sidebar đều có entry; tab có focus/loading/empty.

## Done Criteria

- [x] Admin/HLV thấy `Theo dõi sức khỏe` trong Nghiệp vụ huấn luyện.
- [x] `/trainer/health` chỉ dùng danh sách server-authoritative hiện có.
- [x] Chọn client mở workspace có Tổng quan, Mục tiêu sức khỏe và Thói quen.
- [x] Giáo án chỉ đọc summary và mở đúng target editor canonical.
- [x] Route `/trainer/clients/:clientId` cũ vẫn hoạt động.
- [x] Ownership integration, client tests, lint, Vite và diff check pass.
- [x] Không có migration, API/schema change, debug log hoặc secret mới.

## Verification Evidence

- Focused TDD: test health path fail trước implementation, sau đó `6/6` pass.
- Client regression: `35` files, `199/199` tests pass.
- Ownership integration: `2` files, `14/14` tests pass.
- ESLint client: pass.
- Vite production compile: pass; chỉ còn cảnh báo chunk size hiện có.
- UI check scoped cho Header, TrainerLayout, Dashboard, Workspace và WorkoutPlan
  summary: pass; không thêm AI-slop pattern, touch target mới đạt tối thiểu 44px,
  có hover/focus states và responsive list đã được tái sử dụng.
- `git diff --check`: pass; chỉ có cảnh báo line-ending CRLF của working tree.

## STOP Conditions

- `GET /api/coaching/trainer/clients` trả client của HLV khác.
- Direct health workspace URL bỏ qua ownership check ở detail API.
- Cần copy WellnessTarget vào WorkoutPlan để hiển thị summary.
- Cần ghi đè diff chưa commit ngoài các symbol đã nêu trong scope.

## Maintenance Notes

- Health workspace là nơi edit canonical; mọi consumer mới chỉ đọc hoặc deep-link.
- Nếu sau này cần dashboard cảnh báo cross-client, nó phải tiếp tục lấy client
  scope từ backend, không fetch toàn bộ rồi lọc ở frontend.
- Giữ route legacy đến khi telemetry xác nhận không còn deep link cũ.
