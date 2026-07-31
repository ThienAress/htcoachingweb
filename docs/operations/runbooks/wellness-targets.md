# Wellness Targets operations runbook

## Feature flags

- `TODAY_WELLNESS_TARGET_WRITES_ENABLED=true`: cho phép HLV/admin tạo version mục tiêu mới.
- `TODAY_WELLNESS_TARGET_RETENTION_ENFORCE=true`: cho phép retention sweep thực sự xóa dữ liệu hết hạn.
- `TODAY_WELLNESS_TARGET_RETENTION_ACTOR_ID`: admin actor dùng cho retention enforcement.

Tắt write flag chỉ khóa mutation; client và HLV vẫn đọc được target hiện có. Không bật retention enforcement nếu chưa
xác nhận đúng database và admin actor.

## Development local

- Bật `TODAY_WELLNESS_TARGET_WRITES_ENABLED=true` và `TODAY_HABIT_WRITES_ENABLED=true` trong config development; không tự áp dụng cho production.
- MongoDB local phải chạy single-node replica set vì Wellness Target và Coaching Habit dùng transaction.
- UI nhập nước theo lít; API/database tiếp tục dùng `waterMl` để tương thích dữ liệu cũ.

## Migration

`server/src/migrations/20260730-wellness-targets.js` chỉ tạo và verify index của collection `WellnessTarget`.
`documentsModified` luôn bằng 0, không backfill. Chạy trực tiếp yêu cầu migration safety guard và
`CONFIRM_WELLNESS_TARGET_MIGRATION`; việc merge code không cấp quyền chạy migration trên staging/production.

## Privacy và retention

- Client export: `GET /api/wellness-targets/privacy/export`.
- Client delete: `DELETE /api/wellness-targets/privacy` với CSRF và confirmation.
- Admin account deletion xóa toàn bộ target versions trong transaction Customer Dashboard.
- Coaching end/renewal dùng retention policy chung để đặt hoặc xóa `retentionExpiresAt`.
- Dry-run: `POST /api/ops/privacy/wellness-targets/retention` với `{ "enforce": false }`.

## Rollback

1. Tắt `TODAY_WELLNESS_TARGET_WRITES_ENABLED`.
2. Không xóa collection/index và không rewrite versions cũ.
3. Theo dõi `wellness_target.writes`, `wellness_target.conflicts`, retention candidates/deletions và HTTP 5xx.
4. Nếu 409 tăng, client phải refetch version mới rồi gửi requestId mới.
5. Không log target values hoặc ghi chú sức khỏe vào structured logs/AuditLog metadata.
