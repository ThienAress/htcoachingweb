# Security Audit — 2026-08-02

## Phạm vi

- Focused audit: auth/OAuth/cookies/CSRF, route authorization, F1 ownership/private media,
  deposit/wallet/subscription purchase, request sanitization, dependencies, secrets và data boundaries.
- Chưa audit sâu: non-security business logic, SEO/prerender, performance và visual UI.
- Codex Security CLI dừng ở preflight trước khi sinh worklist; các finding dưới đây được xác minh local
  trực tiếp từ code và có evidence `file:line`.

## Kết quả

| # | Finding | Impact | Effort | Fix risk | Evidence |
|---|---|---:|---:|---:|---|
| SEC-01 | Bind Google OAuth state với browser khởi tạo | HIGH | M | MED | `server/src/routes/auth.routes.js:109,123` |
| SEC-02 | Không trả access token trong JSON refresh | HIGH | S | LOW | `server/src/controllers/auth.controller.js:123` |
| SEC-03 | Chặn trainer tự chuyển ownership hồ sơ F1 | HIGH | S | LOW | `server/src/controllers/f1Customer/customer.controller.js:26,148` |
| SEC-04 | Fail closed cho dev-login bypass | HIGH | S | LOW | `server/src/routes/auth.routes.js:169` |

### [SECURITY-01] Bind Google OAuth state với browser khởi tạo

- **Evidence**: `auth.routes.js:109-119` ký state nhưng không lưu browser nonce;
  `:123-142` chạy Passport trước và không reject state thiếu/sai.
- **Impact**: login CSRF/session swapping có thể khiến nạn nhân thao tác trong tài khoản attacker.
- **Confidence**: HIGH.
- **Fix**: nonce cookie httpOnly + signed state + TTL + timing-safe match trước khi exchange code.

### [SECURITY-02] Không trả access token trong JSON refresh

- **Evidence**: `auth.controller.js:123-128` trả access token dù đã set httpOnly cookie;
  `client/src/utils/api.js:98-102` và `client/src/services/ai.service.js:79-87` không đọc field này.
- **Impact**: XSS có thể đọc/exfiltrate bearer token, làm suy yếu bảo vệ httpOnly.
- **Confidence**: HIGH.
- **Fix**: response chỉ trả sanitized user.

### [SECURITY-03] Chặn trainer tự chuyển ownership hồ sơ F1

- **Evidence**: `f1Customer.routes.js:67-92` cho account có entitlement create/update;
  `customer.controller.js:26-28,148-150` tin `assignedTrainerId` từ body.
- **Impact**: trainer có thể chuyển hồ sơ PII/sức khỏe sang user khác ngoài workflow admin.
- **Confidence**: HIGH.
- **Fix**: non-admin create luôn self-assign; non-admin update assignment trả 403; giữ admin contract.

### [SECURITY-04] Fail closed cho dev-login bypass

- **Evidence**: `auth.routes.js:169-193` bật login-by-email khi `NODE_ENV !== production`.
- **Impact**: runtime thiếu/sai `NODE_ENV` có thể làm auth bypass xuất hiện trên host từ xa.
- **Confidence**: HIGH.
- **Fix**: explicit local-development opt-in và loopback-only.

## Đã xem xét và loại bỏ

- Deposit `status/isOpen`: query transitions đều đồng bộ `isOpen`; financial mutations nằm trong
  transaction cùng ledger/audit log.
- F1 MIME spoof: `f1MediaImage.service.js:43-101` decode bằng Sharp, giới hạn pixel/dimension và
  re-encode WebP trước storage.
- F1 media IDOR/public exposure: ownership + `customerId` filter, authenticated Cloudinary asset và
  signed URL 5 phút.
- CSRF timing: `csrf.js:23-35` đã dùng length check + `timingSafeEqual()`.
- React Router advisory được policy waive vì app là Vite SPA, không dùng RSC action.

## Gates trước implementation

- Secret scan: PASS.
- Repository data-boundary scan: PASS, 0 violation.
- Agent validation: PASS.
- Client/server dependency audit: PASS theo policy.

## Implementation result

- SEC-01 đến SEC-04 đã được sửa theo Plan 019, không đổi schema hoặc dữ liệu.
- Targeted regression: 16 tests passed; full server suite: 85 files, 382 tests passed.
- Client suite: 40 files, 223 tests passed; E2E: 61 tests passed.
- Release build: Vite build, prerender 784/784 routes và bundle budget PASS.
- Secret scan, data-boundary scan, client/server dependency policy, ops tests, agent validation và
  diff hygiene: PASS.
- Codex Security: `PREFLIGHT ONLY`; không chạy paid scan và không dùng preflight như scan result.
- Không chạy migration hoặc staging/production data write.
