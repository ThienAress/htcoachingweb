# Today Dashboard Phase 4 operations runbook

## Feature flags và migration

- TODAY_WEEKLY_CHECKIN_WRITES_ENABLED=true: bật save/submit/correction/review Weekly Check-in.
- TODAY_WEEKLY_RETENTION_ENFORCE=true: cho phép retention sweep thực sự xóa.
- TODAY_WEEKLY_RETENTION_ACTOR_ID: admin actor dùng cho scheduled enforcement.
- 20260729-today-dashboard-release-f.js chỉ tạo/verify index của WeeklyCheckin và
  WeeklyCheckinRevision; documentsModified luôn bằng 0, không backfill.

Không bật write flag trước khi migration được chạy bằng migration safety guard và index verifier PASS
trên đúng target. Runbook này không cấp quyền chạy migration, deploy hoặc ghi production.

## Progress read model

- Client: GET /api/progress?days=7|30|90.
- Trainer: GET /api/progress/trainer/clients/:clientId?days=7|30|90.
- Range khác 7/30/90 fail closed; response dùng formulaVersion=progress-v1 và
  Cache-Control: private, no-store.
- Task chưa đến hạn trong ngày hiện tại không bị tính fail; completion đã ghi hôm nay được tính ngay.
- Denominator bằng 0 trả percent: null, không trả zero-compliance.
- Trainer chỉ nhận habit do chính trainer tạo hoặc client chia sẻ; habit private không được suy ra qua
  aggregate. Các nguồn còn lại dùng cùng canonical formula.
- Không đọc F1 baseline và không auto-link bằng email.

## Retention và privacy

Dry-run bằng admin session + CSRF:

- POST /api/ops/privacy/weekly-checkins/retention với body enforce=false.

Enforcement cần đồng thời body enforce=true và env TODAY_WEEKLY_RETENTION_ENFORCE=true. Sweep lấy tối
đa 100 candidates, loại client còn approved Order có sessions, rồi re-check trong transaction trước khi
xóa check-in + revisions. Mỗi deletion tạo AuditLog; không dùng TTL.

Client có authenticated export và confirmed transactional delete. Admin user deletion inventory xóa
cả hai collections. Retention deadline được sync cùng Daily Journal/Saved Meal Plan/Coaching Habit khi
coaching kết thúc hoặc gia hạn.

## Rollback và quan sát

1. Tắt TODAY_WEEKLY_CHECKIN_WRITES_ENABLED; read/export/delete và Progress read vẫn hoạt động.
2. Không xóa index/collection hoặc rewrite revision để rollback code.
3. Theo dõi weekly_checkin.*, progress.requests, progress.errors và
   progress.aggregation_latency_ms.
4. Nếu 409 tăng, xác nhận retry giữ nguyên requestId và refresh revision mới.
5. Nếu trainer nhận 403, kiểm tra active Order; không cache hoặc khôi phục quyền từ assignment cũ.
6. Không log weekly body, wellness, weight hoặc habit title vào structured error logs.
