# Spec: Mục tiêu sức khỏe cá nhân do HLV thiết lập

## Objective

Cho phép HLV hoặc admin đặt ba mục tiêu cá nhân cho từng học viên: giấc ngủ, nước uống và số bước. Học viên
vẫn tự nhập số thực tế hằng ngày; năng lượng, đói, căng thẳng, đau mỏi và mức đau chỉ là tự đánh giá, không
có target và không bị chấm đạt/rớt. Mục tiêu chỉ dùng để so sánh trực quan, không thay đổi công thức hoàn thành
Nhật ký `today-v2`.

## Assumptions đã được duyệt

1. Cả ba mục tiêu đều bắt buộc khi lưu: `sleepHours`, `waterMl`, `steps`.
2. Mục tiêu có hiệu lực ngay theo ngày `Asia/Ho_Chi_Minh`; không cho sửa ngược lịch sử.
3. Mỗi thay đổi tạo version bất biến; request có idempotency và optimistic concurrency.
4. HLV chỉ thao tác học viên có Order active được gán cho mình; admin thao tác mọi học viên có Order active.
5. Collection mới không cần backfill. Migration chỉ tạo/verify index và không được tự chạy trên staging/production.
6. Dữ liệu tham gia export/delete/retention của Customer Dashboard.

## API contract

- `GET /api/wellness-targets/me?dateKey=YYYY-MM-DD`: học viên đọc target có hiệu lực cho ngày.
- `GET /api/wellness-targets/trainer/clients/:clientId`: HLV/admin đọc version mới nhất.
- `PUT /api/wellness-targets/trainer/clients/:clientId`: lưu version mới với
  `{ expectedVersion, requestId, targets, note }`.
- `GET /api/wellness-targets/privacy/export`: học viên export các version của mình.
- `DELETE /api/wellness-targets/privacy`: xóa dữ liệu mục tiêu của chính học viên theo confirmation.

Response target gồm `_id`, `clientId`, `version`, `effectiveFromDateKey`, `targets`, `note`, `updatedByRole`,
`createdAt`, `updatedAt`. Không trả command fingerprint hoặc actor ID cho học viên.

## Validation

- `sleepHours`: số từ 1 đến 24, cho phép bước 0.5 trên UI.
- `waterMl`: số nguyên từ 250 đến 20.000 trong API/database; form HLV nhập theo lít từ 0,25 đến 20 và quy đổi sang ml trước mutation.
- `steps`: số nguyên từ 100 đến 200.000.
- `note`: tối đa 500 ký tự.
- Mutation bắt buộc JWT, trainer/admin access, CSRF, rate limit và UUID v4 request ID.

## UI

- HLV/admin: /trainer → chọn **Quản lý** tại học viên → tab **Mục tiêu sức khỏe** trong
  /trainer/clients/:clientId.
- Admin có entry **Huấn luyện học viên** dẫn tới /trainer, không dẫn vào Coach Online.
- Giáo án tập luyện chỉ hiển thị target summary read-only và deep link về workspace; không lưu bản sao target.
- Coach Online không chứa target, habit hoặc tổng quan tiến trình dùng chung.
- Học viên: “Sức khỏe hôm nay” hiển thị target và tỷ lệ actual/target cho ba số khách quan.
- Không dùng màu/copy để kết luận y khoa; dữ liệu thiếu không biến thành 0; target không ảnh hưởng thanh hoàn thành.
## Privacy và retention

- Version có `retentionExpiresAt`, được đồng bộ cùng coaching lifecycle hiện có.
- Account deletion xóa mọi version trong transaction.
- Retention sweep mặc định dry-run, enforcement yêu cầu flag và admin actor như các Today collection khác.
- Audit chỉ lưu version và tên field thay đổi, không log giá trị sức khỏe.

## Success criteria

- Trainer/admin lưu, reload và nhận đúng version; stale `expectedVersion` trả 409; request lặp là idempotent.
- Trainer không thể đọc/sửa học viên không thuộc phạm vi; admin có thể thao tác học viên active.
- Học viên thấy target đúng theo ngày và vẫn tự nhập actual.
- Công thức Nhật ký 8 × 10% + submitted 20% không đổi.
- API validation, privacy lifecycle, migration index, client presentation, full tests/lint/build/security gates có evidence.
