# Plan 067: Hoàn thiện lưu thực đơn, bữa ăn phát sinh và workspace HLV

> **Hướng dẫn thực thi**: Thực hiện từng behavior slice, chạy focused test sau mỗi
> slice và dừng nếu contract ownership/CSRF hoặc nguồn dữ liệu canonical khác mô tả
> bên dưới. Không chạy migration, seed, cleanup, deploy hoặc ghi staging/production.
>
> **Drift check**: Trước mỗi slice, đọc `git status --short` và diff của các file
> in-scope. Working tree đang dirty do các task trước; không reset hoặc ghi đè thay đổi
> không thuộc Plan 067.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 003C, 003D, 012, 064
- **Category**: feature
- **Planned at**: 2026-08-25
- **Status**: IMPLEMENTED / LOCAL VERIFIED — FULL SERVER RUNNER BLOCKED

## Why This Matters

Luồng hiện tại trộn hành vi tạo mới và revision của Saved Meal Plan, để CTA lưu xa
bảng gợi ý và đưa version kỹ thuật lên UI. Today Nutrition chỉ liệt kê tên món, còn
bữa phát sinh không có tên bữa và không giới hạn riêng số lần sửa. Workspace HLV có
ba tab và hai lớp card làm nghiệp vụ khó quét nhanh.

Khi hoàn tất, người dùng phân biệt rõ lưu mới với chỉnh một thực đơn đã lưu, nhìn thấy
macro của từng món, ghi bữa phát sinh có cấu trúc và chỉ sửa một lần; HLV có workspace
hai tab với card tiến trình thống nhất.

## Current State

- `client/src/pages/MealPlan/SavedMealPlans.jsx` sở hữu create/revise/archive và đặt
  nút lưu ở header của danh sách.
- `client/src/pages/MealPlan/MealTable.jsx` render đúng năm cột cho dữ liệu generator.
- `server/src/models/SavedMealPlan.js` lưu immutable lineage/version và title tối đa
  100 ký tự; route/service đã có ownership, CSRF, idempotency và optimistic conflict.
- `client/src/pages/today-dashboard/PlannedMealExecution.jsx` chỉ join label thực phẩm.
- `DailyJournal.nutrition.entries` đã lưu snapshot và `recordedAt`, nhưng manual entry
  chỉ có description và chưa có edit counter.
- `TrainerClientWorkspace.jsx` có ba tab; `TrainerClientOverview.jsx` còn status card;
  `ProgressSummary.jsx` đặt header bên ngoài navigation card.

## Product Decisions

1. `Lưu thực đơn hiện tại` luôn gọi create và tạo lineage mới.
2. `Chỉnh sửa thực đơn` preview snapshot cũ; `Đổi thực đơn khác` tạo gợi ý mới và chỉ
   sau đó mới bật revision save.
3. Rename dùng revision endpoint hiện có với cùng snapshot, giữ lịch sử và ownership.
4. Title mutation mới dài 1–30 ký tự, kiểm profanity theo boundary token; backend quyết định.
5. Manual meal thêm `mealName` và server-only `editCount`; document cũ dùng fallback,
   không backfill.
6. Legacy recipe entry vẫn đọc được nhưng UI không cho tạo mới.
7. Version/revision chỉ là metadata kỹ thuật, không hiển thị cho khách hàng/HLV.

## Expected File Surface

- Meal Plan UI/util/i18n: `client/src/pages/MealPlan/`,
  `client/src/utils/savedMealPlan.js`, `client/src/i18n/locales/vi/mealplan.json`.
- Saved Meal Plan API/model: `server/src/models/SavedMealPlan.js`, validation và
  `server/src/services/savedMealPlanSnapshot.service.js`.
- Today Nutrition: `QuickMealLogger.jsx`, `QuickMealHistory.jsx`,
  `PlannedMealExecution.jsx`, `NutritionCard.jsx`, `dailyNutrition.js`.
- Daily Journal: model, DTO, nutrition canonicalization, validation và integration tests.
- Trainer: workspace helpers/components/tests, `ProgressSummary.jsx`, weekly review copy.
- Rules/spec/plan: canonical docs được cập nhật trong cùng change.

## Tasks và Verification Gates

### 1. Saved Meal Plan end-to-end

- RED: test title 31 ký tự/từ cấm bị từ chối; helper build revision từ snapshot; UI
  phân biệt create và revise.
- GREEN: giới hạn schema/validation/service, inline rename, edit preview, CTA lưu mới
  ở footer bảng và dialog điều hướng Dashboard.
- Verify: focused client Saved Meal Plan tests và
  `savedMealPlan.integration.test.js`.

### 2. Trình bày bữa theo kế hoạch

- RED: component test yêu cầu gram, P/C/F, kcal từng món và tổng P/C/F.
- GREEN: render trực tiếp snapshot `food.nutrition`/`meal.totals`; không gọi API mới.
- Verify: focused client component test.

### 3. Bữa ăn phát sinh có một lần cập nhật

- RED: unit test create/update adapter; integration test canonical fallback, tăng
  `editCount` một lần và reject lần hai.
- GREEN: thêm field additive/default, validation allowlist, DTO, canonicalization và UI
  Add/Save/Cancel/Update.
- Verify: daily nutrition client + server integration tests.

### 4. Workspace HLV và progress card

- RED: helper test canonical/legacy tabs; journal copy/client name; absence của status,
  comment thread và version copy; ProgressSummary one-card contract.
- GREEN: hai tab, tasks composition, overview cleanup, aligned metrics, progress card.
- Verify: trainer/progress focused tests.

### 5. Integrated QA và cleanup

- Run `npm run test:unit:client` và `npm run test:unit:server`.
- Run `npm run lint --prefix client` và `npx vite build` trong `client/`.
- Run `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high`.
- Run `npm run agents:validate` và `git diff --check`.
- Review Standards, Spec/Contract và Security/Operations; xóa import/debug code do
  Plan 067 tạo ra.

## Compatibility and Data Safety

- Không đổi route hoặc CSRF/auth middleware.
- Saved plan cũ title dài hơn 30 ký tự vẫn đọc được; mutation tiếp theo yêu cầu tên mới.
- Daily Journal cũ thiếu `mealName`/`editCount` được DTO/service fallback, không migration.
- `version`, `revision`, `expectedVersion` và `expectedRevision` vẫn giữ trong API.
- Không ghi local/staging/production database ngoài MongoDB Memory Server của tests.

## STOP Conditions

- Dừng nếu route mutation không còn ownership/CSRF hiện có.
- Dừng nếu cần sửa/xóa/backfill document thật hoặc thay kiểu field hiện có.
- Dừng nếu generator không thể báo thành công/thất bại mà phải bật sai nút revision.
- Dừng sau ba vòng cùng một verification fail mà chưa xác định được root cause.

## Success Criteria

- Lưu mới, rename và chỉnh thực đơn có CTA/trạng thái đúng, title policy được backend enforce.
- Dashboard hiển thị đầy đủ gram/macro/kcal từ snapshot.
- Bữa phát sinh có hai field, Save/Cancel và chỉ cập nhật được một lần.
- Workspace HLV chỉ hai tab, overview/progress/journal/copy đúng yêu cầu.
- Không còn version/revision user-visible trên các surface đã sửa.
- Focused/full verification có evidence thật; không deploy hoặc data write.

## Verification Evidence — 2026-08-25

- Client unit: 118 files, 547 tests pass.
- Server focused integration: Saved Meal Plan + Daily Journal Nutrition,
  2 files, 16 tests pass; bao phủ rename replay và chặn client tự gửi `editCount`.
- E2E Chromium: form bữa ăn phát sinh và thực đơn đã lưu ở browser context mới,
  2/2 case pass khi dùng hai local webserver được quản lý riêng.
- Client lint, Vite production compile, UI regression gate, secret scan,
  repository data-boundary scan, agent validation và `git diff --check` pass.
- Full server runner không tạo được evidence cuối: ba lần chạy đều thực thi hàng trăm
  test xanh rồi tiến trình Vitest thoát mã 1 mà không báo test failure hoặc stack trace
  kết luận. Đây là blocker của runner/runtime local; không đổi kết quả focused suites.
