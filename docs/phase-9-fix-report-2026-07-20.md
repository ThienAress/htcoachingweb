# Phase 9 Fix Report - Privacy, Operations, Performance and Accessibility

Date: 2026-07-20
Status: code baseline and local verification complete; external observability and production drills remain release gates

## 1. Kết quả

Phase 9 hoàn thiện các guard có thể kiểm chứng trong codebase:

- structured logging và CI gate chặn raw runtime `console.*`;
- request/trace correlation, Prometheus-compatible export và PII-safe RUM;
- Helmet/CSP report-only, request sanitization và rate limit cho command nhạy cảm;
- retention dry-run/deletion workflow và data inventory;
- dependency/secret scans trong CI;
- route-family bundle budget, accessibility smoke và browser-matrix schedule.

Phase này không tuyên bố đã hoàn tất production operations. Alert delivery thật, dashboard, RUM baseline, CSP enforce, backup/restore, provider failure drill và staging migration cần được chạy trên hạ tầng thật.

## 2. Structured logging và tracing

- Async request context giữ `requestId`, trace ID, actor ID và route correlation.
- W3C `traceparent` hợp lệ được propagate; request ID không hợp lệ được thay bằng giá trị server-generated.
- HTTP completion ghi method, normalized route, status và duration.
- Safe logger redact key/value nhạy cảm và không serialize health payload, prompt, contact detail, cookie/token hoặc signed URL.
- Runtime server console calls được chuyển sang safe structured events.
- Client source cũng bật ESLint `no-console: error`; CLI/build scripts có override rõ ràng.
- CI chạy `npm run check:runtime-logging` để ngăn raw console quay lại server runtime.

Đây là correlation baseline, chưa phải full OpenTelemetry trace từ HTTP qua từng DB/provider span. Việc export trace sang backend dùng chung còn cần hạ tầng.

## 3. Metrics, alerts và RUM

Ops endpoints:

- `GET /api/ops/health`
- `GET /api/ops/metrics` cho admin
- `GET /api/ops/metrics/prometheus` cho admin hoặc constant-time machine token
- `GET /api/ops/alerts` cho admin
- `GET /api/ops/privacy/f1` cho aggregate lifecycle
- `POST /api/ops/web-vitals`
- `POST /api/ops/csp-report`

Prometheus export có counters/summaries cho HTTP, DB, AI, financial, schedule, F1 cleanup và RUM. Metrics hiện ở memory theo process; phải scrape mọi replica và aggregate bên ngoài.

Alert indicators đã có cho financial reconciliation mismatch, F1 cleanup failure, reminder failure và HTTP 5xx. Chưa có Alertmanager/provider gửi notification thật.

Client gửi LCP, INP và CLS theo route/device. Server bỏ query string, normalize dynamic ID, bound giá trị, không nhận free text/direct identifier và TTL sau 30 ngày. Chưa có production traffic nên chưa có baseline/P75 report thật.

## 4. Privacy governance

- Data inventory phân loại customer identity, health intake, assessment, media, generated health inference, audit/deletion metadata và RUM.
- Archived F1 customer được backfill retention expiry, default 365 ngày và configurable 30..3650.
- Retention chạy dry-run mặc định; enforce cần explicit actor ID.
- User/admin deletion xóa private provider objects trước, rồi mới purge health/artifact records và pseudonymize customer shell.
- Audit giữ actor/action/target và bounded metadata, không giữ health payload.
- Consent version và media/image-generation consent được enforce ở F1 workflow.

Các quyết định product/legal còn mở được ghi trong `docs/phase-9-data-inventory.md`.

## 5. Security hardening

- Helmet security headers và CSP report-only mặc định.
- CSP report endpoint rate-limit, bound 32 kB và chỉ log directive/disposition/status.
- Request sanitizer reject nested Mongo operators, dotted keys và prototype-pollution keys trước controller.
- Rate limits riêng cho F1 mutation/generation, schedule, financial command, RUM và CSP reports.
- Prometheus machine token cần tối thiểu 24 ký tự và so sánh constant-time.
- Client/server production dependency audit và repository secret scan là CI gates.
- Production F1 media không còn phụ thuộc `crossOriginResourcePolicy=false` public uploads.

CSP chưa enforce. Report-only observation và allowlist review là release gate.

## 6. Performance

- RUM collection tạo baseline mechanism thay vì tối ưu dựa trên cảm giác.
- F1 nested panels được lazy-load.
- Bundle script kiểm tra cả per-chunk và tổng route family.
- Build hiện tại: F1 165.1 kB raw / 43.5 kB gzip; schedule 24.7 / 6.8 kB.
- Entry 502.6 / 158.4 kB nằm trong budget 700/230.
- React PDF 1508.7 / 499.7 kB vẫn lớn nhưng deferred và trong budget 1700/550.

Chưa virtualize long lists hoặc thay React PDF vì chưa có RUM/Profiler evidence production. Đây là quyết định có chủ ý, không phải claim rằng các màn này đã tối ưu tối đa.

## 7. Accessibility và browser reliability

axe critical smoke bao phủ:

- public + auth;
- admin financial;
- trainer schedule;
- F1 mobile workflow.

Đã bổ sung accessible name cho Hero navigation controls và label cho Contact select. Third-party `phantom-ui` được loại khỏi axe target vì không thuộc DOM do dự án sở hữu.

Kết quả 4/4 critical smoke pass. Axe vẫn từng chỉ ra serious contrast ở giao diện hiện hữu; vì gate hiện chỉ fail critical nên contrast serious là backlog cần xử lý, không được coi là WCAG pass đầy đủ.

CI:

- PR/push chạy Chromium.
- Nightly 18:00 UTC chạy Chromium, Firefox và WebKit.
- Manual workflow dispatch được bật.

Full 3-browser matrix chưa được chạy lại local sau Phase 9; nightly CI là release evidence bắt buộc.

## 8. Migration

Từ `server`, sau backup:

```powershell
$env:F1_RETENTION_DAYS = "365"
$env:CONFIRM_PHASE9_PRIVACY_MIGRATION = "yes"
npm run migrate:phase9
npm run verify:phase9
```

Migration backfill archived retention, legacy deletion-job actor role và WebVital TTL/indexes. Migration chạy idempotently trong integration test và không xóa customer data.

Migration thật/staging chưa được chạy trong phiên này.

## 9. Verification evidence

- Client lint: pass, including `no-console`.
- Client Vitest: 6 files, 87/87 pass.
- Server Vitest: 22 files, 117/117 pass.
- Phase 9 integration: 6/6 pass.
- Runtime logging policy: pass.
- Repository secret scan: pass.
- Client/server production dependency audit: 0 vulnerabilities.
- Production build and prerender 20/20: pass.
- Per-chunk and F1/schedule route-family budget: pass.
- Chromium E2E: 45/45 pass.
- Accessibility critical smoke: 4/4 pass.
- `git diff --check`: pass; only existing Windows LF/CRLF warnings.

Build could not reach local dynamic sitemap sources, so it preserved the existing 20-route sitemap. Dynamic blog/recipe/customer-story route freshness still needs staging API verification.

## 10. Rollout và rollback

Rollout:

1. Assign owners in the operations runbook.
2. Backup and run Phase 8/9 migrations + verifiers on staging.
3. Configure Prometheus scrape and send a real alert test.
4. Observe CSP report-only and resolve unexplained violations.
5. Run retention dry-run and obtain written approval.
6. Run full browser matrix, provider timeout and restore drills.
7. Deploy with retention/CSP enforcement disabled.
8. Collect RUM baseline and observe metrics for at least one representative window.
9. Enable retention or CSP separately under distinct change approvals.

Rollback:

- Set `F1_RETENTION_ENFORCE=false` and `CSP_ENFORCE=false` first.
- Keep Phase 8/9 fields and indexes.
- Do not delete lifecycle jobs or private provider objects manually.
- Roll back app version; restore DB only for confirmed corruption.

## 11. Việc còn lại ngoài codebase

P0 before production:

- Run Phase 8/9 migration + verifier on a staging snapshot.
- Verify authenticated Cloudinary upload/read/delete and orphan scan.
- Wire and test external alert delivery.
- Run backup/restore and record measured RPO/RTO.
- Resolve/report CSP violations before enforce.
- Run current full 3-browser matrix on CI.

P1 observation:

- Collect seven-day RUM baseline by route/device.
- Profile F1, ChatPanel, TrainingSchedule and long lists with production-like volume.
- Address serious contrast backlog and expand axe beyond critical-only.
- Decide legal retention, consent wording, audit/deletion-job retention and export SLA.

## 12. File thay đổi Phase 9

### Core server security/operations

- `server/package.json`
- `server/package-lock.json`
- `server/server.js`
- `server/src/controllers/__tests__/phase9.privacy-operations.integration.test.js`
- `server/src/middlewares/rateLimit.js`
- `server/src/middlewares/requestSanitization.js`
- `server/src/middlewares/requestTelemetry.js`
- `server/src/middlewares/securityHeaders.js`
- `server/src/migrations/20260720-phase9-privacy-operations.js`
- `server/src/models/AuditLog.js`
- `server/src/models/F1Customer.js`
- `server/src/models/F1DataDeletionJob.js`
- `server/src/models/WebVitalSample.js`
- `server/src/observability/metrics.js`
- `server/src/observability/__tests__/metrics.test.js`
- `server/src/routes/ops.routes.js`
- `server/src/scripts/checkRuntimeLogging.js`
- `server/src/scripts/verifyPhase9PrivacyOperations.js`
- `server/src/services/f1PrivacyLifecycle.service.js`
- `server/src/utils/requestContext.js`
- `server/src/utils/safeLogger.js`
- `server/src/utils/__tests__/safeLogger.test.js`

### Server structured-log migration

- `server/src/config/db.js`
- `server/src/config/env.js`
- `server/src/controllers/adminDeposit.controller.js`
- `server/src/controllers/ai.controller.js`
- `server/src/controllers/blog.controller.js`
- `server/src/controllers/booking.controller.js`
- `server/src/controllers/checkin.controller.js`
- `server/src/controllers/coaching.controller.js`
- `server/src/controllers/contact.controller.js`
- `server/src/controllers/customerStory.controller.js`
- `server/src/controllers/deposit.controller.js`
- `server/src/controllers/exercise.controller.js`
- `server/src/controllers/exerciseSuggestion.controller.js`
- `server/src/controllers/f1Customer/aiReport.helpers.js`
- `server/src/controllers/food.controller.js`
- `server/src/controllers/knowledgeBase.controller.js`
- `server/src/controllers/order.controller.js`
- `server/src/controllers/siteSetting.controller.js`
- `server/src/controllers/trainerSubscription.controller.js`
- `server/src/controllers/trainingBooking.controller.js`
- `server/src/controllers/trainingSchedule.controller.js`
- `server/src/controllers/user.controller.js`
- `server/src/controllers/workoutPlan.controller.js`
- `server/src/routes/auth.routes.js`
- `server/src/routes/mealplanAccess.routes.js`
- `server/src/routes/user.routes.js`
- `server/src/services/ai/contextEnricher.js`
- `server/src/services/ai/embedding.service.js`
- `server/src/services/ai/providers/gemini.provider.js`
- `server/src/services/ai/providers/index.js`
- `server/src/services/ai/tools/searchKnowledge.tool.js`
- `server/src/services/cleanupCron.js`
- `server/src/services/contractCron.js`
- `server/src/services/depositCron.js`
- `server/src/services/scheduleReminderCron.js`
- `server/src/services/subscriptionCron.js`
- `server/src/utils/sendMail.js`
- `server/src/utils/triggerBuild.js`

### Client, performance và accessibility

- `client/eslint.config.js`
- `client/scripts/check-bundle-budget.js`
- `client/src/App.jsx`
- `client/src/components/WebVitalsReporter.jsx`
- `client/src/components/ErrorBoundary.jsx`
- `client/src/components/F1/F1AiReportPanel.jsx`
- `client/src/components/F1/F1AssessmentPanel.jsx`
- `client/src/components/F1/F1ForecastPanel.jsx`
- `client/src/components/F1/F1IntakeWizard.jsx`
- `client/src/components/F1/F1ResultPredictionPanel.jsx`
- `client/src/context/AuthContext.jsx`
- `client/src/hooks/useExercisesLogic.js`
- `client/src/hooks/useFoodDatabase.js`
- `client/src/hooks/useMealGenerator.js`
- `client/src/hooks/useMealPlanAccess.js`
- `client/src/pages/BlogDetail.jsx`
- `client/src/pages/ExercisesPage/ExerciseSuggestionBox.jsx`
- `client/src/pages/ExercisesPage/ExercisesPage.jsx`
- `client/src/pages/F1CustomersPage/F1Customers.jsx`
- `client/src/pages/MealPlan/MealPlan.jsx`
- `client/src/pages/admin/BookingManagement.jsx`
- `client/src/pages/admin/CustomerStoryManagement.jsx`
- `client/src/pages/admin/KnowledgeBase.jsx`
- `client/src/pages/admin/SetupProfileModal.jsx`
- `client/src/pages/customer/OnlineCoaching.jsx`
- `client/src/pages/trainer/TrainerCoaching.jsx`
- `client/src/pages/wallet/MyWallet.jsx`
- `client/src/sections/Contact.jsx`
- `client/src/sections/Hero.jsx`

### CI, E2E, security và docs

- `.github/workflows/ci.yml`
- `package.json`
- `package-lock.json`
- `playwright.config.js`
- `scripts/check-secrets.mjs`
- `e2e/accessibility.spec.js`
- `e2e/f1-lifecycle.spec.js`
- `docs/phase-9-data-inventory.md`
- `docs/phase-9-operations-runbook.md`
- `docs/phase-9-fix-report-2026-07-20.md`
- `docs/release-checklist.md`
