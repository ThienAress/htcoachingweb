# Spec: Biểu đồ Mức độ thực hiện và Sức khỏe trung bình

## Objective

Giúp khách hàng và HLV đọc nhanh mức hoàn thành kế hoạch cùng xu hướng sức khỏe từ dữ liệu tiến trình
canonical hiện có. Giao diện phải có một header tiến trình dùng chung, một hành động làm mới duy nhất và
mỗi section chỉ còn một card nội dung không lặp tiêu đề hay điều khiển.

## Tech Stack liên quan

- React 19, Tailwind CSS 4 và TanStack Query 5 trong `client/`.
- React + SVG/CSS native; không thêm chart dependency.
- API progress hiện có; không đổi schema, response envelope hoặc `formulaVersion`.

## Product contract

### Mức độ thực hiện

- Dùng một biểu đồ thanh ngang chung trên trục `0–100%` cho lịch tập với HLV, giáo án, huấn luyện
  hằng ngày, bữa ăn theo kế hoạch và thói quen được giao.
- Mỗi thanh luôn hiển thị phần trăm và phân số `đã hoàn thành/tổng áp dụng`.
- Chỉ số chưa được áp dụng trong khoảng đang xem phải hiện `Chưa áp dụng`, không biến thành `0%`.
- Không dùng line chart vì read model hiện chỉ có aggregate của cả khoảng, chưa có time series compliance.

### Sức khỏe trung bình

- Đổi label section thành `Sức khỏe trung bình`; tiêu đề không chứa ngày.
- Có tám selector: Giấc ngủ, Nước uống, Số bước, Năng lượng, Cảm giác đói, Căng thẳng, Đau mỏi và
  Mức đau. Chỉ một metric active và một biểu đồ lớn được render tại một thời điểm.
- Biểu đồ dùng `wellness.daily`, đường thẳng theo ngày và một đường tham chiếu `Trung bình` của những
  ngày có dữ liệu trong khoảng.
- Ngày không có giá trị phải ngắt đường; không nội suy và không biến missing thành `0`.
- Giấc ngủ, nước uống và số bước dùng trục Y tự scale theo unit. Năm cảm nhận dùng miền `0–10`.
- Empty state và single-point state phải rõ ràng; pointer, touch và keyboard đều đọc được ngày, giá trị.

### Điều khiển và bố cục

- Header `Tiến trình cơ thể và tập luyện` luôn hiện trên landing và khi mở section.
- Chỉ header chung có `Cập nhật dữ liệu`. Section không render thêm nút làm mới.
- Mỗi section tích hợp nút quay lại, tiêu đề và range control vào card nội dung; không có toolbar card
  đứng riêng lặp lại tiêu đề.
- Range giữ contract hiện tại: body `30/90/180`, compliance và wellness `7/30/90`.
- Cùng component được dùng cho trang khách hàng và tổng quan HLV.

### Nhật ký sức khỏe

- Placeholder của năm select cảm nhận là `Chưa chọn`.
- Chỉ hiển thị một dòng hướng dẫn chung `Chọn mô tả gần nhất với cảm nhận của bạn.` thay vì lặp dưới
  từng select.

## Cấu trúc file bị ảnh hưởng

- `client/src/pages/progress/`: reports, chart model/component và tests.
- `client/src/pages/progress/ProgressPage.jsx`: một hành động làm mới ở header chung.
- `client/src/pages/trainer/TrainerClientOverview.jsx`: cùng nguyên tắc làm mới cho HLV.
- `client/src/pages/today-dashboard/WellnessFields.jsx`: placeholder và helper dùng chung.
- `docs/specs/`, `docs/plans/`: contract, plan và evidence.

## Testing Strategy

- RED/GREEN cho chart geometry: daily gap, average line, score domain và responsive width.
- Component tests: một header, một card section, một chart active, label mới và không có title ngày.
- Wellness form test: năm placeholder `Chưa chọn`, đúng một helper line.
- Focused client tests, full client tests, ESLint, Vite compile, UI regression và `git diff --check`.

## Boundaries

- Always: giữ missing khác zero, copy tiếng Việt, keyboard focus, responsive 360px và source read-only.
- Ask first: thêm compliance time series, đổi API/read model hoặc thêm chart dependency.
- Never: suy diễn ngày chưa ghi, đánh giá y khoa, thay schema hoặc ghi dữ liệu môi trường thật.

## Success Criteria

- [x] Compliance dùng một biểu đồ thanh chung, chính xác phần trăm/phân số và missing state.
- [x] Wellness dùng một chart active cho tám metric, daily gap và average reference đúng.
- [x] Không còn tiêu đề sức khỏe kèm ngày hoặc toolbar card lặp.
- [x] Chỉ còn một nút `Cập nhật dữ liệu` trong header tiến trình dùng chung.
- [x] Năm select cảm nhận dùng `Chưa chọn` và một helper line duy nhất.
- [x] Client tests, lint, compile và UI regression có evidence; không backend/schema/data write.

## Open Questions

Không còn. User đã duyệt biểu đồ thanh cho compliance, biểu đồ xu hướng cho wellness và một vị trí
làm mới duy nhất trước khi implementation bắt đầu.
