# Spec: Harden refresh-session security

## Approval and assumptions

- User explicitly authorized implementing P0/P1 findings immediately on 2026-09-05.
- No P0 exploit or active production compromise was confirmed from the five reviewed sources.
- This spec treats refresh/logout hardening as P1 and preserves the current single-active-session-per-user behavior.
- Legacy bcrypt verifiers cannot safely distinguish full JWTs because bcrypt truncates after 72 bytes;
  existing sessions therefore fail closed and require one login after rollout. No database backfill is required.

## Objective

Close the verified refresh-token replay, concurrent rotation, logout and sliding-lifetime gaps without
changing the browser's cookie-only auth contract. A stolen or concurrently replayed refresh token must
not leave another token from the same family active, logout must still revoke the refresh credential when
the access token is absent or expired, and rotation must never extend the initial seven-day lifetime.

## Priority triage

- **P0**: none confirmed in this review. Escalate only if live exploitation, credential disclosure or an
  auth bypass is evidenced.
- **P1 in scope**: atomic rotation, refresh-token family/JTI, same-family reuse revocation, refresh-backed
  logout, fixed absolute lifetime and a coordinated legacy-session cutover.
- **P2+ deferred**: multi-device session UI/API, device naming, remote session revocation, inactive-session
  cleanup UX, Playwright MCP pilot, AI commerce provenance/staged mutation and evidence-driven scaling.

## Tech stack

- Express 5 routes and controllers.
- Mongoose 9 `User` model.
- `jsonwebtoken` 9 and `bcryptjs` 3.
- HttpOnly access/refresh cookies plus the existing timing-safe CSRF middleware.
- Vitest, Supertest and `mongodb-memory-server` replica-set test runtime.

## Product and security requirements

### REQ-001 Atomic rotation and replay containment

- AC-001: Two refresh requests using the same current token cannot both commit a replacement; the
  compare-and-swap loser revokes the active token in that same family.
- AC-002: Reusing a previously rotated token returns the existing generic invalid-token contract and
  revokes the currently active token from the same family without logging token, JTI or family values.

### REQ-002 Logout independent of access-token validity

- AC-003: `POST /api/auth/logout` with a valid refresh cookie revokes its family and clears auth/CSRF
  cookies even when the access cookie is missing or expired.
- AC-004: Logout remains CSRF-protected and idempotently clears cookies when the refresh cookie is
  missing, invalid or already revoked; unexpected persistence failures remain observable as server errors.

### REQ-003 Absolute refresh lifetime

- AC-005: Every rotated refresh JWT and cookie expires no later than the absolute expiry established
  by the initial login.
- AC-006: A legacy refresh token without family/JTI is rejected, its browser cookie is cleared and the
  matching legacy-only database verifier is nulled without a bcrypt comparison; the user re-authenticates
  once and existing documents need no bulk backfill.

### REQ-004 Compatibility and secrecy

- AC-007: Access and refresh tokens remain HttpOnly-cookie-only; refresh JSON contains only the
  sanitized user contract and no token/session identifiers.
- AC-008: The existing 15-minute access-token duration, seven-day maximum refresh duration, CSRF
  behavior, client interceptor and single-active-session semantics remain unchanged.
- AC-009: Implementation and tests perform no staging/production writes, seed, cleanup or migration.

## File surface

- `server/src/models/User.js`: additive hidden refresh-family metadata.
- `server/src/services/authSession.service.js`: issue, rotate and revoke session credentials.
- `server/src/controllers/auth.controller.js`: HTTP mapping, cookies and sanitized responses.
- `server/src/routes/auth.routes.js`: login issuance and logout middleware wiring.
- `server/src/__tests__/setup.js`: issue representative family-aware test sessions.
- `server/src/controllers/__tests__/auth.refresh-session.integration.test.js`: public HTTP regressions.
- `server/src/controllers/__tests__/auth.logout-session.integration.test.js`: refresh-backed logout regressions.
- `server/src/scripts/singleAccountSync.runtime.js` and its test: preserve target refresh-family metadata.
- `docs/operations/runbooks/refresh-session-cutover.md`: mandatory drain and forward-only recovery procedure.
- Spec, Plan 082, plan indexes/state and traceability evidence.

## Testing strategy

- RED/GREEN integration tests through `/api/auth/refresh` and `/api/auth/logout`.
- Cover happy rotation, concurrent duplicate use, replay after rotation, missing/expired access logout,
  CSRF rejection, absolute expiry, legacy fail-closed cutover and auth-preserving account sync.
- Run focused auth tests, complete server unit/integration suite, secret/data-boundary scans and diff hygiene.
- E2E is skipped unless a suitable authenticated browser fixture is available; no frontend behavior changes.

## Boundaries

### Always

- Validate signed token claims before building database filters.
- Use an HMAC-SHA256 digest of the complete refresh JWT and an atomic database compare-and-swap.
- Return generic client errors and log only stable security event metadata.
- Keep all new security metadata `select: false`.

### Stop and ask

- A solution requires changing SameSite/HttpOnly/CSRF semantics, token secrets or OAuth provider config.
- Existing data requires destructive migration/backfill or a production/staging write.
- Multi-device support becomes necessary to meet P1 correctness.

### Never

- Never return or log raw access/refresh tokens, hashes, JTI or family identifiers.
- Never disable CSRF/rate limiting or edit `client/src/utils/api.js` for this change.
- Never run migration, seed, cleanup, commit, push or deploy as part of this implementation.

## Success criteria

- AC-001 through AC-009 have executable traceability evidence.
- Focused refresh/logout tests and the existing auth security tests pass.
- Full server tests and repository security gates pass, or blockers are reported without being called pass.
- No production/staging data or auth configuration is changed.
- Rollout follows `docs/operations/runbooks/refresh-session-cutover.md`; old/new versions must not serve Auth
  concurrently and a pre-082 server build is not an eligible rollback target.
