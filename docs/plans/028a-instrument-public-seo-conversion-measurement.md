# Plan 028A Tasks: Instrument public SEO/conversion measurement

Status: DONE — LOCAL VERIFIED (LIVE GA4 VALIDATION PENDING)
Parent: `028-build-seo-conversion-analytics.md`

## Boundary

- Giữ nguyên nội dung, điều hướng và giao diện CTA Hero “Nhận tư vấn miễn phí”.
- Không lưu raw IP, user-agent, Google client ID, PII hoặc arbitrary event properties.
- Analytics/storage lỗi phải no-op; Contact và Booking vẫn hoàn thành bình thường.
- Attribution optional/default `null`; documents cũ không cần migration hoặc backfill.
- Không sửa `client/src/utils/api.js`, auth, cookie hoặc CSRF contract.

## Tasks

- [x] Task A1: Khóa analytics và session-attribution contract bằng unit tests
  - Acceptance: Test chứng minh event/parameter dùng allowlist; `gtag`/storage absent hoặc throw vẫn no-op; referrer chỉ còn hostname, landing path bỏ query/hash và external path bị loại.
  - Verify: `cd client && npx vitest run src/utils/__tests__/analytics.test.js src/utils/__tests__/publicAttribution.test.js` → exit 0 sau implementation.
  - Files: `client/src/utils/__tests__/analytics.test.js`, `client/src/utils/__tests__/publicAttribution.test.js`.

- [x] Task A2: Tạo client analytics và attribution utilities fail-safe
  - Acceptance: Chỉ hỗ trợ `blog_read_engaged`, `consultation_cta_click`, `generate_lead`; attribution lưu trong `sessionStorage`, giới hạn chiều dài và không có PII/raw URL.
  - Verify: Focused tests A1 pass; `rg -n "email|phone|name|userId|clientId|userAgent" client/src/utils/analytics.js client/src/utils/publicAttribution.js` không tìm thấy analytics field bị cấm.
  - Files: `client/src/utils/analytics.js`, `client/src/utils/publicAttribution.js`, hai test A1.

- [x] Task A3: Đo engaged blog reader đúng một lần
  - Acceptance: Event chỉ fire khi tab active đủ 30 giây và scroll đạt 50%; cleanup timer/listeners khi route đổi; slug/category/language qua allowlist.
  - Verify: `cd client && npx vitest run src/hooks/__tests__/useBlogEngagement.test.jsx` → cover threshold, inactive tab, dedupe và cleanup.
  - Files: `client/src/hooks/useBlogEngagement.js`, `client/src/hooks/__tests__/useBlogEngagement.test.jsx`, `client/src/pages/BlogDetail.jsx`.

- [x] Task A4: Wire CTA click và lead-success events mà không đổi UX
  - Acceptance: Hero và Blog CTA gửi placement enum trước navigation; Contact/Register chỉ gửi `generate_lead` sau API success; retry cùng request không double count trong page session; Hero label/layout/target giữ nguyên.
  - Verify: Focused component tests xác nhận event timing và payload không chứa form values; manual diff xác nhận Hero CTA không đổi presentation/navigation.
  - Files: `client/src/sections/Hero.jsx`, `client/src/pages/BlogDetail.jsx`, `client/src/sections/Contact.jsx`, `client/src/pages/RegisterPage/RegisterPage.jsx`, `client/src/utils/analytics.js`.

- [x] Task A5: Thêm reusable optional attribution schema
  - Acceptance: `ContactMessage` và `Booking` nhận cùng một strict subdocument optional; field có max length/enum; documents cũ vẫn validate; không index PII và không raw IP.
  - Verify: `cd server && npx vitest run src/models/__tests__/leadAttribution.schema.test.js` → old/new/malicious shapes pass đúng kỳ vọng.
  - Files: `server/src/models/leadAttribution.schema.js`, `server/src/models/ContactMessage.js`, `server/src/models/Booking.js`, `server/src/models/__tests__/leadAttribution.schema.test.js`.

- [x] Task A6: Validate và persist attribution bằng allowlist
  - Acceptance: Public Contact/Booking chấp nhận thiếu attribution; normalize lại mọi field; reject oversized/operator/unknown values; controller không spread `req.body`; idempotency Booking vẫn giữ nguyên.
  - Verify: `cd server && npx vitest run src/controllers/__tests__/leadAttribution.integration.test.js` → cover old payload, valid attribution, malicious input và idempotent retry.
  - Files: `server/src/middlewares/validation.js`, `server/src/controllers/contact.controller.js`, `server/src/controllers/booking.controller.js`, `server/src/controllers/__tests__/leadAttribution.integration.test.js`, `server/src/models/leadAttribution.schema.js`.

- [x] Task A7: Gửi attribution từ hai public lead journeys
  - Acceptance: Contact/Register lấy snapshot đã sanitize và gắn vào payload optional; storage lỗi không chặn submit; service contract/CSRF hiện có không đổi.
  - Verify: Client focused tests + server integration A6; manual payload inspection chỉ có attribution allowlist.
  - Files: `client/src/sections/Contact.jsx`, `client/src/pages/RegisterPage/RegisterPage.jsx`, `client/src/services/contact.service.js`, `client/src/services/booking.service.js`, `client/src/utils/publicAttribution.js`.

- [x] Task A8: Chạy Release A gate và ghi evidence
  - Acceptance: Focused tests, full unit, client lint/build, public lead E2E và security scans pass; không có debug log/secret/unrelated diff do release tạo ra.
  - Verify: `npm run test:unit`; `npm run lint --prefix client`; `npm run build --prefix client`; relevant Playwright specs; `npm run security:secrets`; `npm run security:data-boundaries`; `git diff --check`.
  - Files: Chỉ cập nhật status/evidence trong file này và `docs/plans/README.md`.

## Verification Evidence — 2026-08-05

- Client focused: 3 files / 14 tests pass.
- Server focused: 2 files / 9 tests pass; expanded Booking/Blog regression: 4 files / 24 tests pass.
- Full client unit: 55 files / 271 tests pass.
- Full server unit/integration: 103 files / 472 tests pass in 361.71s.
- Client lint: pass.
- Vite production compile: pass with process-only public `VITE_API_URL`; bundle budget: pass.
- Browser diagnostic on compiled homepage: root length 95,514; page errors: 0.
- Prerender fallback: exit 0, 9/38 static routes rendered; dynamic Blog/Story/Trainer routes skipped because
  the sandbox could not fetch public content. No route or sitemap contract was changed by 028A.
- Chromium E2E: 2/2 pass (Hero CTA navigation/event; Contact attribution + lead event).
- Secret scan, repository data-boundary scan, agent validation and `git diff --check`: pass.
- Not run: live GA4 DebugView/provider verification, staging deploy or production data migration/sync.

## STOP Conditions

- Cần raw IP, persistent fingerprint, PII trong GA4 hoặc sửa auth/CSRF interceptor.
- Contact/Booking outcome phụ thuộc GA4/sessionStorage.
- Schema yêu cầu required field, type change hoặc migration dữ liệu cũ.
- Verification cùng lỗi sau ba vòng sửa có căn cứ.
