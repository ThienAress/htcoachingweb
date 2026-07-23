# Phase 7 Fix Report - Schedule and Booking Integrity

Date: 2026-07-20
Status: implementation complete, local verification complete, real database migration not run

## 1. Kết quả

Phase 7 đã chuyển lịch tập từ dữ liệu "thứ trong tuần + TTL" sang occurrence
theo ngày cụ thể và khóa các invariant ở database:

- Mỗi occurrence có `occurrenceDateKey`, `startAt`, `endAt` và
  timezone cố định `Asia/Ho_Chi_Minh`.
- Một client chỉ có một lịch active trong một ngày.
- Một trainer không thể bị đặt trùng bất kỳ slot 15 phút nào.
- Create/reschedule/cancel/complete dùng transaction, command idempotency và
  revision compare-and-swap.
- Cancel/complete giữ lại schedule và audit; không còn hard-delete/TTL xóa lịch sử.
- Client không thể dò busy time của trainer không được phân công.
- Reminder có delivery record, atomic claim, retry và dedupe bền vững qua restart.
- Lead Booking có state machine, revision, idempotent public submit và soft archive.

Các field legacy `dayOfWeek`, `startTime`, `endTime` và
`expiresAt` vẫn được dual-write để client/AI cũ không gãy trong rollout.
`expiresAt` không còn là TTL index.

## 2. Schedule Integrity

### Data model

`TrainingSchedule` bổ sung:

- Concrete occurrence: `occurrenceDateKey/startAt/endAt/timeZone`.
- State: `status/isActive/revision`.
- Ownership: `createdByType/requestedBy`.
- Idempotency: `requestId`.
- Lifecycle metadata: cancel, complete và client edit timestamps.

Ba model mới:

- `TrainingSlotClaim`: unique `(trainerId, slotStartAt)`.
- `TrainingScheduleCommand`: unique `(actorId, requestId)` cho
  create/reschedule/cancel/complete/cancel-all.
- `ReminderDelivery`: unique delivery theo schedule, occurrence và channel.

Unique partial index `(clientId, occurrenceDateKey)` với
`isActive: true` khóa chính sách một lịch/client/ngày.

### Command behavior

- Thời gian phải đúng bước 15 phút, duration 15 phút đến 4 giờ.
- Lịch mới chỉ được đặt tối đa 56 ngày tới và không được ở quá khứ.
- Client reschedule tối đa một lần mỗi 24 giờ.
- Reschedule giải phóng claims cũ và claim slot mới trong cùng transaction.
- Duplicate request trả replay của kết quả cũ.
- Slot/client conflict và stale revision trả HTTP 409.
- Cancel/complete xóa claims nhưng giữ schedule, revision và audit.
- Admin assignment phải explicit. Order chưa có trainer chỉ dùng
  `DEFAULT_ADMIN_TRAINER_ID`; server không còn chọn admin đầu tiên trong DB.

### Authorization

- Trainer chỉ tạo/sửa lịch cho client có approved order còn buổi.
- Client trainer được resolve từ approved order còn buổi.
- `busy-times` so khớp trainer query với assignment của client.
- Client chỉ sửa/hủy schedule thuộc chính mình.
- Non-admin trainer chỉ thao tác schedule thuộc mình; admin vẫn có quyền quản trị.

## 3. Lead Booking

State transitions hợp lệ:

- `pending -> contacted | cancelled`
- `contacted -> completed | cancelled`
- `completed/cancelled` là terminal

Các thay đổi khác:

- Public create bắt buộc `clientRequestId` UUID và fingerprint payload.
- Pagination được clamp: page >= 1, limit 1..100.
- Search dài tối đa 100 ký tự và dùng normalized fields.
- Status update bắt buộc revision; stale/invalid transition trả 409.
- Delete cũ được giữ route compatibility nhưng thực hiện soft archive.
- Status transition và archive ghi `AuditLog` trong transaction.
- Input có bounds cho name, gym, schedule, package, gifts và admin note.

## 4. Client và API

Client booking/trainer calendar:

- Chọn ngày thật bằng date input thay vì chỉ chọn thứ.
- Trainer calendar có điều hướng tuần và chỉ render occurrence thuộc tuần đó.
- Create/update/cancel gửi `requestId`; update/cancel gửi `revision`.
- HTTP 409 làm invalidate TanStack Query để tải revision mới.
- Client có nút hủy mềm; trainer "xóa" được đổi thành hủy.
- Lead admin chỉ bật action đúng transition và gửi revision hiện tại.
- Form đăng ký gói giữ cùng `clientRequestId` khi request mất phản hồi.

Command endpoints:

- `POST /api/training-schedules`
- `PUT /api/training-schedules/:id`
- `DELETE /api/training-schedules/:id`
- `PATCH /api/training-schedules/:id/complete`
- `DELETE /api/training-schedules`
- `POST /api/training-booking/book`
- `PUT /api/training-booking/book/:id`
- `DELETE /api/training-booking/book/:id`
- `PATCH /api/bookings/:id/status`
- `PATCH /api/bookings/:id/archive`

AI training schedule tool chỉ đọc schedule active trong tương lai và hiển thị
occurrence date cụ thể thay vì coi document là recurrence hàng tuần.

## 5. Reminder và Observability

Reminder cron query trực tiếp bằng `startAt`, claim delivery atomically và
không gửi lại delivery đã ở trạng thái `sent`. Failure được lưu error rút gọn,
`nextAttemptAt` và retry; field reminder cũ vẫn được cập nhật để compatibility.

Metrics mới:

- `schedule.idempotency_hits`
- `schedule.slot_conflicts`
- `schedule.revision_conflicts`
- `schedule.transaction_aborts`
- `schedule.reminders_sent`
- `schedule.reminder_failures`
- `booking.idempotency_hits`
- `booking.transition_conflicts`

## 6. Migration và verifier

Migration: `server/src/migrations/20260719-phase7-schedule-booking-integrity.js`

Preflight dừng trước khi ghi nếu phát hiện:

- Legacy schedule có date/time không thể chuyển đổi.
- Nhiều active schedule của cùng client trong cùng ngày.
- Trainer overlap ở bất kỳ slot 15 phút.

Sau preflight, migration:

1. Backfill concrete occurrence/state/revision cho schedule.
2. Backfill idempotency/normalized fields cho lead Booking.
3. Drop TTL và legacy indexes không còn dùng.
4. Rebuild slot claims.
5. Tạo unique/query indexes Phase 7.
6. Chạy integrity verifier và fail nếu `totalIssues > 0`.

Lệnh staging, chạy từ `server`:

```powershell
$env:CONFIRM_PHASE7_SCHEDULE_MIGRATION = "yes"
npm run migrate:phase7
npm run verify:phase7
```

Yêu cầu trước migration:

- Backup và lưu snapshot ID.
- Resolve toàn bộ conflict preflight thay vì tự động chọn record thắng.
- Gán trainer cho approved orders, hoặc cấu hình
  `DEFAULT_ADMIN_TRAINER_ID` là ObjectId admin hợp lệ.
- Chạy staging trước production.

Migration real/staging chưa được chạy trong phiên này.

## 7. Verification Evidence

- Client lint: pass.
- Server Vitest: 20 files, 102/102 tests pass.
- Client Vitest: 5 files, 85/85 tests pass.
- Phase 7 targeted integration/reminder: 8/8 pass.
- Production build: pass.
- Prerender: 20/20 routes pass.
- Bundle budget: pass.
- Chromium E2E: 40/40 pass.
- Chromium + Firefox + WebKit matrix: 120/120 pass.
- `git diff --check`: pass; chỉ có line-ending warnings hiện hữu trên Windows.

Phase 7 integration bao phủ:

- Hai request concurrent claim cùng trainer slot: đúng một request thắng.
- Client/date uniqueness.
- Create/reschedule replay, stale revision và 24h guard.
- Busy-time IDOR.
- Cancel giữ document, xóa claims và ghi audit.
- Reminder delivery không gửi trùng.
- Lead idempotency, transition và archive.
- Migration chạy hai lần idempotently trên replica-set test DB.

Build vẫn báo các warning không làm fail:

- Dynamic sitemap sources không truy cập được local API nên giữ sitemap 20 routes cũ.
- Vite báo một số deferred chunk lớn.
- Playwright dev server có warning từ Lit/phantom-ui.

## 8. Rollout và rollback

Thứ tự rollout:

1. Backup DB.
2. Deploy server Phase 7 nhưng chưa deploy client.
3. Chạy migration + verifier trên staging/production theo approval.
4. Smoke test create/reschedule/cancel/complete/reminder/lead.
5. Deploy client.
6. Theo dõi 409, transaction abort, reminder failure và DB latency 30 phút.

Rollback:

- Nếu chỉ lỗi UI, rollback client và giữ server Phase 7.
- Không recreate TTL index.
- Không drop claims/command/delivery indexes trong incident.
- Nếu buộc rollback server, disable schedule writes trước; legacy server không tạo
  slot claims nên không được nhận booking mới sau migration.
- Restore DB chỉ khi xác nhận data corruption.

## 9. Rủi ro còn lại

- Reminder vẫn chạy bằng in-process cron. Delivery claim chống gửi trùng giữa nhiều
  instance, nhưng Phase 8 nên chuyển polling/retry sang durable worker/queue.
- Migration có chủ ý fail-closed với conflict legacy; cần người phụ trách dữ liệu
  quyết định record nào reschedule/cancel.
- Full staging test với dữ liệu production-like và mail sandbox vẫn là release gate.

## 10. File thay đổi Phase 7

### Server

- `server/package.json`
- `server/src/controllers/booking.controller.js`
- `server/src/controllers/trainingBooking.controller.js`
- `server/src/controllers/trainingSchedule.controller.js`
- `server/src/controllers/__tests__/phase7.schedule-booking.integration.test.js`
- `server/src/middlewares/validation.js`
- `server/src/migrations/20260719-phase7-schedule-booking-integrity.js`
- `server/src/models/AuditLog.js`
- `server/src/models/Booking.js`
- `server/src/models/ReminderDelivery.js`
- `server/src/models/TrainingSchedule.js`
- `server/src/models/TrainingScheduleCommand.js`
- `server/src/models/TrainingSlotClaim.js`
- `server/src/observability/metrics.js`
- `server/src/routes/booking.routes.js`
- `server/src/routes/trainingBooking.routes.js`
- `server/src/routes/trainingSchedule.routes.js`
- `server/src/scripts/verifyPhase7ScheduleIntegrity.js`
- `server/src/services/ai/tools/getTrainingSchedule.tool.js`
- `server/src/services/scheduleReminderCron.js`
- `server/src/services/trainingOccurrence.service.js`
- `server/src/services/trainingScheduleCommand.service.js`
- `server/src/services/trainingScheduleIntegrity.service.js`

### Client

- `client/src/pages/RegisterPage/RegisterPage.jsx`
- `client/src/pages/admin/BookingManagement.jsx`
- `client/src/pages/customer/BookTraining.jsx`
- `client/src/pages/trainer/TrainingSchedule.jsx`
- `client/src/services/booking.service.js`
- `client/src/services/trainingBooking.service.js`
- `client/src/services/trainingSchedule.service.js`

### E2E và docs

- `e2e/mock-api.cjs`
- `e2e/schedule-booking.spec.js`
- `docs/release-checklist.md`
- `docs/phase-7-fix-report-2026-07-20.md`
