# Phase 8 Fix Report - F1 Data Lifecycle and Private Media

Date: 2026-07-20
Status: implementation and local verification complete; real migration, staging provider and orphan drill not run

## 1. Kết quả

Phase 8 đã khóa ba nhóm rủi ro lớn nhất của F1:

- Ảnh cơ thể không còn được phục vụ từ public local uploads.
- F1 code và các artifact AI có invariant/idempotency ở database thay vì dựa vào thứ tự request.
- Xóa customer đi qua media outbox trước khi xóa health data, tránh để lại private object không được quản lý.

Legacy `/uploads/f1-media` hiện trả 404. Production fail-closed nếu thiếu Cloudinary private configuration; local adapter chỉ dành cho development/test.

## 2. Private media pipeline

Upload pipeline mới:

1. Multer memory storage giới hạn kích thước và số file.
2. Sharp decode bytes thật, không tin extension/MIME do client gửi.
3. Giới hạn dimension/pixel để chặn decompression bomb.
4. Auto-rotate, loại EXIF/GPS và re-encode WebP.
5. Tính SHA-256 checksum, dimensions và size sau xử lý.
6. Upload qua storage adapter ở chế độ private/authenticated.
7. Database chỉ lưu provider metadata, không lưu public URL cố định.
8. Read chạy lại authorization rồi mới sinh signed URL ngắn hạn.

Quota được khóa theo file, customer, intake/type và tổng bytes. DTO bình thường không trả storage key.

## 3. Media lifecycle và deletion

Trạng thái media gồm `pending_upload`, `ready`, `delete_pending`, `deleted` và `failed`.

- Provider upload thành công nhưng DB transition thất bại: tạo cleanup job bền vững.
- Delete đánh dấu pending, worker claim atomically, retry có giới hạn và backoff.
- Provider not-found được coi là idempotent success; timeout vẫn là failure cần retry.
- Integrity scanner phát hiện record thiếu object metadata, orphan và trạng thái không nhất quán.
- Customer deletion tạo media jobs và data-deletion job trong transaction.
- Chỉ sau khi private objects đã được xác nhận xóa, worker mới xóa intake, assessment, report, forecast, prediction và media metadata.
- Customer shell được pseudonymize để giữ referential/audit evidence mà không giữ direct identifiers.

Deletion và retention chạy bằng durable database jobs nhưng polling hiện vẫn là in-process timer, chưa phải external queue.

## 4. F1 code và generated artifacts

- `Counter` dùng atomic `$inc` trong transaction; unique F1 code vẫn là hàng rào cuối.
- Customer creation retry duplicate-key mà không dùng `countDocuments + 1`.
- Assessment create và customer pointer update ở cùng transaction.
- Report/forecast/prediction lưu request ID, source fingerprint, source IDs, engine version và artifact version.
- Request trùng trả artifact hiện có; concurrent command bị unique index/CAS khóa.
- Regenerate explicit tạo version mới thay vì ghi đè artifact đã sinh.
- Image generation dùng compare-and-swap reservation và bounded attempts.

Migration seed counter từ F1 code hợp lệ lớn nhất, không dùng số document.

## 5. Data model và indexes

Model mới:

- `Counter`
- `F1MediaDeletionJob`
- `F1DataDeletionJob`

Các index Phase 8 bao phủ:

- customer assignment/status/list order;
- media customer/intake/type/status;
- deletion claim/retry;
- assessment source uniqueness;
- report/forecast/prediction source tuple và request idempotency.

Production tiếp tục giữ `autoIndex=false`. Migration có confirmation guard, preflight/backfill và verifier riêng.

## 6. API và client

- F1 customer list dùng server-side search, status filter và pagination.
- Query keys theo page/filter; mutation invalidate theo customer.
- List, detail, intake, create, assessment, report và prediction được lazy-load thành chunk riêng.
- Upload có progress, cancel, retry và trạng thái processing/failure.
- Object URL preview được revoke khi thay file/unmount.
- Client request IDs dùng UUID và được giữ ổn định qua retry.
- Intake optional numeric fields chấp nhận empty UI value thay vì fail validation sai.

E2E mới chạy đầy đủ create customer -> intake -> hai private media uploads -> assessment command -> AI report qua browser UI và deterministic provider mock.

## 7. Migration

Từ thư mục `server`, chỉ chạy sau backup và preflight review:

```powershell
$env:CONFIRM_PHASE8_F1_MIGRATION = "yes"
npm run migrate:phase8
npm run verify:phase8
```

Migration xử lý counter seed, legacy media conversion/private upload metadata, lifecycle fields và indexes. Không chạy migration này trực tiếp từ developer shell đang trỏ production.

Migration thật/staging và provider orphan scan chưa được chạy trong phiên này.

## 8. Verification evidence

- Client lint: pass.
- Client Vitest: 6 files, 87/87 pass.
- Server Vitest: 22 files, 117/117 pass.
- Phase 8 integration: 8/8 pass.
- Production build: pass.
- Prerender: 20/20 routes pass.
- Bundle budget: F1 family 165.1 kB raw / 43.5 kB gzip, budget 240/70.
- Chromium E2E: 45/45 pass.
- F1 lifecycle browser E2E: pass.
- Client/server production dependency audit: 0 vulnerabilities.
- Secret scan, runtime logging scan và `git diff --check`: pass.

Phase 8 integration kiểm tra fake/corrupt bytes, private re-encode, cross-trainer IDOR, signed read, upload compensation, delete retry/not-found, concurrent F1 code, artifact dedupe, provider-first customer deletion và idempotent counter migration.

## 9. Rollout

1. Phê duyệt provider/private-media policy và consent wording.
2. Backup database và lưu snapshot ID.
3. Cấu hình Cloudinary authenticated credentials trên staging.
4. Chạy migration + verifier trên staging snapshot.
5. Chạy legacy media scan; resolve mọi failed/orphan item.
6. Smoke upload/read/delete và customer-deletion với provider thật.
7. Deploy server trước, client sau.
8. Theo dõi upload failure, cleanup failure, orphan, quota reject, artifact conflict và DB latency.

Rollback:

- Không quay lại public `/uploads/f1-media`.
- Nếu provider lỗi, tắt F1 media writes và giữ nguyên retry jobs.
- Không drop counter/deletion/artifact indexes trong incident.
- Restore DB chỉ khi xác nhận corruption và đã đối chiếu provider objects.

## 10. Rủi ro còn lại

- Cloudinary authenticated upload/read/delete thật chưa được drill.
- Legacy local media migration và orphan scan chưa chạy trên staging snapshot.
- Lifecycle polling là in-process; database jobs bền vững nhưng latency phụ thuộc instance đang chạy.
- Retention, consent wording, legal hold và audit retention cần product/legal owner phê duyệt.
- Data export self-service chưa thuộc phạm vi Phase 8.

## 11. File thay đổi Phase 8

### Server

- `server/package.json`
- `server/package-lock.json`
- `server/server.js`
- `server/src/__tests__/setup.js`
- `server/src/controllers/__tests__/phase8.f1-integrity.integration.test.js`
- `server/src/controllers/f1Customer/aiReport.controller.js`
- `server/src/controllers/f1Customer/aiReport.helpers.js`
- `server/src/controllers/f1Customer/assessment.controller.js`
- `server/src/controllers/f1Customer/customer.controller.js`
- `server/src/controllers/f1Customer/forecast.controller.js`
- `server/src/controllers/f1Customer/index.js`
- `server/src/controllers/f1Customer/intake.controller.js`
- `server/src/controllers/f1Customer/intake.helpers.js`
- `server/src/controllers/f1Customer/media.controller.js`
- `server/src/controllers/f1Customer/media.helpers.js`
- `server/src/controllers/f1Customer/resultPrediction.controller.js`
- `server/src/controllers/f1Customer/shared.js`
- `server/src/middlewares/f1MediaUpload.js`
- `server/src/middlewares/rateLimit.js`
- `server/src/migrations/20260720-phase8-f1-private-integrity.js`
- `server/src/models/AuditLog.js`
- `server/src/models/Counter.js`
- `server/src/models/F1AiReport.js`
- `server/src/models/F1Assessment.js`
- `server/src/models/F1Customer.js`
- `server/src/models/F1DataDeletionJob.js`
- `server/src/models/F1Intake.js`
- `server/src/models/F1Media.js`
- `server/src/models/F1MediaDeletionJob.js`
- `server/src/models/F1OutcomeForecast.js`
- `server/src/models/F1ResultPrediction.js`
- `server/src/observability/metrics.js`
- `server/src/routes/f1Customer.routes.js`
- `server/src/scripts/verifyPhase8F1Integrity.js`
- `server/src/services/aiImageGenerator.service.js`
- `server/src/services/f1ArtifactIntegrity.service.js`
- `server/src/services/f1MediaImage.service.js`
- `server/src/services/f1MediaLifecycle.service.js`
- `server/src/services/f1MediaStorage.service.js`
- `server/src/services/f1PrivacyLifecycle.service.js`

### Client

- `client/src/App.jsx`
- `client/src/components/F1/F1AiReportPanel.jsx`
- `client/src/components/F1/F1AssessmentPanel.jsx`
- `client/src/components/F1/F1CreateCustomerForm.jsx`
- `client/src/components/F1/F1CustomerDetail.jsx`
- `client/src/components/F1/F1CustomerList.jsx`
- `client/src/components/F1/F1ForecastPanel.jsx`
- `client/src/components/F1/F1IntakeWizard.jsx`
- `client/src/components/F1/F1ResultPredictionPanel.jsx`
- `client/src/components/F1/assessment/EnduranceAssessmentSection.jsx`
- `client/src/components/F1/assessment/StrengthAssessmentSection.jsx`
- `client/src/components/F1/intake/StepPostureMedia.jsx`
- `client/src/components/F1/intake/StepTrainingGoal.jsx`
- `client/src/components/F1/intake/schema.js`
- `client/src/components/F1/intake/useIntake.js`
- `client/src/components/F1/intake/__tests__/schema.test.js`
- `client/src/pages/F1CustomersPage/F1Customers.jsx`
- `client/src/services/f1Customer.service.js`
- `client/src/utils/mediaUrl.js`
- `client/src/utils/__tests__/mediaUrl.test.js`

### E2E và docs

- `e2e/f1-lifecycle.spec.js`
- `e2e/mock-api.cjs`
- `docs/phase-8-fix-report-2026-07-20.md`
- `docs/phase-9-data-inventory.md`
- `docs/release-checklist.md`
