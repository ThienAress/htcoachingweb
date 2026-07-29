# Today Dashboard Release B runbook

## Feature flags

- `TODAY_JOURNAL_WRITES_ENABLED=true` cho phép khách hàng đủ điều kiện ghi nhật ký.
- `TODAY_JOURNAL_RETENTION_DAYS` mặc định 365 ngày, chỉ nhận số nguyên từ 30 đến 3650.
- `TODAY_JOURNAL_RETENTION_ENFORCE=true` mới cho phép retention sweep xóa dữ liệu.

Không bật write hoặc retention enforcement trước khi migration index Release B đã được
verify và đội vận hành đã xác nhận đúng môi trường.

## Retention dry-run và enforcement

Gọi `POST /api/ops/privacy/daily-journals/retention` bằng admin đã xác thực và CSRF hợp lệ.
Body `{ "enforce": false }` chỉ đếm tối đa 100 candidate và không xóa dữ liệu. Body
`{ "enforce": true }` chỉ xóa khi retention enforcement đã được bật; mỗi journal bị xóa
cùng revisions trong transaction và tạo audit log.

Sweep loại mọi candidate đang có approved Order còn buổi, sau đó re-check lần nữa trong
transaction trước khi xóa. Deadline cũ sau renewal vì vậy không đủ để xóa journal.

Không chạy endpoint enforcement trên production nếu chưa có change approval riêng.

## Retention sync failure

Alert `daily_journal_retention_sync_failure` nghĩa là Order lifecycle đã được ghi thành
công nhưng deadline journal chưa đồng bộ. API Order vẫn trả kết quả thật của mutation để
tránh client retry một thay đổi đã commit.

1. Kiểm tra structured log event `daily_journal.retention_sync_failed` và trường `source`.
2. Xác nhận MongoDB hoạt động bình thường và các index Release B đã được verify.
3. Không tự suy đoán ngày kết thúc coaching. Đọc các timestamp canonical trên Order:
   `cancelledAt`, `completedAt`, `sessionsExhaustedAt`.
4. Sửa nguyên nhân, sau đó thực hiện lại đúng lifecycle transition hoặc chạy công cụ
   reconciliation đã được review riêng. Retention sweep không tự tạo deadline còn thiếu.
5. Chỉ reset/đóng alert sau khi đã kiểm tra `retentionExpiresAt` của journal liên quan.
