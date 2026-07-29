# Today Dashboard Phase 5–6 operations runbook

## Canonical domains

- Contextual comments: /api/coaching-comments; text-only, revision/idempotency và tombstone.
- Trainer overview: /api/trainer-overview và /api/trainer-client-overview.
- In-app notifications: /api/notifications; collection canonical là InAppNotification.
- Client activity/export: /api/coaching-activity; JSON/CSV có source ID, timestamp và timezone.
- Protected UI: /today, /progress, /notifications; tất cả noindex, không sitemap/prerender.

Notification không lưu comment body, pain detail, weight hoặc wellness note. deepLink chỉ là internal path;
client từ chối URL ngoài site. Document mới có retention deadline mặc định null; khi coaching kết thúc,
notification tham gia cùng retention deadline đã duyệt của dữ liệu Today.

## Feature flags

- TODAY_DASHBOARD_ENABLED=false: rollback toàn bộ Today read surface.
- TODAY_JOURNAL_WRITES_ENABLED=true: bật journal save/submit/correction.
- TODAY_MEAL_PLAN_WRITES_ENABLED=true: bật Saved Meal Plan mutations.
- TODAY_HABIT_WRITES_ENABLED=true: bật Coaching Habit mutations.
- TODAY_WEEKLY_CHECKIN_WRITES_ENABLED=true: bật Weekly Check-in/review.
- TODAY_COMMENT_WRITES_ENABLED=true: bật contextual comment mutations.
- TODAY_NOTIFICATION_RETENTION_ENFORCE=true: chỉ cho phép admin thực thi notification
  retention sweep; khi thiếu flag endpoint vẫn chỉ dry-run/fail closed.

Mỗi write domain được bật theo cohort riêng. Notification delivery đi cùng transaction của event nguồn;
không có email/SMS/push trong release này.

## Migration và performance verifier

- 20260729-today-dashboard-release-g.js: Comment/Revision + Notification/Preference indexes.
- 20260729-today-dashboard-phase6.js: range indexes cho schedule/workout/habit.
- Cả hai migration chỉ tạo/verify index, documentsModified bằng 0, có migration safety target guard.
- Không chạy các lệnh này chỉ vì đọc runbook; cần quyền và target được xác nhận riêng.

Các script canonical chạy từ repository root:

    npm run migrate:today-dashboard-release-g --prefix server
    npm run migrate:today-dashboard-phase6 --prefix server
    npm run check:today-dashboard-performance --prefix server

Sau khi index verifier PASS trên staging, chạy read-only performance check bằng synthetic client:

    $env:PERFORMANCE_CLIENT_ID="<synthetic-client-object-id>"
    $env:PERFORMANCE_ITERATIONS="3"
    $env:CONFIRM_TODAY_DASHBOARD_PERFORMANCE_CHECK="yes"
    node src/operations/todayDashboardPerformance.js

APP_ENV, MONGO_URI và MIGRATION_TARGET_DATABASE vẫn phải khớp migration safety guard; production còn cần
backup snapshot ID, approval ID và production confirmation riêng.

Gate mặc định: combined read P95 không quá 2000 ms, payload không quá 512 KiB, không COLLSCAN,
Daily Journal tối đa 100 docs, Weekly 20, Habit 500, Comment Activity 200, Notification 50,
Schedule/Workout mỗi nguồn 200 docs examined.

## Privacy deletion và retention

Admin user deletion đặt Checkin, Order, toàn bộ Today/Progress/Collaboration và User trong cùng
transaction; deleteTodayDashboardData nhận lại session thay vì mở transaction rời. Driver
withTransaction xử lý transient retry; audit chỉ lưu collection names và tổng count, không lưu raw data.

Hard-delete DailyJournal, WeeklyCheckin, CoachingDay hoặc WorkoutPlan xóa luôn contextual comment
revisions và notification trỏ tới comment trong cùng transaction để không tạo orphan.

Các retention endpoint, gồm /api/ops/privacy/in-app-notifications/retention, mặc định dry-run và
enforcement vẫn cần từng env guard + admin actor. Duration mặc định 365 ngày đã được duyệt trong
Today spec/Release B; không đổi duration hoặc bật enforcement nếu chưa xác nhận target và approval
vận hành riêng.

## Staged rollout

1. Deploy với TODAY_DASHBOARD_ENABLED=false và toàn bộ write flags tắt.
2. Xác nhận backup/readiness; chạy Release G + Phase 6 migration trên target đã duyệt.
3. Chạy verifier và load smoke bằng synthetic client; mọi gate phải PASS.
4. Bật read-only cho internal accounts, sau đó cohort nhỏ.
5. Bật từng write flag theo thứ tự Journal → Meal → Habit → Weekly → Comment.
6. Theo dõi tối thiểu 30 phút mỗi cohort trước khi mở rộng.

Rollback cohort nếu một trong các ngưỡng sau kéo dài 15 phút:

- Today/Progress P95 trên 2000 ms hoặc partial/error rate trên 2%.
- 409 conflict vượt 5% mutation attempts.
- Save/submit/review success dưới 98%.
- Có cross-client data, unauthorized success, notification chứa sensitive content hoặc deletion mismatch:
  rollback ngay, không chờ 15 phút.
- Payload vượt 512 KiB hoặc verifier xuất hiện COLLSCAN.

## Rollback

1. Tắt write flag của domain lỗi; nếu read/privacy lỗi thì đặt TODAY_DASHBOARD_ENABLED=false.
2. Không drop collection/index, không rewrite revision và không hard-delete audit để rollback code.
3. Purge client query cache bằng logout; trainer overview 403 reset cả active lẫn inactive
   trainer-private query, đồng thời remove/reset current overview fail-closed với guard chống loop.
4. Giữ API export/delete private với Cache-Control: private, no-store.
5. Không khôi phục quyền trainer từ cache hoặc assignment cũ.

## Local verification boundary

Unit/integration, lint, build, security, static route và deterministic Playwright mock gates có thể chạy local.
Staging migration, synthetic seed, signed-in staging acceptance và cohort rollout vẫn cần session/target
riêng; runbook không tự cấp quyền thực hiện các thao tác đó.
