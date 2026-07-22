# HT Coaching Web - Phase 1 Fix Report

**Ngày hoàn tất:** 2026-07-19
**Phạm vi:** data integrity, concurrency, idempotency, upload lifecycle và DB invariants.

## Kết quả chính

- Coaching trainer update dùng revision/`__v`, trả `409` khi stale.
- Trainer-owned exercise fields được validate; client progress được bảo toàn theo exercise `_id`.
- Không cho xóa exercise đã có completion/note/video của client.
- Admin không còn tự trở thành trainer owner khi sửa plan.
- Check-in có UUID idempotency key và unique compound index.
- Check-in create/delete dùng `withTransaction`; transient conflict được Mongo driver retry.
- Refund session dùng atomic `$inc` và không vượt `totalSessions`.
- Recipe bookmark có PUT/DELETE idempotent dùng `$addToSet`/`$pull`.
- Recipe slug được normalize/lowercase; DTO/model bounds và public query bounds được siết.
- Recipe thumbnail lưu Cloudinary `publicId`, verify entity trước upload và cleanup replace/failure/delete.
- Coaching feedback upload gắn với user + plan + exercise trước khi gửi Cloudinary.
- Contract dùng explicit `isActive` partial unique index, không còn `$nin` trong partial filter.
- F1 Intake có unique customer/version và partial unique latest/customer.
- Weekly schedule reminder dùng occurrence key theo ngày, atomic claim và xử lý đúng cửa sổ qua nửa đêm.
- Production Mongoose tắt `autoIndex`; index thay đổi đi qua migration có preflight.

## Migration

File:

`server/src/migrations/20260719-phase1-integrity.js`

Lệnh:

```powershell
cd server
npm run migrate:phase1
```

Migration **chưa được chạy** trong lúc implementation. Script sẽ dừng và in duplicate IDs nếu gặp:

- Nhiều active Contract cho cùng Order.
- Trùng F1 Intake customer/version.
- Nhiều F1 Intake `isLatest:true` cho cùng Customer.
- Recipe slug collision sau normalization.

Chỉ chạy sau khi backup DB và review kết quả preflight trên staging.

## File thay đổi

### Models/config/migration

- `server/src/models/CoachingDay.js`
- `server/src/models/Checkin.js`
- `server/src/models/Recipe.js`
- `server/src/models/Contract.js`
- `server/src/models/F1Intake.js`
- `server/src/models/TrainingSchedule.js`
- `server/src/config/db.js`
- `server/src/migrations/20260719-phase1-integrity.js`
- `server/package.json`

### Controllers/routes/middleware/services

- `server/src/controllers/coaching.controller.js`
- `server/src/controllers/checkin.controller.js`
- `server/src/controllers/recipe.controller.js`
- `server/src/controllers/f1Customer/intake.helpers.js`
- `server/src/routes/coaching.routes.js`
- `server/src/routes/recipe.routes.js`
- `server/src/middlewares/validation.js`
- `server/src/services/contract.service.js`
- `server/src/services/scheduleReminderCron.js`
- `server/src/utils/coachingPlan.js`
- `server/src/utils/cloudinaryUpload.js`

### Client

- `client/src/pages/admin/Checkin.jsx`
- `client/src/pages/customer/OnlineCoaching.jsx`
- `client/src/pages/trainer/TrainerCoaching.jsx`
- `client/src/services/recipe.service.js`

Các page client trên đã dirty trước phase; patch chỉ thêm idempotency/revision/upload contract và giữ nguyên thay đổi khác.

### Tests

- `server/src/__tests__/setup.js`
- `server/vitest.config.js`
- `server/src/controllers/__tests__/phase0.security.integration.test.js`
- `server/src/services/__tests__/scheduleReminderCron.test.js`

## Verification

- Server: **9 test files, 64 tests passed**.
- Integration DB: MongoMemory single-node replica set.
- Có test hai Check-in request đồng thời và delete lặp.
- Có test Coaching stale revision/progress preservation.
- Có test Contract/F1 uniqueness, Recipe PUT/DELETE bookmark.
- Có test reminder window qua nửa đêm Việt Nam.
- Targeted client ESLint: **passed**.

## Chuyển sang Phase 2

Các phần còn lại thuộc Phase 2: runtime AI tool schema validation, message/image/conversation bounds, abort/timeout/provider usage, Redis-ready moderation state, vector/embedding lifecycle, KB DTO/duplicate/source/privacy và bounded suggestion generation.
