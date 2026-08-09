# Plan 028B Tasks: Build Admin SEO analytics read model

Status: DONE — LOCAL VERIFIED (LIVE GOOGLE SYNC + NODE 22 CANONICAL RUN PENDING)
Parent: `028-build-seo-conversion-analytics.md`
Depends on: 028A release gate

## Boundary

- Google credentials chỉ ở backend environment; chỉ read-only scopes.
- Public runtime không gọi Google; dashboard đọc Mongo aggregate/cache.
- Provider-disabled, partial, stale và error là data states, không phải lý do làm hỏng public API.
- Manual sync cần admin JWT, CSRF, rate limit và per-provider concurrency lock.

## Tasks

- [x] Task B1: Khóa aggregate và sync-state schema bằng tests
  - Acceptance: Unique compound key bounded/idempotent; dimensions là enum/normalized strings; sync error chỉ giữ sanitized code/message; không có PII/raw provider payload.
  - Verify: `cd server && npx vitest run src/models/__tests__/seoAnalytics.models.test.js` → cover duplicate replay, invalid dimensions và old/empty state.
  - Files: `server/src/models/SeoDailyMetric.js`, `server/src/models/AnalyticsSyncState.js`, `server/src/models/__tests__/seoAnalytics.models.test.js`.

- [x] Task B2: Thêm Google SDKs như direct dependencies
  - Acceptance: GA4 Data API và GSC client được khai báo trực tiếp; không dùng package transitive; không có credential/default secret trong repo.
  - Verify: `npm ls --prefix server @google-analytics/data googleapis` → cả hai là direct dependencies; `npm run security:secrets` pass.
  - Files: `server/package.json`, `server/package-lock.json`.

- [x] Task B3: Tạo GA4 read-only adapter
  - Acceptance: Env validation, timeout/retry hữu hạn, metric/dimension/row allowlist; map happy/empty/malformed/timeout thành internal contract; safeLog không chứa request/credential.
  - Verify: `cd server && npx vitest run src/services/__tests__/googleAnalytics.provider.test.js` → fixture cases pass, network mocked.
  - Files: `server/src/services/googleAnalytics.provider.js`, `server/src/services/__tests__/googleAnalytics.provider.test.js`.

- [x] Task B4: Tạo GSC read-only adapter
  - Acceptance: Scope `webmasters.readonly`; page/query/date mapping; bounded rows/pagination; kết quả đánh dấu top-row limitation; không lưu raw response.
  - Verify: `cd server && npx vitest run src/services/__tests__/googleSearchConsole.provider.test.js` → happy/empty/malformed/timeout pass, network mocked.
  - Files: `server/src/services/googleSearchConsole.provider.js`, `server/src/services/__tests__/googleSearchConsole.provider.test.js`.

- [x] Task B5: Xây sync/aggregation service cache-first
  - Acceptance: Upsert idempotent theo provider/date/dimension/content key; per-provider lock; partial provider không xóa cache tốt; last-success/error sanitized; public request path không import service này.
  - Verify: `cd server && npx vitest run src/services/__tests__/seoAnalyticsSync.service.test.js` → replay, partial, timeout, lock và stale fallback pass.
  - Files: `server/src/services/seoAnalyticsSync.service.js`, `server/src/services/seoAnalyticsRead.service.js`, `server/src/services/__tests__/seoAnalyticsSync.service.test.js`, hai model B1.

- [x] Task B6: Khóa Admin API/RBAC contract
  - Acceptance: Overview/blog/keyword/detail endpoints validate bounded date/filter/sort/page/limit; 401/403 đúng; DTO chỉ aggregate; manual sync bắt buộc CSRF/rate limit/admin và trả conflict khi đang chạy.
  - Verify: `cd server && npx vitest run src/routes/__tests__/seoAnalytics.routes.integration.test.js` → auth, validation, stale cache, sync CSRF/rate/lock pass.
  - Files: `server/src/routes/seoAnalytics.routes.js`, `server/src/controllers/seoAnalytics.controller.js`, `server/src/routes/__tests__/seoAnalytics.routes.integration.test.js`, `server/src/middlewares/validation.js`, `server/src/services/seoAnalyticsRead.service.js`.

- [x] Task B7: Đăng ký route và limiter chuyên biệt
  - Acceptance: `/api/admin/analytics` đăng ký một lần; reads admin-only; mutation order gồm auth + CSRF + limiter + role theo project convention; không nới global limiter.
  - Verify: Route integration B6 pass; `rg -n "seoAnalytics|analyticsSyncLimiter" server/server.js server/src/routes/seoAnalytics.routes.js server/src/middlewares/rateLimit.js` cho đúng một registration/export.
  - Files: `server/server.js`, `server/src/middlewares/rateLimit.js`, `server/src/routes/seoAnalytics.routes.js`.

- [x] Task B8: Tạo frontend service và TanStack Query contracts
  - Acceptance: Mọi API call nằm trong service; query keys chứa normalized filters; keep-previous-data/pagination và manual-sync invalidation theo convention; component không import axios.
  - Verify: `cd client && npx vitest run src/queries/__tests__/seoAnalytics.queries.test.js` → keys, abort signal, DTO mapping và invalidation pass.
  - Files: `client/src/services/seoAnalytics.service.js`, `client/src/queries/seoAnalytics.queries.js`, `client/src/queries/queryKeys.js`, `client/src/queries/__tests__/seoAnalytics.queries.test.js`.

- [x] Task B9: Tạo lazy Admin route, navigation và page shell
  - Acceptance: `/admin/seo-analytics` nằm dưới `AdminRoute`; nav dưới Hoạt động; page có date/filter controls, `lastSyncedAt`, provider status và mobile layout; không public SEO route.
  - Verify: Chromium Admin E2E xác nhận lazy route dưới admin shell, keyboard labels, provider states và bounded sync payload.
  - Files: `client/src/App.jsx`, `client/src/layouts/AdminLayout.jsx`, `client/src/pages/admin/SeoAnalyticsPage.jsx`, `e2e/admin-seo-analytics.spec.js`.

- [x] Task B10: Xây overview, blog, keyword và detail states
  - Acceptance: KPI/funnel phân biệt GSC, GA4, DB và legacy views; server pagination; loading/empty/not-configured/partial/stale/error/retry; không nested-card spam/gradient/glassmorphism.
  - Verify: Query contract tests + Chromium Admin E2E cover KPI/provider health, retry, bounded sync, Blog detail, legacy label, mobile keyword alternative, accessible names và drawer focus lifecycle.
  - Files: `client/src/pages/admin/seo-analytics/AnalyticsOverview.jsx`, `client/src/pages/admin/seo-analytics/BlogPerformanceTable.jsx`, `client/src/pages/admin/seo-analytics/KeywordPerformanceTable.jsx`, `client/src/pages/admin/seo-analytics/AnalyticsDetailDrawer.jsx`, `client/src/queries/__tests__/seoAnalytics.queries.test.js`, `e2e/admin-seo-analytics.spec.js`.

- [x] Task B11: Chạy Release B gate và ghi evidence
  - Acceptance: Server RBAC/integration, client tests, full unit, lint/build, Chromium Admin E2E, security/governance pass; provider unavailable vẫn render stale/disabled state.
  - Verify: `npm run test:unit`; `npm run lint --prefix client`; `npm run build --prefix client`; relevant Playwright spec; security scans; `npm run agents:validate`; `git diff --check`.
  - Files: `e2e/admin-seo-analytics.spec.js`, file này, `docs/plans/README.md`.

## Verification Evidence — 2026-08-05

- Backend analytics focused: 6 files / 30 tests pass; cover model indexes/validation, GA4/GSC mapping,
  timeout/PII filtering, sync lock/idempotency/stale cache, read model và Admin RBAC/CSRF/API validation.
- Frontend analytics focused: 2 files / 12 tests pass; query keys, filters, abort signal và service DTO
  contracts giữ đúng TanStack Query/service layering.
- Full client unit: 56 files / 276 tests pass.
- Full server coverage: 109 files / 502 tests pass in 659.57s với Vitest
  `--pool=threads --maxWorkers=1`.
- Canonical fork pool trên máy local Node 24.15.0 đã chạy 108/109 files và 491/502 tests nhưng một worker
  bị hệ điều hành kết thúc bất ngờ, không có assertion failure. Repo yêu cầu Node 22.23.1; cần chạy lại đúng
  engine chuẩn trước deploy để có canonical release evidence.
- Client lint: pass.
- Release build: pass (sitemap fallback, Vite production compile, prerender và bundle budget); lazy
  `SeoAnalyticsPage` chunk 34.14KB raw / 7.35KB gzip.
- Prerender fallback: exit 0, 9/38 static routes rendered; dynamic Blog/Story/Trainer routes skipped vì
  sandbox không thể fetch public API. Release B không thay public SEO route/sitemap contract.
- Chromium Admin E2E: 4/4 pass; cover KPI/provider states, Blog detail + legacy views, drawer focus/Escape,
  responsive keyword list, overview retry và bounded manual sync.
- Scoped Product UI check: pass sau khi chuẩn hóa touch target 44px, mobile keyword layout, semantic
  modal z-index, hover/focus states và emerald interaction accent; không còn finding mở.
- Secret scan, repository data-boundary scan, agent validation và `git diff --check`: pass.
- Không chạy live GA4/GSC sync, staging deploy, migration/backfill hoặc ghi dữ liệu thật.

## STOP Conditions

- Credential/token phải xuất hiện ở client, log, test fixture hoặc committed file.
- Provider sync có thể block public routes hoặc xóa cache tốt khi một provider lỗi.
- DTO phải trả raw Google response/PII để UI hoạt động.
- Cần chạy live sync/staging migration mà chưa có target và quyền riêng.
