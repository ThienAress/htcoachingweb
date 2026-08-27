# Plan 069: Lập lịch thói quen theo tuần và tinh gọn báo cáo HLV

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 062, 065, 068
- **Category**: feature
- **Planned at**: 2026-08-26
- **State**: DONE / LOCAL VERIFIED

## Why This Matters

HLV cần giao một thói quen có mô tả và lịch cụ thể trong tuần thay vì mặc định áp
dụng hằng ngày vô thời hạn. Học viên phải nhìn thấy thói quen trong đúng tuần và
chỉ có thể ghi nhận vào các ngày HLV chọn. Đồng thời, khu vực báo cáo HLV không
cần form nhận xét tuần vì hai bên trao đổi trực tiếp.

## Current State

- `CoachingHabit` đã có `description` và `schedule` gồm `daysOfWeek`,
  `startDateKey`, `endDateKey`; không cần đổi schema hoặc migration.
- `coachingHabit.service.js` đang ghi đè mọi thói quen do HLV tạo thành bảy
  ngày/tuần, bắt đầu hôm nay và không có ngày kết thúc.
- `CreateHabitForm.jsx` ẩn mô tả/lựa chọn ngày trong trainer mode.
- `HabitCard.jsx` ẩn hoàn toàn thói quen không được lên lịch trong ngày.
- `TrainerWeeklyReview.jsx` đang cho HLV nhập phản hồi và điểm đánh giá.
- Progress Hub dùng heading `Tiến trình cơ thể và huấn luyện`.

## Scope

### In scope

- Cho HLV nhập mô tả tối đa 500 ký tự và chọn ít nhất một ngày trong tuần.
- Lịch HLV là đúng một tuần Thứ Hai–Chủ Nhật chứa `dateKey` của workspace.
- Hiện thói quen trong tuần trên nhật ký; ngày không được chọn có trạng thái khóa.
- Bỏ form nhận xét/đánh giá tuần nhưng giữ báo cáo số đo ở chế độ chỉ đọc.
- Đổi copy thành `Tiến trình cơ thể và tập luyện`, gồm SEO và test liên quan.

### Out of scope

- Không xóa endpoint hoặc dữ liệu `trainerReview` cũ để giữ tương thích.
- Không migration/backfill thói quen đã tồn tại.
- Không ghi dữ liệu local, staging hoặc production trong quá trình kiểm tra.

## Steps

### Step 1: Lập lịch thói quen HLV trong một tuần

**Behavior**: HLV tạo/cập nhật thói quen với mô tả và các ngày đã chọn; API giữ
nguyên lịch Thứ Hai–Chủ Nhật thay vì ghi đè thành lịch vô hạn.

**Files**: habit form/adapters, Coaching Habit service/snapshot/read model và tests.

**Verify**: focused client unit + Coaching Habit integration tests pass.

### Step 2: Hiện trạng thái khóa đúng ngày trong nhật ký

**Behavior**: Trong tuần áp dụng, học viên thấy thói quen ở mọi ngày; các nút chỉ
hoạt động vào ngày được chọn. Server tiếp tục từ chối mutation ngoài lịch.

**Files**: `HabitCard.jsx`, DTO/read service, tests.

**Verify**: component/unit tests và integration test `HABIT_NOT_SCHEDULED` pass.

### Step 3: Tinh gọn báo cáo tuần và đổi thuật ngữ tiến trình

**Behavior**: HLV chỉ xem số đo báo cáo tuần; không còn textarea/rating/save.
Progress Hub và SEO dùng `Tiến trình cơ thể và tập luyện`.

**Files**: trainer weekly report, progress page/summary, specs và tests.

**Verify**: focused client tests, lint, build và UI regression gate pass.

## Test Plan

- Adapter: tính đúng Thứ Hai–Chủ Nhật, giữ mô tả, sort ngày và preserve schedule khi edit.
- API: thói quen HLV giữ selected weekdays và chuẩn hóa mọi input thành one-week range.
- Read model: phân biệt `scheduledToday` và `withinScheduleRange`.
- UI: ngày không được chọn vẫn render nhưng disabled; report tuần không còn action nhận xét.
- Copy: không còn `Tiến trình cơ thể và huấn luyện` trong runtime/tests thuộc scope.

## Done Criteria

- [x] HLV nhập được tên, mô tả và chọn ngày áp dụng trong tuần rõ ràng.
- [x] API giữ lịch đúng tuần và server từ chối completion ngoài lịch.
- [x] Học viên thấy trạng thái khóa vào ngày không được chọn.
- [x] Báo cáo tuần HLV là read-only, không còn chức năng nhận xét.
- [x] Heading/SEO tiến trình dùng thuật ngữ mới.
- [x] Focused tests, lint, build, UI gate và `git diff --check` đạt.

## STOP Conditions

- Dừng nếu cần thay đổi type/xóa field hoặc backfill dữ liệu thật.
- Dừng nếu lịch tuần từ code hiện tại không dùng quy ước Thứ Hai = 0.
- Dừng nếu phải bỏ endpoint review và gây breaking change ngoài UI được yêu cầu.

## Maintenance Notes

- Dữ liệu thói quen HLV cũ có `endDateKey: null` vẫn được đọc theo contract cũ;
  khi HLV cập nhật, UI sẽ ghi lịch tuần mới.
- Backend vẫn là nguồn canonical cho quyền ghi completion; disabled state frontend
  chỉ là lớp trình bày.

## Verification Evidence

- Focused client: 24/24 tests pass; full client: 558/558 tests pass.
- Focused server: 12/12 tests pass; full server: 984/984 tests pass.
- Client lint, UI regression gate, agent validation và `git diff --check` pass.
- Release build thoát mã 0; Vite compile và bundle budget pass. Prerender không
  render được route trong môi trường kiểm tra vì thiếu `VITE_API_URL` production
  và mạng Google Fonts bị chặn, không liên quan các trang dashboard private.
- Focused Playwright assertion cho Progress pass trên Chromium; runner local cần
  dừng thủ công sau khi đã báo pass vì web server không tự kết thúc trên Windows.
- Code review độc lập: PASS, không có finding trong phạm vi Plan 069.
