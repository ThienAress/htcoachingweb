# Spec: Trung tâm quản lý học viên cho HLV và admin

## Objective

Tách dữ liệu quản lý chung của học viên khỏi Hệ thống Coach Online. HLV/admin quản lý tổng quan,
mục tiêu sức khỏe và thói quen hằng ngày tại một workspace theo học viên; Coach Online chỉ còn nội
dung tập từ xa, video và phản hồi. Giáo án tập luyện hiển thị mục tiêu sức khỏe dạng tóm tắt và dẫn
về workspace để chỉnh sửa.

## Assumptions đã được duyệt

1. Baseline Plan 012 không đổi schema/API; quyết định 2026-07-31 bên dưới bổ sung mutation update Habit và enum command additive.
2. Workspace dùng route protected /trainer/clients/:clientId và dùng chung cho trainer/admin.
3. Danh sách client canonical là GET /api/coaching/trainer/clients: trainer chỉ thấy client active được
   gán cho mình, admin thấy mọi client active.
4. Mục tiêu sức khỏe vẫn là dữ liệu version theo client; không gắn vào từng WorkoutPlan.
5. Coaching Habit vẫn theo ngày và cần date selector trong workspace.
6. Coach Online không hiển thị TrainerClientOverview, TrainerHabitManager hoặc
   TrainerWellnessTargetCard sau thay đổi.

## User flows

### Theo dõi sức khỏe từ Nghiệp vụ huấn luyện

1. HLV/admin mở `Theo dõi sức khỏe` trong nhóm Nghiệp vụ huấn luyện.
2. Route `/trainer/health` tái sử dụng danh sách client canonical từ
   `GET /api/coaching/trainer/clients`; HLV chỉ nhận client thuộc Order approved,
   còn buổi và có `trainerId` là chính họ; admin giữ phạm vi toàn hệ thống.
3. Chọn một client mở `/trainer/health/clients/:clientId`.
4. Workspace giữ hai tab `Tổng quan` và `Theo dõi và hỗ trợ`; các công cụ mục tiêu,
   thói quen, báo cáo và cảnh báo được sắp theo thứ tự trong tab thứ hai.
5. Route cũ `/trainer/clients/:clientId` tiếp tục hoạt động để không phá deep link.

### HLV/admin quản lý học viên

1. Vào Khách của tôi.
2. Chọn Quản lý tại một client active.
3. Chọn ngày Việt Nam cần xem.
4. Chuyển giữa `Tổng quan` và `Theo dõi và hỗ trợ`.
5. Có quick actions sang Giáo án tập luyện hoặc Coach Online khi phù hợp.

### HLV soạn giáo án

1. Chọn client trong modal tạo giáo án hoặc mở giáo án đã có.
2. Xem tóm tắt mục tiêu hiện tại: ngủ, nước, bước.
3. Chọn `Chỉnh sửa mục tiêu` để mở đúng client tại
   `/trainer/health/clients/:clientId?tab=tasks`.
4. WorkoutPlan không lưu bản sao mục tiêu.

## UI states và accessibility

- Product surface dùng slate với cyan/emerald restrained; không gradient text hoặc nested cards mới.
- Workspace có loading, not-found/forbidden, empty và retry states.
- Tab là button có aria-pressed; action/link có focus-visible và vùng bấm tối thiểu 44px.
- Tên Coaching Habits được Việt hóa thành Thói quen hằng ngày.
- Mobile hiển thị client cards; desktop hiển thị table có cột hành động.

## Technical boundaries

- Route page mới phải lazy-load trong App.jsx và nằm dưới AdminRoute + TrainerLayout.
- Component chỉ gọi API qua service hiện có.
- Không sửa JWT/CSRF core; Habit update giữ CSRF, limiter, service ownership fail-closed và chỉ mở rộng enum command additive.
- Không tạo public route nên không sửa sitemap/prerender/SEO.
- Không chạy migration hoặc ghi dữ liệu staging/production.

## Success criteria

- Coach Online không còn ba module quản lý chung.
- Trainer/admin mở được đúng workspace của client active từ Khách của tôi.
- Menu Nghiệp vụ huấn luyện có entry `Theo dõi sức khỏe` cho admin/HLV; mobile
  có entry tương đương.
- `/trainer/health` chỉ render danh sách client do backend trả về; frontend không
  nhận hoặc tự lọc dữ liệu của HLV khác.
- Giáo án chỉ đọc target summary và deep-link sang health workspace để chỉnh sửa.
- Overview và target giữ contract hiện tại; Habit giữ ownership hiện tại và bổ sung update definition có optimistic version.
- Tạo/chỉnh WorkoutPlan thấy target summary và link đúng client.
- Admin navigation không còn gắn nhãn Huấn luyện học viên nhưng dẫn vào Coach Online.
- Focused tests, client lint, Vite compile và diff check có evidence thật.
## Quyết định đơn giản hóa thao tác — 2026-07-31

- Trainer sidebar chỉ giữ `Khách của tôi` và `Lịch tập khách hàng`; các route Công cụ
  vẫn tồn tại nhưng không còn entry trong sidebar này.
- Wellness Target giữ version nội bộ nhưng UI không hiển thị version. Khi chưa có target,
  nút là `Lưu mục tiêu`; khi đã có target, nút là `Cập nhật mục tiêu`.
- Habit giữ immutable version nội bộ nhưng UI không hiển thị `vN` và không còn pause/resume.
- Habit trainer-created có hai thao tác chính: `Cập nhật` và `Xóa`. Cập nhật phát hành
  latest version cho học viên ngay; Xóa chuyển latest version sang archived để bảo toàn
  Daily Journal completion history.
- Archived Habit không có màn hình quản lý trong scope hiện tại và không xuất hiện trong
  danh sách active của trainer/học viên.

## Tinh gọn workspace HLV — 2026-08-25

- Workspace chỉ còn hai tab: `Tổng quan` và `Theo dõi và hỗ trợ`.
  Ngay đầu tab theo dõi/hỗ trợ hiển thị lời nhắc HLV kiểm tra báo cáo mỗi ngày;
  các khối bên dưới theo đúng thứ tự `Mục tiêu sức khỏe`, `Thói quen hằng ngày`,
  `Báo cáo khách hàng`, rồi `Cần chú ý`.
- Deep link cũ `tab=wellness` hoặc `tab=habits` được chuyển về tab việc cần làm;
  helper tạo link mới dùng `tab=tasks` để không phá bookmark cũ.
- Tổng quan bỏ khối `Hôm nay và tiến trình`, trạng thái phần trăm hôm nay,
  `Trao đổi về báo cáo tuần` và `Cần chú ý`; dữ liệu báo cáo tuần và tiến trình còn
  lại giữ nguyên contract/ownership.
- `Báo cáo khách hàng` được chuyển khỏi Tổng quan vào sau `Thói quen hằng ngày`,
  với hai mục điều hướng `Sức khỏe` và `Dinh dưỡng`; mỗi lần chỉ mở một báo cáo,
  tương tự navigation của Tiến trình.
- `Cần chú ý` được đặt cuối tab, ngay sau `Báo cáo khách hàng`. Heading và icon của
  `Mục tiêu sức khỏe`, `Thói quen hằng ngày`, `Báo cáo khách hàng` và `Cần chú ý`
  dùng cùng một cấp kích thước để thể hiện đây là các khối ngang hàng.
- Mô tả dưới `Mục tiêu sức khỏe` dùng copy hướng hành động
  `Đặt mục tiêu và gửi cho khách hàng`.
- Báo cáo sức khỏe không đưa ngày vào heading. Khi không có shared note, copy là
  `Khách hàng không ghi chú.`.
- Heading, mô tả và ba lựa chọn của `Tiến trình cơ thể và tập luyện` nằm trong cùng
  một card. Khi mở một lựa chọn, hành vi quay lại và focus management hiện có được giữ.
- Version/revision kỹ thuật không xuất hiện trong copy dành cho HLV; các field vẫn được
  gửi ngầm để optimistic concurrency hoạt động.

## Báo cáo dinh dưỡng thực tế — 2026-08-25

- Tab `Theo dõi và hỗ trợ` đặt báo cáo dinh dưỡng trong mục `Dinh dưỡng` của card
  `Báo cáo khách hàng`; mục vẫn xuất hiện khi chưa gửi để HLV thấy trạng thái rõ ràng.
- Card chỉ hiển thị bữa `Đã ăn`, snapshot thực phẩm/lượng gram/macro thực tế và tổng
  kcal, protein, carb, fat của các bữa đó; dữ liệu không thay đổi theo Saved Meal Plan
  sau thời điểm gửi.
- HLV nhận thông báo không chứa số liệu nhạy cảm; deep link mở đúng khách hàng, ngày và
  mục `Dinh dưỡng` trong card `Báo cáo khách hàng` tại `tab=tasks`.
- Nếu khách chỉ gửi nutrition nhưng Daily Journal wellness còn draft, API không trả
  wellness, shared note hoặc habit completion draft cho HLV.
- `Cần chú ý` chỉ tạo cảnh báo sức khỏe khi stress >= 8, đau mỏi >= 8 hoặc mức đau >= 7;
  mức trung bình và hơi đau không tạo cảnh báo tự động.

## Lịch thói quen và báo cáo tuần — 2026-08-26

- Form `Giao thói quen mới` có tên, mô tả và bảy nút chọn ngày; phía trên lịch hiển
  thị rõ khoảng Thứ Hai–Chủ Nhật của tuần chứa ngày workspace đang chọn.
- HLV chọn tối thiểu một ngày. Lịch được gửi qua service hiện có và API chuẩn hóa
  khoảng thành đúng một tuần; không thêm endpoint, model hoặc index.
- Danh sách HLV hiển thị mô tả và lịch để có thể kiểm tra trước khi cập nhật/xóa.
- Khu vực báo cáo tuần giữ số đo học viên ở chế độ chỉ đọc và bỏ toàn bộ form phản hồi,
  đánh giá, retry lệnh nhận xét; endpoint review cũ vẫn tồn tại để tương thích.
- Heading tiến trình dành cho cả học viên và HLV dùng copy
  `Tiến trình cơ thể và tập luyện`.
