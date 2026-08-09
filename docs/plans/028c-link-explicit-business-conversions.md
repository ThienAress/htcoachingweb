# Plan 028C Tasks: Link explicit business conversions

Status: DONE / NODE 22 LOCAL VERIFIED — STAGING INDEX APPLY + STRICT PRERENDER PENDING
Parent: `028-build-seo-conversion-analytics.md`
Depends on: 028B release gate

## Boundary

- Chỉ tính assessment/customer conversion khi có reference explicit.
- Không auto-match bằng email, phone, social handle hoặc tên.
- Fields mới optional; documents cũ giữ `unattributed`; không backfill suy đoán.
- Không đổi amount, currency, approval/payment status hoặc entitlement của Order.

## Tasks

- [x] Task C1: Khóa origin-reference contract và compatibility bằng tests
  - Acceptance: Chỉ một trong `originBookingId`/`originContactMessageId`; ObjectId hợp lệ/tồn tại; old document valid; invalid/cross-reference bị reject; no PII matching.
  - Verify: `cd server && npx vitest run src/models/__tests__/conversionOrigin.schema.test.js` → contract cases pass sau implementation.
  - Files: `server/src/models/conversionOrigin.schema.js`, `server/src/models/__tests__/conversionOrigin.schema.test.js`.

- [x] Task C2: Thêm optional origin vào F1Customer
  - Acceptance: Schema/index optional; create allowlist rõ ràng; backend kiểm tra source tồn tại; chỉ admin được gắn origin, trainer vẫn tạo F1 không origin theo quyền hiện có; missing origin không đổi behavior.
  - Verify: Focused F1 authorization test cover old create, booking/contact origin, missing source, mutual exclusion và forbidden actor.
  - Files: `server/src/models/F1Customer.js`, `server/src/services/conversionOrigin.service.js`, `server/src/controllers/f1Customer/customer.controller.js`, `server/src/middlewares/validation.js`, `server/src/controllers/__tests__/f1Customer.authorization.integration.test.js`, test C1.

- [x] Task C3: Thêm optional origin vào Order mà không chạm tài chính
  - Acceptance: Schema/controller chỉ persist validated origin; order amount/status/approval/idempotency giữ nguyên; source existence/authorization checked; old create valid.
  - Verify: `cd server && npx vitest run src/controllers/__tests__/orderConversionOrigin.integration.test.js` → origin/IDOR/regression cases pass.
  - Files: `server/src/models/Order.js`, `server/src/services/conversionOrigin.service.js`, `server/src/controllers/order.controller.js`, `server/src/middlewares/validation.js`, `server/src/controllers/__tests__/orderConversionOrigin.integration.test.js`, test C1.

- [x] Task C4: Thêm explicit origin controls vào Admin workflow
  - Acceptance: Admin chọn đúng Contact/Booking khi tạo/chuyển F1/Order; UI không đoán theo PII; error/conflict/retry rõ; client service chỉ gửi IDs allowlisted.
  - Verify: Focused UI/service tests xác nhận missing/invalid/forbidden response và không gửi name/email/phone làm key.
  - Files: `client/src/components/admin/ConversionOriginFields.jsx`, `client/src/hooks/useConversionOriginOptions.js`, `client/src/utils/conversionOrigin.js`, `client/src/pages/F1CustomersPage/F1Customers.jsx`, `client/src/components/F1/F1CreateCustomerForm.jsx`, `client/src/pages/admin/Orders.jsx`, `client/src/services/f1Customer.service.js`, `client/src/services/order.service.js`, `client/src/services/__tests__/conversionOrigin.service.test.js`, `e2e/conversion-origin.spec.js`.

- [x] Task C5: Tổng hợp funnel từ references explicit
  - Acceptance: Read service join/aggregate chỉ theo ObjectId origin; missing là `unattributed`; một conversion không double count; no raw lead PII trong DTO.
  - Verify: `cd server && npx vitest run src/services/__tests__/seoConversionFunnel.service.test.js` → attributed/unattributed/dedup/deleted-source cases pass.
  - Files: `server/src/services/seoConversionFunnel.service.js`, `server/src/services/seoAnalyticsRead.service.js`, `server/src/services/__tests__/seoConversionFunnel.service.test.js`.

- [x] Task C6: Tạo index verification dry-run, không backfill
  - Acceptance: Script mặc định chỉ inspect/report; mutation cần explicit confirmation flag + target; không đọc/in PII; không chạy staging/production trong implementation.
  - Verify: Local fixture dry-run exit 0 và database state unchanged; mutation mode không có flag phải fail closed.
  - Files: `scripts/verify-seo-conversion-indexes.mjs`, `package.json`, `server/src/models/F1Customer.js`, `server/src/models/Order.js`.

- [x] Task C7: Chạy Release C gate và ghi evidence
  - Acceptance: Schema compatibility, F1/Order authorization, financial regressions, funnel tests, client build và security scans pass; không có migration/backfill thật.
  - Verify: Focused tests; `npm run test:unit`; client lint/build; security scans; dry-run local; `git diff --check`.
  - Files: File này và `docs/plans/README.md`.

## Verification Evidence — 2026-08-06

- Focused client: 3 files / 15 tests pass; cover payload allowlist, origin helper và admin query/service contract.
- Focused server + financial regression: 6 files / 31 tests pass; cover schema compatibility, mutual exclusion,
  admin/trainer authorization, source existence, Order allowlist/financial boundary và funnel dedupe/unattributed cases.
- Full client unit trên Node 22.23.1: 57 files / 279 tests pass. Lazy-import test hai lần vượt mặc định 5s
  trên runtime portable; timeout riêng được tăng lên 15s, focused 6/6 và full 279/279 rerun đều pass mà
  không đổi product code hoặc assertion.
- Full server unit/integration: 112 files / 520 tests pass với Vitest
  `--pool=threads --maxWorkers=1` trên Node 22.23.1. Default pool timeout sau 15 phút trước summary,
  không có assertion failure; single-thread pass 112/112 files và 520/520 tests trong 959.79s.
- Relevant Chromium E2E trên Node 22.23.1: 14/14 pass, 1 worker; cover accessibility, Admin dashboard,
  explicit origin flow và authorization `/trainer`. Manual Node 22 dev/mock servers được dùng để tránh
  Windows Playwright webServer cleanup hang; final command exit 0 trong 82.7s.
- Client lint chạy trực tiếp bằng Node 22.23.1: pass, không warning.
- Local static release build cuối trên Node 22.23.1: exit 0; Vite compile, 8/9 static prerender và bundle
  budget pass. Homepage bị skip vì local snapshot thiếu 7 Service offers dù browser diagnostic trước đó xác
  nhận bundle render root 95,795 ký tự, title/canonical đúng. Strict staging-backed prerender vẫn là gate
  bắt buộc trước deploy.
- Scoped Product UI check: pass sau khi bổ sung accessible labels, error association, focus states và touch target;
  không có gradient text, glassmorphism, bounce hoặc nested-card finding mới.
- Secret scan, repository data-boundary scan, agent validation, commercial contract boundary và
  `git diff --check`: pass.
- `npm run verify:seo-conversion-indexes`: Node 22 dry-run pass; chế độ `--apply` thiếu confirmation/local URI
  bị chặn với exit 1 đúng thiết kế.
- Local apply trên MongoMemoryServer loopback tạm thời: pass; đọc lại index vật lý xác nhận đủ bốn unique
  partial ObjectId indexes ở `f1customers` và `orders`. Máy không có Mongo local persistent, `mongod`, Docker
  hoặc `MONGODB_URI`, nên không giả định target khác.
- Staging target đã xác định là Render staging với exact database `htcoaching_staging`. Chưa apply vì verifier
  hiện chỉ chấp nhận `--target=local` và phiên này không nạp staging credential; cần guard staging riêng và
  xác nhận target ở thời điểm chạy. Production không nằm trong target.
- Admin sidebar đã bỏ entry trùng “Huấn luyện học viên”; route `/trainer` và chức năng quản lý khách hàng vẫn
  giữ nguyên. Đồng thời bổ sung focus state, `aria-expanded` và touch target 44px cho sidebar.
- Không chạy migration/backfill, staging/production sync, deploy, commit hoặc push.

## STOP Conditions

- Nghiệp vụ đòi auto-match bằng PII hoặc thay đổi financial/entitlement semantics.
- Field phải required/type-changed hoặc dữ liệu cũ cần backfill để app chạy.
- Không chứng minh được ownership/role khi gắn origin.
- Cần chạy index/migration trên staging/production mà chưa xác nhận target riêng.
