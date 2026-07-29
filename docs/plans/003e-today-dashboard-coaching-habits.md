# Plan 003E: Coaching Habit assignment, completion và streak

> Release E hoàn thành Task 3.4 và đóng Phase 3. Habit definition là collection riêng;
> completion nằm trong `DailyJournal` để giữ canonical day history và revision semantics.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — trainer/client scope, health-adjacent history, streak boundary và privacy lifecycle
- **Depends on**: 003D implemented/verified
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Contract đã chốt

### `CoachingHabit`

- Ownership: `clientId`; creator snapshot gồm `createdById`, `createdByRole`, `trainerIdAtCreation`.
- Nội dung: title tối đa 100, description 500, category allowlist, optional target/unit.
- Schedule: Monday-first `daysOfWeek` unique trong 0–6, `startDateKey`, optional `endDateKey`.
- Lifecycle: `active | paused | archived`, optimistic `version`, timestamps và `retentionExpiresAt`.
- Visibility: client-created mặc định `private`, chỉ `shared` khi client chủ động chọn; trainer-created luôn `shared`.
- Trainer chỉ tạo/quản lý habit do trainer tạo cho active managed client. Client chỉ quản lý definition tự tạo.
- Collection mới, migration chỉ create/verify indexes, không backfill.

### Completion trong `DailyJournal`

- Additive `habitCompletions`, tối đa 20/ngày.
- Item: `habitId`, exact habit version, title snapshot, status `completed | skipped`, server timestamp.
- Client chỉ complete habit scheduled/active hoặc habit đã có completion lịch sử trong ngày.
- Full-array replacement qua optimistic Journal revision/idempotency; submitted day dùng correction có reason.
- Title/schedule về sau thay đổi không rewrite snapshot đã lưu.

### Streak

- Derived từ Daily Journal; không lưu mutable counter.
- Tính trên các scheduled date từ requested `dateKey` lùi về trước theo Monday-first calendar.
- `completed` tăng streak; missing hoặc `skipped` dừng streak; ngày không scheduled bị bỏ qua.
- Formula trả kèm `formulaVersion`.

## API dự kiến

- `POST /api/coaching-habits`
- `GET /api/coaching-habits/my?dateKey=YYYY-MM-DD`
- `POST /api/coaching-habits/trainer/clients/:clientId`
- `GET /api/coaching-habits/trainer/clients/:clientId?dateKey=YYYY-MM-DD`
- `POST /api/coaching-habits/:id/status`
- `GET /api/coaching-habits/privacy/export`
- `DELETE /api/coaching-habits/privacy`
- `POST /api/ops/privacy/coaching-habits/retention`

Definition mutations dùng CSRF, limiter, UUID `requestId`, expected version khi đổi lifecycle.
Completion tiếp tục dùng Daily Journal endpoints hiện có.

## Privacy lifecycle

- Self export/delete xóa toàn bộ definitions theo `clientId`; Daily Journal completion là domain export/delete riêng.
- Retention deadline sync cùng coaching lifecycle, active Order được re-check trước và trong transaction.
- Enforcement cần `TODAY_HABIT_RETENTION_ENFORCE=true` và admin actor.
- Audit/metrics và admin user deletion inventory được cập nhật trong release.

## Tasks

- [x] Viết tests RED model/index, create/list/status idempotency, client/trainer IDOR và visibility.
- [x] Viết tests RED completion snapshot, schedule boundary, submitted correction và derived streak.
- [x] Viết tests RED export/delete/retention, active-client guard, migration no-backfill và user deletion.
- [x] Tạo model, migration, access/command/read/privacy/streak services theo MVC layering.
- [x] Mở rộng DailyJournal schema/revision/DTO/normalization/canonicalization cho completion.
- [x] Thêm validation, controller/routes, limiter, metrics, audit enum, ops và server mount.
- [x] Thêm Habit Card cho client và compact Habit Manager trong trainer workspace.
- [x] Chạy impact re-trace, UI check, targeted/full QA/build/security gates và đóng Phase 3.

## Done criteria

- [x] Trainer khác hoặc quan hệ inactive không đọc/sửa được habit của client.
- [x] Client-created private habit không lộ ở trainer endpoint; explicit shared mới hiện.
- [x] Completion chỉ nhận habit canonical đúng ngày và snapshot không drift khi title/status đổi.
- [x] Retry không tạo duplicate definition/revision; stale version/revision trả 409.
- [x] Streak đúng ở missed day, skipped day, non-scheduled day và week boundary.
- [x] New collection có export/delete/retention/user-deletion tests và no-store responses.
- [x] UI có loading/empty/error/retry/disabled, form labels, keyboard focus và touch target 44px.
- [x] Không chạy migration, backfill, deploy, retention enforcement hoặc production write.

## Verification evidence — 2026-07-29

- Targeted Release E: 5 backend files/26 tests và 3 client files/11 tests pass.
- Full client: 22 files, 144 tests pass.
- Full server: 58 files, 275 tests pass.
- Client ESLint pass.
- Production build, static prerender 8/8 và bundle budget pass; Today Dashboard 48.5KB raw/11.8KB gzip.
- Secret scan, repository data boundaries, commercial contracts và `git diff --check` pass.
- UI check pass sau khi làm rõ selected state, nâng touch target và thêm two-step archive confirmation.
- E2E browser chưa chạy vì không có signed-in dev session/dev servers trong gate local.

## STOP conditions

- Cần lưu streak counter mutable hoặc copy completions vào habit definition.
- Cần cho trainer xem private client-created habit không có explicit share.
- Cần nới active relationship/ownership, CSRF, edit window hoặc Journal revision contract.
- Cần migration/backfill production hay retention enforcement thật.
