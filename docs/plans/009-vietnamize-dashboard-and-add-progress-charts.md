# Plan 009: Việt hóa Customer Dashboard và trực quan hóa tiến trình

> **Hướng dẫn thực thi**: Chỉ thay lớp trình bày phía client. Không đổi API, schema, công thức tiến trình,
> quyền truy cập hoặc dữ liệu đã lưu. Mọi biểu đồ phải có trạng thái trống và text/table thay thế.
>
> **Drift check**: Worktree đang có thay đổi chưa commit trong `CustomerDashboardLayout.jsx`,
> `TodayDashboard.jsx` và `TodayDashboardDayLayout.jsx`; chỉ sửa đúng chuỗi hiển thị hoặc khu vực được nêu,
> không ghi đè phần thay đổi hiện có.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — UI-only nhưng chạm nhiều màn hình và dữ liệu sức khỏe
- **Depends on**: 003F, 006, 008
- **Category**: feature | ui | accessibility
- **Planned at**: 2026-07-30
- **Status**: IMPLEMENTED / VERIFIED

## Why This Matters

Customer Dashboard dành cho người Việt nhưng đang trộn nhiều nhãn tiếng Anh như Wellness, Habit,
Progress Hub, Activity timeline, meal entry và Weekly Check-in. Trang tiến trình cũng mới trình bày dữ liệu
bằng bảng nên khó nhận ra xu hướng cân nặng và trạng thái sức khỏe trung bình. Bản sửa phải Việt hóa copy
hiển thị, đồng thời trực quan hóa đúng dữ liệu API hiện có mà không suy diễn y khoa hoặc tạo xu hướng giả.

## Current State

- `client/src/pages/progress/ProgressSummary.jsx`
- `client/src/pages/progress/ProgressWellnessOverview.jsx`
- `client/src/pages/progress/WeightTrendChart.jsx` render mức thực hiện, trung bình wellness và cân nặng bằng
  progress/table; chưa có line chart.
- `server/src/services/progressReadModel.service.js` đã trả `weightTrend.points[]` theo tuần và chỉ trả average
  cho wellness. Vì vậy cân nặng có thể vẽ xu hướng; wellness chỉ phù hợp biểu đồ thanh tổng hợp 0–10.
- `client/src/pages/today-dashboard/**`, `client/src/pages/progress/**` và
  `client/src/layouts/CustomerDashboardLayout.jsx` còn copy tiếng Anh ở nhiều trạng thái.
- API/service/model/backend không cần thay đổi.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Focused tests | `cd client && npx vitest run src/pages/progress/__tests__/progressCharts.test.js src/pages/progress/__tests__/progress.test.js` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client units | `npm run test:unit:client` | all pass |
| Client build | `npm run build --prefix client` | exit 0 |

## Scope

**In scope**:

- `client/src/pages/progress/progressCharts.js`
- `client/src/pages/progress/__tests__/progressCharts.test.js`
- `client/src/pages/progress/ProgressSummary.jsx`
- `client/src/pages/progress/ProgressWellnessOverview.jsx`
- `client/src/pages/progress/WeightTrendChart.jsx`
- `client/src/pages/progress/ProgressPage.jsx`
- `client/src/pages/progress/CoachingActivityPanel.jsx`
- `client/src/pages/progress/WeeklyCheckinCard.jsx`
- `client/src/pages/progress/progressPresentation.js`
- `client/src/pages/today-dashboard/TodayDashboard.jsx`
- `client/src/pages/today-dashboard/TodayJournal.jsx`
- `client/src/hooks/useTodayDashboardDay.js`
- `client/src/pages/today-dashboard/TodayDashboardDayLayout.jsx`
- `client/src/pages/today-dashboard/TodayDashboardSections.jsx`
- `client/src/pages/today-dashboard/ActivityTimeline.jsx`
- `client/src/pages/today-dashboard/WellnessHeader.jsx`
- `client/src/pages/today-dashboard/HabitCard.jsx`
- `client/src/pages/today-dashboard/CreateHabitForm.jsx`
- `client/src/pages/today-dashboard/QuickMealLogger.jsx`
- `client/src/pages/today-dashboard/NutritionCard.jsx`
- `client/src/pages/today-dashboard/TodayNutrition.jsx`
- `client/src/pages/today-dashboard/dailyNutrition.js`
- `client/src/pages/today-dashboard/dailyHabits.js`
- Các unit test tương ứng của dinh dưỡng và thói quen
- `client/src/layouts/CustomerDashboardLayout.jsx`
- `server/src/services/progressSources.service.js`
- `server/src/services/progressReadModel.service.js`
- `server/src/controllers/__tests__/progress.integration.test.js`
- `docs/operations/runbooks/today-dashboard-phase4.md`
- `docs/plans/009-vietnamize-dashboard-and-add-progress-charts.md`
- `docs/plans/README.md`

**Out of scope**:

- Schema, migration, route và response shape; filter nguồn Daily Journal và formulaVersion của read model được phép cập nhật.
- Dịch enum/field kỹ thuật trong payload và source code khi không hiển thị cho người dùng.
- Suy luận mục tiêu y khoa hoặc đánh giá tốt/xấu từ chỉ số trung bình.
- Thêm chart library mới; dùng SVG/HTML semantic nhỏ gọn để tránh tăng bundle.

## Steps

### Step 1: Khóa phép tính biểu đồ bằng TDD

Tạo utility thuần cho scale/point/label cân nặng và danh sách chỉ số sức khỏe 0–10. Cover dữ liệu trống,
một điểm, nhiều điểm, miền cân nặng bằng nhau và giá trị null.

**Verify**: focused Vitest fail trước implementation, pass sau implementation.

### Step 2: Việt hóa toàn bộ copy Customer Dashboard trong scope

Thay chuỗi hiển thị tiếng Anh bằng tiếng Việt tự nhiên; giữ nguyên key, enum, query key và tên hàm kỹ thuật.

**Verify**: `rg` không còn các nhãn đã khóa trong JSX thuộc scope.

### Step 3: Thêm biểu đồ sức khỏe và xu hướng cân nặng

Wellness dùng progress bars 0–10 và số ngày ghi; ngủ/nước/bước chân là số tóm tắt riêng. Cân nặng dùng SVG
line chart responsive, có label, figure caption và bảng chi tiết trong disclosure.

**Verify**: focused tests, lint và manual responsive/static accessibility review.

### Step 4: Re-trace và chạy gates

Chạy client unit, lint, build, `git diff --check`, secret/data-boundary scan; cập nhật plan/index bằng kết quả thật.

### Step 5: Chốt Nhật ký là nguồn gửi dữ liệu và đổi trang thành Tổng quan

Chỉ Daily Journal có status submitted mới được đưa vào read model. Đổi nhãn UI thành Tổng quan, đặt Nhật ký trước
Tổng quan, chuyển Báo cáo tuần về Nhật ký và giữ khung biểu đồ khi chưa có dữ liệu.

**Verify**: regression RED/GREEN cho draft/submitted, full client/server tests, lint, build và UI check.
## Test Plan

- Utility: empty/single/multi/equal-domain weight points; wellness chỉ nhận average hữu hạn trong 0–10.
- Existing progress presentation tests tiếp tục pass.
- UI: loading/error/empty không đổi; chart có accessible name và dữ liệu text/table thay thế.
- Build chứng minh SVG/JSX và lazy route không lỗi bundle.

## Done Criteria

- [x] Không còn copy Wellness/Habit/Progress Hub/Activity timeline/meal entry/Weekly Check-in trên UI trong scope.
- [x] Cân nặng có line chart từ `weightTrend.points`, không vẽ khi trống.
- [x] Sức khỏe trung bình có biểu đồ thanh 0–10 và không trộn ngủ/nước/bước chân vào cùng thang đo.
- [x] API route/schema/response shape không đổi; progress-v2 chỉ tổng hợp Daily Journal đã gửi.
- [x] Focused/full client tests, lint, build và security gates pass.
- [x] Không ghi đè thay đổi có sẵn của user.

## STOP Conditions

- API không còn trả shape `wellness` hoặc `weightTrend.points` như Current State.
- Muốn vẽ wellness theo thời gian nhưng backend không cung cấp điểm theo ngày.
- Cần cài chart dependency mới hoặc sửa backend để hoàn thành UI cơ bản.
- Verification cùng root cause fail ba vòng.

## Verification Evidence

- Focused Vitest: 4 file, 15 test pass.
- Full client unit: 32 file, 176 test pass.
- Client lint: pass.
- Client build: pass; Vite build, prerender 784/784 route và bundle budget đều hoàn tất ở lần kiểm tra gần nhất.
- UI check theo phạm vi component đã sửa: không có anti-pattern bị cấm; biểu đồ có accessible name, trạng thái trống và bảng/text thay thế.
- Secret scan và repository data-boundary scan: pass.
- git diff --check: pass; chỉ có cảnh báo line-ending LF/CRLF trên Windows.

## Follow-up 2026-07-30

- Luôn hiển thị đủ 5 chỉ số thang 0–10; giá trị thiếu hiện “Chưa có dữ liệu” thay vì ẩn cả dòng.
- Navigation cuối cùng là Nhật ký trước Tổng quan; tên route/query key kỹ thuật progress được giữ để không breaking.
- Báo cáo tuần được chuyển từ Tổng quan sang Nhật ký và lấy tuần của ngày người dùng đang xem.
- Progress refetch khi mount, khi quay lại tab, khi nhật ký đã gửi thay đổi và có nút cập nhật thủ công.
- Read model progress-v2 chỉ lấy Daily Journal submitted; draft không ảnh hưởng sức khỏe, dinh dưỡng hoặc thói quen.
- Biểu đồ sức khỏe giữ các thanh trống; biểu đồ cân nặng giữ khung trục và giải thích nguồn dữ liệu khi chưa có điểm.
- Focused client/server: 4 file, 16 test pass.
- Full client: 32 file, 176 test pass; full server: 75 file, 332 test pass.
- Client lint, scoped UI check, production build/prerender 784/784 và bundle budget pass.
## Maintenance Notes

- Nếu sau này cần wellness trend theo ngày, mở rộng read model bằng series riêng và test privacy/response size trước.
- Tên field kỹ thuật tiếng Anh là contract nội bộ; yêu cầu Việt hóa chỉ áp dụng copy người dùng nhìn thấy.
