# Spec: Báo cáo coaching, điều hướng tiến trình và thông báo đúng ngữ cảnh

## Objective

Tinh gọn báo cáo tuần thành dữ liệu cơ thể có thể đo, làm thang tự đánh giá sức khỏe dễ hiểu,
tách Tiến trình thành các chức năng độc lập và bảo đảm thông báo đưa HLV tới đúng học viên/ngày.
Mọi copy mới ưu tiên tiếng Việt, trừ thuật ngữ chuyên ngành không có cách Việt hóa tự nhiên.

## Product contract

### Báo cáo tuần

- Form mới chỉ gồm `Cân nặng (kg)`, `Vòng eo (cm)`, `Tỷ lệ mỡ cơ thể (%)` và
  `Tỷ lệ cơ xương (%)`; cả bốn là số đo tùy chọn.
- Không hiển thị hoặc ghi mới `Năng lượng`, `Mức độ bám kế hoạch`, `Điều làm tốt trong tuần`,
  `Khó khăn gặp phải`, `Ghi chú thêm` và khối diễn giải `Mức hiện tại`.
- Document cũ vẫn giữ và đọc được field legacy; không migration/xóa dữ liệu thật trong release này.
- Sau khi gửi, form chuyển read-only. Khách có đúng một lần bấm `Cập nhật` để mở form,
  nhập lý do và lưu thay đổi; sau lần đó form khóa vĩnh viễn cho kỳ đó.
- `correctionCount` do server quản lý, mặc định `0`, tối đa `1`; optimistic concurrency,
  idempotency, edit window và revision audit hiện có vẫn được giữ.
- Form cho phép gửi khi chỉ nhập một phần hoặc chưa nhập số đo nào. Nếu còn mục trống, UI phải
  xác nhận một lần, nêu đúng số lượng và tên mục; chọn `Vẫn gửi` vẫn submit bình thường.

### Thang cảm nhận sức khỏe

- UI không liệt kê 10 con số. Mỗi cảm nhận có ba nhãn theo ngữ nghĩa riêng, ví dụ năng lượng:
  `Cạn kiệt`, `Bình thường`, `Rất sung sức`.
- Lựa chọn mới lưu giá trị đại diện `3`, `6`, `9`; riêng mức thấp của `Mức đau` lưu `0` để
  biểu đạt không đau.
- Khi đọc dữ liệu cũ, `1–4` hiển thị mức thấp, `5–7` mức giữa, `8–10` mức cao; `0` của mức đau
  thuộc mức thấp. API/schema 0–10 hiện có không đổi.
- Icon cạnh `Mục tiêu do HLV thiết lập` phải căn giữa theo hàng tiêu đề.
- Toàn bộ chỉ số sức khỏe là optional. Xác nhận thiếu chỉ tính năm cảm nhận `Năng lượng`,
  `Cảm giác đói`, `Căng thẳng`, `Đau mỏi`, `Mức đau`; ba số Giấc ngủ/Nước uống/Số bước không
  tạo cảnh báo. UI vẫn cho phép gửi và trạng thái khóa/cập nhật một lần sau gửi không đổi.

### Tiến trình

- Landing Tiến trình dùng một card lớn duy nhất có heading `Tiến trình cơ thể và tập luyện`, mô tả
  nguồn dữ liệu và ba lựa chọn con: `Mức độ thực hiện`, `Tiến trình cơ thể`, `Sức khỏe theo ngày`.
- Chọn card nào chỉ render nội dung của chức năng đó, có hành động quay lại danh sách.
- Cùng component/semantics được dùng cho khách và trong `Tổng quan` của HLV; range selector chỉ
  xuất hiện khi nội dung đã chọn cần khoảng thời gian.
- `Tiến trình cơ thể` đọc đủ bốn số đo đã submit/reviewed: cân nặng, vòng eo, tỷ lệ mỡ cơ thể và
  tỷ lệ cơ xương; mỗi metric vẫn giữ current/delta/history và không bịa giá trị khi thiếu.
- Không đổi công thức read model hoặc ownership; missing data không được biến thành zero.

### Thông báo

- Thông báo nhật ký/báo cáo gửi tới HLV phải có tên khách hàng trong title.
- Nhật ký ngày deep-link tới `/trainer/clients/:clientId` với đúng `date` và anchor/section nhật ký;
  báo cáo tuần deep-link tới đúng workspace khách hàng và phần báo cáo tuần.
- Nhật ký ngày và báo cáo dinh dưỡng của HLV thêm `tab=tasks` vì hai báo cáo nằm trong
  `Theo dõi và hỗ trợ`; báo cáo tuần tiếp tục ở `Tổng quan`. Client nâng link cũ thiếu
  tab khi người dùng bấm thông báo để notification đã lưu trước đây không bị hỏng.
- Thông báo gửi tới khách deep-link tới đúng ngày/module tương ứng.
- Các title user-visible dùng tiếng Việt: `Báo cáo tuần`, `đã nhận xét`, `đã cập nhật`; không dùng
  `Weekly Check-in`, `review`, `notification` hoặc `in-app` trong UI tiếng Việt.
- Deep-link phải là internal path an toàn; backend ownership hiện có vẫn quyết định quyền đọc.
- Với nhật ký ngày và báo cáo tuần gửi/cập nhật khi còn thiếu, backend tự tính `missingFields` từ
  document đã lưu. Notification chỉ chứa key allowlist của trường thiếu, không chứa giá trị sức khỏe;
  frontend hiển thị danh sách nhãn tiếng Việt cho HLV.

### Phân cấp Nhật ký

- Bỏ hai câu giải thích kỹ thuật về mục tiêu sức khỏe và cách tính chuỗi thói quen; mô tả báo cáo tuần
  rút gọn còn `Mỗi tuần gửi một báo cáo`.
- Bốn khối lớn `Sức khỏe hôm nay`, `Thói quen hôm nay`, `Báo cáo tuần`, `Hoạt động trong ngày` dùng
  cùng cấp heading nổi bật. `Mục tiêu do HLV thiết lập` là heading con nhỏ hơn và có kích thước explicit.

## Language policy

- UI mặc định dùng tiếng Việt cho label, heading, empty/error/loading state, toast và thông báo.
- Chỉ giữ tiếng Anh cho thuật ngữ chuyên ngành phổ biến khi bản dịch làm giảm độ rõ, ví dụ
  `sets`, `reps`, `tempo`, `RPE`, `RIR`.
- Không đổi identifier, API field, enum, route, log/metric key, test fixture hoặc locale tiếng Anh
  chỉ để Việt hóa.
- Phạm vi rà soát của release là các surface được chạm và notification catalog liên quan; audit
  toàn bộ sản phẩm ngoài phạm vi phải được xử lý theo finding riêng để tránh đổi copy thiếu ngữ cảnh.

## Schema and compatibility

- `WeeklyCheckin.body` thêm optional `bodyFatPercent` và `skeletalMusclePercent`, đều `1–80`.
- `WeeklyCheckin` thêm `correctionCount` integer `0–1`, default `0`; document cũ tương thích và
  không cần backfill vì Mongoose default được áp dụng khi đọc/ghi.
- Các field legacy vẫn tồn tại trong schema trong compatibility window nhưng UI mới không gửi.
- DTO thêm `correctionCount`; patch allowlist thêm hai số đo mới. Routes/controller/envelope không đổi.
- `InAppNotification` thêm optional `missingFields` là mảng key allowlist, default `[]`; document cũ
  tương thích, không cần migration/backfill và không đổi index.
- Không chạy migration, seed, cleanup, local/staging/production data write trong implementation.

## Success criteria

- [x] Weekly form chỉ còn bốn số đo mới và khóa/cập nhật đúng một lần do server enforce.
- [x] Dữ liệu WeeklyCheckin cũ vẫn đọc được; invalid body composition và correction thứ hai bị từ chối.
- [x] Wellness chỉ hiện ba nhãn dễ hiểu, lưu đúng representative value và hiển thị đúng dữ liệu legacy.
- [x] Customer và trainer chọn một mục Tiến trình thì chỉ thấy nội dung mục đó.
- [x] Thông báo có tên khách, dùng tiếng Việt và mở đúng khách/ngày/section.
- [x] Rule/skill UI trỏ về một policy ưu tiên tiếng Việt canonical.
- [x] Focused tests, client/server tests phù hợp, lint/build, UI regression và security boundaries có evidence.
- [x] Nhật ký ngày và báo cáo tuần xác nhận khi gửi thiếu nhưng vẫn cho submit.
- [x] HLV thấy đúng danh sách trường thiếu trong notification mà không nhận giá trị sức khỏe.
- [x] Bốn heading lớn trong Nhật ký nhất quán; heading mục tiêu là cấp con rõ ràng.
- [x] Landing Tiến trình chỉ còn một card lớn chứa heading, mô tả và ba lựa chọn con.

## Boundaries

- Always: server-authoritative correction limit, ownership/IDOR, CSRF, idempotency, audit revision,
  accessible focus/disabled/loading/error states.
- Ask first: migration/backfill hoặc ghi dữ liệu staging/production; thay đổi nguồn đo thành InBody/provider.
- Never: xóa field/dữ liệu legacy, suy đoán mỡ/cơ từ cân nặng, hoặc đưa PII ngoài tên khách được phép vào title.
