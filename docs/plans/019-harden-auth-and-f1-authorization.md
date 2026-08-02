# Plan 019: Harden auth và F1 authorization

> Thực thi theo thứ tự; nếu gặp STOP condition thì không mở rộng sang schema, migration hoặc
> production data.
>
> **Drift check**: xác nhận các evidence trong Current State còn đúng trước khi sửa.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: none
- **Category**: security
- **Planned at**: 2026-08-02
- **Execution**: DONE / LOCAL VERIFIED

## Why This Matters

OAuth callback phải thuộc đúng browser đã bắt đầu login, JWT phải chỉ nằm trong httpOnly cookie, và
assignment hồ sơ sức khỏe phải do backend enforce. Plan đóng bốn đường bypass/leak mà không đổi schema
hoặc dữ liệu hiện có.

## Current State

- `server/src/routes/auth.routes.js:109-142`: state không bind browser và callback không fail closed.
- `server/src/routes/auth.routes.js:169-193`: dev-login dùng negative production check.
- `server/src/controllers/auth.controller.js:123-128`: refresh body chứa access token.
- `client/src/utils/api.js:98-102`, `client/src/services/ai.service.js:79-87`: consumers không đọc token.
- `server/src/controllers/f1Customer/customer.controller.js:26-28,148-150`: body điều khiển assignment.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Auth tests | `cd server && npx vitest run src/utils/__tests__/oauthState.test.js src/controllers/__tests__/phase0.security.integration.test.js` | exit 0 |
| F1 tests | `cd server && npx vitest run src/controllers/__tests__/f1Customer.authorization.integration.test.js` | exit 0 |
| Server suite | `npm run test:unit:server` | exit 0 |
| Security | `npm run security:secrets`; `npm run security:data-boundaries` | exit 0 |

## Scope

**In scope**:

- `server/src/utils/oauthState.js` và unit test.
- `server/src/routes/auth.routes.js`.
- `server/src/controllers/auth.controller.js` và phase-0 test.
- `server/src/controllers/f1Customer/customer.controller.js` và authorization integration test.
- `server/src/scripts/stagingIntegrations.js` nếu cần assert nonce cookie.
- Audit/plan/index documents.

**Out of scope**:

- JWT duration, refresh rotation model, access/refresh/CSRF SameSite.
- Mongoose schema/index, migration/backfill.
- Client auth interceptor.
- Staging/production write, seed, cleanup, migration và deploy.

## Steps

### 1. Viết regression tests RED

- OAuth: signature, TTL và browser nonce.
- Refresh: body không có access/refresh token.
- F1: trainer không thể create/update assignment sang trainer khác; admin vẫn reassign được.
- Dev-login: thiếu opt-in hoặc non-loopback phải fail closed.

### 2. Bind OAuth state và khóa dev-login

- Signed state chứa nonce; nonce cookie httpOnly, Secure ở production, SameSite Lax, callback path,
  TTL 5 phút.
- Verify trước Passport; invalid/missing/mismatch fail closed.
- Dev-login chỉ đăng ký khi explicit development opt-in và chỉ nhận loopback.
- Không log state/cookie/token; giữ redirect allowlist.

### 3. Giữ refresh cookie-only

- Bỏ `data.token`; giữ Set-Cookie và sanitized user.
- Không sửa client vì consumers chỉ await success.

### 4. Enforce F1 assignment

- Non-admin create luôn `req.user.id`.
- Non-admin update có `assignedTrainerId` trả 403.
- Admin assignment/unassign và `assertCustomerAccess()` giữ nguyên.

### 5. Re-trace và chạy gates

- Targeted tests, full server suite, secret/data-boundary/dependency gates, `git diff --check`.
- Đọc toàn bộ diff và cập nhật plan status/evidence thực tế.

## Done Criteria

- [x] OAuth callback reject trước code exchange nếu state không bind browser.
- [x] Refresh JSON không chứa token.
- [x] Trainer không thể chuyển F1 ownership; admin vẫn làm được.
- [x] Dev-login mặc định không đăng ký và không nhận remote request.
- [x] Targeted + full server tests pass.
- [x] Security/dependency gates pass.
- [x] Không schema/migration/production data change.

## Execution Results

- OAuth state dùng signed payload + browser nonce cookie httpOnly, TTL 5 phút và timing-safe compare;
  callback invalid bị redirect trước Passport.
- Refresh response chỉ còn sanitized user; access/refresh token tiếp tục nằm trong httpOnly cookies.
- Trainer create luôn self-assign; trainer update assignment trả
  `F1_ASSIGNMENT_ADMIN_REQUIRED`; admin reassignment vẫn pass.
- Dev-login chỉ đăng ký với `NODE_ENV=development` + `ENABLE_DEV_LOGIN=true` và chỉ nhận loopback.
- Targeted security tests: 16 passed.
- Full server suite: 85 files, 382 tests passed.
- Client suite: 40 files, 223 tests passed; E2E: 61 tests passed.
- Release build: Vite build, prerender 784/784 routes và bundle budget PASS.
- Secret scan, repository data-boundary scan, client/server dependency audit, ops tests,
  agent validation và diff hygiene: PASS.
- Live Google provider round trip vẫn chờ staging verification; route-level guard và staging integration
  assertion đã được bổ sung. Không ghi staging/production data.

## STOP Conditions

- Fix cần đổi provider/callback URL hoặc cookie SameSite của auth/CSRF.
- Có product contract cho phép trainer tự chuyển F1 ownership mà docs/code hiện chưa thể hiện.
- Cùng verification fail ba vòng.
- Cần production/staging write hoặc migration.

## Maintenance Notes

- OAuth state cookie không thay CSRF cookie.
- Workflow chuyển F1 giữa trainer trong tương lai phải là admin endpoint/service riêng có audit log.
