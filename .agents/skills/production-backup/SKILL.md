---
name: production-backup
description: Tạo, sao lưu off-device hoặc xác minh backup production HTCOACHINGWEB. Dùng khi tạo logical backup/snapshot, upload recovery archive, chạy restore drill hoặc cập nhật backup-readiness evidence.
---

# Production Backup

Đọc và tuân thủ `docs/operations/runbooks/backup-restore-runbook.md` trước mọi
thao tác. Skill này không tự cấp quyền đọc production, upload dữ liệu, mua/nâng
gói Atlas hay restore vào production; vẫn phải tuân thủ approval boundary hiện có.

## Off-device destination bắt buộc

- Google Drive owner canonical là **`hoangthiengym1999@gmail.com`**.
- Destination là `My Drive/htcoachingweb/production-backups`.
- Trước mỗi upload, xác minh email đầy đủ trên account chip của Google Drive.
  Nếu email không khớp tuyệt đối, kể cả `hoangthiengym99@gmail.com`, phải dừng
  trước khi chọn file và yêu cầu chuyển đúng tài khoản.
- Chỉ upload encrypted `.7z` archive. Không upload DPAPI key, recovery password,
  database URI, private manifest, checksum hay plaintext archive lên Drive.
- Recovery password được lưu riêng trong Bitwarden bằng item theo backup ID và
  bật master-password re-prompt. Không lưu archive trong Bitwarden.

## Điều kiện xác minh

Chỉ đặt `offDeviceRecoveryVerified=true` khi cùng một backup ID đã pass tất cả:

1. Archive tải lên đúng Drive canonical và destination nêu trên.
2. Archive được tải lại từ Google Drive; byte size và SHA-256 khớp private
   manifest, AES integrity pass.
3. Recovery password dùng cho off-device drill được lấy lại từ Bitwarden, không
   dùng local DPAPI key thay cho bằng chứng independent key custody.
4. Archive được restore vào MongoDB cô lập; collection count, document count,
   per-collection counts, canonical BSON hash và semantic index hash đều khớp.
5. Production nhận zero writes; plaintext, instance và file tải tạm được dọn sau
   verification.

Atlas Free không có Cloud Backup/PITR. Giữ
`continuousRecoveryAvailable=false` cho tới khi owner duyệt paid tier/policy,
provider báo backup active và point-in-time restore drill trên target cô lập pass.
