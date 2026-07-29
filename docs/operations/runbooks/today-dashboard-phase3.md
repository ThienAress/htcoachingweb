# Today Dashboard Phase 3 operations runbook

## Feature flags

- `TODAY_MEAL_PLAN_WRITES_ENABLED=true`: bật create/revise/archive Saved Meal Plan.
- `TODAY_JOURNAL_WRITES_ENABLED=true`: bật nutrition execution và habit completion trong Daily Journal.
- `TODAY_HABIT_WRITES_ENABLED=true`: bật create/status Coaching Habit.
- `TODAY_MEAL_PLAN_RETENTION_ENFORCE=true`: cho phép xóa Saved Meal Plan hết hạn.
- `TODAY_HABIT_RETENTION_ENFORCE=true`: cho phép xóa Coaching Habit hết hạn.

Không bật write flags trước khi migrations Release C/E đã create/verify indexes đúng target.
Release D chỉ thêm embedded fields vào Daily Journal nên không có index/backfill riêng.

## Migrations

- `20260729-today-dashboard-release-c.js`: indexes của `SavedMealPlan`, không backfill.
- `20260729-today-dashboard-release-e.js`: indexes của `CoachingHabit`, không backfill.

Mọi direct run yêu cầu migration environment guard và confirmation variable tương ứng. Runbook này
không cấp quyền chạy migration trên staging/production; cần change approval riêng và phải verify target.

## Retention

Dry-run bằng admin session + CSRF:

- `POST /api/ops/privacy/saved-meal-plans/retention` với `{ "enforce": false }`.
- `POST /api/ops/privacy/coaching-habits/retention` với `{ "enforce": false }`.

Enforcement chỉ chạy khi env flag tương ứng là `true`. Mỗi sweep lấy tối đa 100 candidates, loại client
còn approved Order và re-check active coaching lần nữa trong transaction trước khi xóa. Mỗi deletion tạo
AuditLog; không dùng TTL.

Nutrition assignment/entries và habit completions là embedded Daily Journal data. Chúng đi theo export,
delete và retention của Daily Journal; không có cleanup job độc lập. Xóa Saved Meal Plan/Habit definition
không tự xóa submitted Daily Journal history vì đó là privacy domain riêng của journal.

## Rollback và quan sát

1. Tắt write flag của domain gặp sự cố; own read/export/delete vẫn hoạt động.
2. Không xóa collection/index và không rewrite immutable versions để rollback code.
3. Theo dõi counters `saved_meal_plan.*` và `coaching_habit.*`, đặc biệt conflicts, retention candidates
   và retention deletions.
4. Với stale revision/version tăng đột biến, kiểm tra client retry có giữ nguyên requestId và có refresh
   response mới sau `409` hay không.
5. Không log note, manual meal description, wellness hoặc habit title vào structured error log.
