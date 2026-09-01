# Audit phản hồi submit/mutation — 2026-08-29

## Phạm vi và phương pháp

- Quét toàn bộ `client/src` cho `<form>`, `onSubmit`, `type="submit"`, `useMutation`,
  `mutate`/`mutateAsync`, toast, inline status và `alert`.
- Inventory có 39 module production chứa form và 63 module production dùng
  `useMutation` tại thời điểm quét.
- Đối chiếu callback giữa component con và owner trước khi kết luận thiếu; không yêu cầu
  mỗi file con tự phát toast nếu owner của command đã làm việc đó.

## Kết quả đã xử lý

- Dùng một `ToastContainer` global; bỏ container trùng trong Admin layout, tăng thời gian
  đọc và khóa z-index trên modal/drawer.
- Bổ sung success/error toast cho các nhóm submit chủ động: Practice Center, booking,
  analytics/Radar, F1 create/intake/forecast, HT Fitness+/gói HLV, review bài tập/công thức,
  Saved Meal Plan, báo cáo tuần, sức khỏe ngày, dinh dưỡng ngày, thói quen HLV/khách hàng,
  trao đổi coaching, tùy chọn thông báo, AI Memory và các luồng export.
- Thay toàn bộ `window.alert`/`alert` còn lại trong production client bằng toast ở các luồng
  user-triggered; validation và confirm phù hợp vẫn giữ tại chỗ.
- Practice Center có test gọi trực tiếp `onSuccess`/`onError` của mutation để chứng minh
  callback phát toast, thay vì chỉ kiểm tra source có câu lệnh.

## Exemption có chủ đích

Các module sau không tự phát success toast vì kết quả chính đã hiển thị trực tiếp hoặc
command được owner phát toast; đây không phải submit im lặng:

- `ChatPanel.jsx`, `ChatWidget.jsx`: câu trả lời stream là primary result; chỉ lỗi ảnh phát toast.
- `F1CreateCustomerForm.jsx`, `F1CustomerDetail.jsx`, `F1/intake/useIntake.js`: owner page/wizard
  phát toast sau kết quả server.
- `RecentOrdersPanel.jsx`, `RecipeExplorer.jsx`: form chỉ lọc/query, không mutation.
- `SavedMealPlanTitleEditor.jsx`, `CreateHabitForm.jsx`, `PlannedMealExecution.jsx`,
  `QuickMealLogger.jsx`, `PracticeCenterContent.jsx`: component con giao command cho owner đã
  phát success/error toast.
- `TdeeForm.jsx`: phép tính local hiển thị ngay kết quả, không có server mutation.
- `useMealPlanAccess.js`: quota accounting nội bộ; toast nằm ở flow tạo Meal Plan.
- `useMealPlanPreferences.js`: hook trả promise; page owner phát toast save/clear.
- `SkillRadarPage.jsx`: form con sở hữu toast theo từng preview/create command.
- `RecipeDetail.jsx`: bookmark optimistic phản ánh ngay trên nút và cache; không toast để tránh spam.
- Notification read-on-navigation giữ im lặng; action bulk `Đọc tất cả` có toast.

## Rule canonical

Contract mới nằm tại `.agents/rules/code/tech_patterns.md`, Pattern 8. Rule yêu cầu loading,
server-confirmed success toast và error toast cho mutation chủ động; đồng thời cấm double
toast và loại trừ autosave/background/optimistic toggle có phản hồi trực tiếp.
