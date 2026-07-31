# Plan 011: Thêm mục tiêu sức khỏe do HLV và admin thiết lập

> **Drift check**: Worktree có nhiều thay đổi Today/Progress chưa commit từ Plan 009–010. Chỉ sửa đúng symbol
> trong scope và không ghi đè phần Việt hóa, chart hoặc module progress hiện có.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — dữ liệu sức khỏe, schema mới, ownership trainer/admin và contract xuyên FE/BE
- **Depends on**: 008, 009, 010
- **Category**: feature | schema | privacy | security | ui
- **Planned at**: 2026-07-30
- **Status**: IMPLEMENTED / LOCAL VERIFIED - MIGRATION NOT RUN

## Current state

- `DailyJournal.wellness` là actual do client ghi; không có model target.
- `/trainer/coaching` đã có client selector, `TrainerHabitManager` và `TrainerClientOverview`.
- `AdminRoute` cho admin mở `/trainer`, nhưng `requireTrainerActor` từ chối admin; API mới phải dùng
  `requireTrainerAccess` rồi ownership service tự phân biệt admin/trainer.
- `today-v2` tính mức độ điền Nhật ký, không được thay đổi.

## Scope

Backend: model/DTO/access/service/privacy/controller/routes/validation/rate limit, route registration, retention policy,
Customer Dashboard deletion inventory, index-only migration và integration tests.

Frontend: `wellnessTarget.service.js`, schema/presentation tests, `TrainerWellnessTargetCard`, tích hợp
`TrainerCoaching`, admin navigation, `WellnessCard/WellnessFields` và target summary của học viên.

Docs: spec này, Plan 011, plans index, operations runbook và canonical Today Dashboard note.

## Steps

1. Viết RED tests cho validation/model, trainer/admin ownership, version conflict/idempotency, own read theo ngày,
   privacy deletion/index migration và client presentation.
2. Implement `WellnessTarget` theo route → controller → service → model; mọi mutation có CSRF/rate limit.
3. Thêm target vào retention sync, account deletion, export/delete và dry-run retention.
4. Implement service/client card cho HLV/admin; thêm entry admin dùng chung `/trainer/coaching`.
5. Hiển thị target/actual ở Nhật ký; giữ nguyên completion formula và input subjective.
6. Re-trace producers/consumers; chạy focused/full tests, lint, Vite compile, security scans, UI check và diff check.

## Verification evidence

- Focused server (latest): 2 files, 15/15 tests passed.
- Full server regression: 77 files, 354/354 tests passed before the final test-only split; focused suite passed again after the split.
- Final full-server rerun after the test-only split was attempted, but the command wrapper timed out after 184 seconds before returning a result; this was not recorded as a pass.
- Focused client: 2 files, 8/8 tests passed.
- Full client regression: 34 files, 186/186 tests passed.
- Client lint: passed.
- Server syntax check for all new/wired files: passed.
- Vite compile: passed, 2,778 modules; bundle budget passed.
- Secret scan and repository data-boundary scan: passed.
- git diff --check: passed; only existing LF/CRLF conversion warnings.
- Full npm run build --prefix client was not rerun because local postbuild prerender is blocked by dynamic source ECONNABORTED; standalone Vite compile passed.
- Database migration was intentionally not run against local, staging, or production. It requires an explicitly confirmed target database.
## Done criteria

- [x] Trainer/admin đặt được ba mục tiêu với ownership đúng và conflict/idempotency an toàn.
- [x] Học viên thấy target đúng ngày; actual và subjective fields vẫn do học viên nhập.
- [x] Target không tác động `moduleProgress.journal`.
- [x] New collection tham gia index migration, privacy delete/export và retention sync.
- [x] Verification gates có evidence thật; không có debug/secret/unused code.

## STOP conditions

- Cần backfill hoặc ghi staging/production.
- Cần thay semantics Daily Journal hoặc công thức completion ngoài spec.
- Cùng root cause fail ba vòng hoặc ownership không thể chứng minh bằng active Order.
