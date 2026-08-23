# Spec: Biểu đồ Tiến trình cơ thể theo báo cáo tuần

## Objective

Giúp khách hàng và HLV trả lời nhanh ba câu hỏi cho từng số đo cơ thể: giá trị hiện tại là bao nhiêu,
đã thay đổi thế nào trong khoảng đang xem và tuần nào chưa có dữ liệu. Bốn số đo vẫn dùng nguồn
`WeeklyCheckin` canonical; release này chỉ đổi cách đọc và trình bày, không thêm đường ghi hoặc bảng dữ liệu mới.

## Product contract

### Chỉ số và bố cục

- `Tiến trình cơ thể` hiển thị bốn lựa chọn: `Cân nặng`, `Vòng eo`, `Tỷ lệ mỡ cơ thể`,
  `Tỷ lệ cơ xương`.
- Chỉ một lựa chọn được active và chỉ một biểu đồ lớn được render tại một thời điểm.
- Mỗi lựa chọn luôn nêu giá trị hiện tại và thay đổi trong khoảng đang chọn; missing giữ là
  `Chưa có dữ liệu`, không biến thành `0`.
- Biểu đồ dùng đường thẳng theo thời gian. Không dùng đường cong nội suy vì có thể tạo cảm giác tồn tại
  số đo chưa được ghi.

### Khoảng thời gian

- Riêng `Tiến trình cơ thể` dùng `30 ngày`, `3 tháng` (`90` ngày) và `6 tháng` (`180` ngày).
- `Mức độ thực hiện` và `Sức khỏe theo ngày` tiếp tục dùng `7`, `30`, `90` ngày.
- Khi chuyển section, UI phải đưa khoảng không tương thích về giá trị hợp lệ gần nhất:
  `7 → 30` khi vào Tiến trình cơ thể và `180 → 90` khi rời Tiến trình cơ thể.
- API tiến trình của khách và HLV chấp nhận `180`; giá trị khác allowlist vẫn trả validation error.

### Nguồn và tính trung thực

- Mỗi điểm chỉ lấy từ báo cáo tuần `submitted` hoặc `reviewed`; draft không được tính.
- `weekStartDateKey` là ngày đầu kỳ báo cáo trong tháng, không phải thời điểm đo chính xác.
- Nếu một kỳ báo cáo trong khoảng không có số đo của chỉ số đang chọn, đường bị ngắt tại kỳ đó.
- Trục Y tự thu phóng theo dữ liệu nhìn thấy và có padding; không bắt đầu từ `0` nếu điều đó làm mất xu hướng.
- Đường tham chiếu duy nhất trong release này là `Lần đầu` của khoảng đang xem.
- Chưa thêm goal line, phần trăm hoàn thành mục tiêu hoặc đánh giá tăng/giảm là tốt/xấu vì chưa có
  nguồn mục tiêu canonical cho đủ bốn chỉ số.

### Tương tác và accessibility

- Desktop: rê chuột trên vùng biểu đồ cho biết ngày, giá trị và thay đổi so với lần đầu.
- Keyboard/touch: từng điểm đo có vùng focus/tap đủ dùng và hiển thị cùng chi tiết.
- `0 điểm`: empty state; `1 điểm`: hiển thị điểm và không bịa delta; từ `2 điểm`: hiển thị đường và delta.
- SVG có accessible title/description, trục nêu rõ quantity/unit; màu không phải tín hiệu duy nhất.
- Mobile không tạo horizontal page scroll, không làm chữ SVG co nhỏ dưới mức đọc được.

## Technical contract

- Giữ route và envelope hiện có:
  - `GET /api/progress?days=<30|90|180>`
  - `GET /api/progress/trainer/clients/:clientId?days=<30|90|180>`
  - Trainer overview tiếp tục nhận `days` cùng allowlist mở rộng.
- Không thêm dependency chart mới; dùng React + SVG hiện có.
- Read model giữ shape `bodyProgress.<metric>.{unit,current,delta,series}` và `formulaVersion` hiện tại.
- Loader phải đủ giới hạn để không cắt mất khoảng 6 tháng cộng phần lookback hiện hữu.
- Không migration, backfill, seed hoặc ghi dữ liệu môi trường thật.

## Success criteria

- [x] Bốn chỉ số dùng một selector và một biểu đồ lớn duy nhất.
- [x] Khoảng 30/90/180 hoạt động cho khách và HLV; section khác vẫn giữ 7/30/90.
- [x] Missing period ngắt đường, không nối xuyên và không xuất hiện giá trị `0` giả.
- [x] Tooltip/detail hoạt động với pointer, keyboard và touch; empty/single-point rõ ràng.
- [x] Focused client/server tests, full client tests, lint, compile build và UI regression có evidence.
- [x] Không migration/data write, không ảnh hưởng production.

## Boundaries

- Always: giữ ownership/rate limit/cache hiện có; server validate range; UI dùng tiếng Việt.
- Ask first: thêm mục tiêu số đo, đổi nguồn dữ liệu hoặc thêm dependency chart.
- Never: suy đoán mục tiêu, đánh giá y khoa, biến missing thành zero hoặc đọc draft vào biểu đồ.
