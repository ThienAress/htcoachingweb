# Plan 082: Harden refresh-session rotation and logout

> **Execution**: Follow each vertical behavior step and run its focused verification before continuing.
> Stop instead of improvising if a boundary below is reached.
>
> **Drift check**: `git status --short -- <in-scope paths>` must show no pre-existing Auth code changes.
> At planning time only `docs/plans/README.md` and the untracked machine-state files were already dirty;
> Auth runtime/model/test files had no working-tree diff.

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 019, 020
- **Category**: security
- **Planned at**: 2026-09-05
- **Lifecycle**: DONE
- **Verification**: LOCAL FULL
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-05

## Why This Matters

The current code rotates a bcrypt-hashed refresh token with `find → compare → save`, so two requests can
both validate before either save completes. It also forgets the relationship between rotated tokens,
requires a valid access token for logout, and resets the cookie/JWT lifetime to seven days at every
refresh. Bcrypt also truncates these JWT inputs after 72 bytes, so different tokens with a shared prefix
can verify against the same hash. Plan 082 uses a full-token HMAC digest and atomic replay-aware rotation
while retaining cookie-only auth; legacy sessions fail closed and re-authenticate once.

## Current State

- `server/src/controllers/auth.controller.js:90-135`: verifies the token, compares one bcrypt hash and
  saves a replacement non-atomically; each replacement receives a new seven-day expiry.
- `server/src/controllers/auth.controller.js:138-164`: logout revokes by `req.user`, which is populated
  only when the access token passes middleware.
- `server/src/routes/auth.routes.js:168-176,204-211`: Google/dev login issue tokens and write the hash
  directly on `User`.
- `server/src/routes/auth.routes.js:221-222`: refresh has CSRF; logout currently requires `protect` first.
- `server/src/models/User.js:105-109`: only the current bcrypt hash is persisted and hidden.
- `client/src/utils/api.js:39-112`: one-tab refresh mutex and logout/refresh retry exclusions already exist;
  this sensitive file remains out of scope.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Focused Auth | `cd server && npx vitest run src/controllers/__tests__/auth.refresh-session.integration.test.js src/controllers/__tests__/auth.logout-session.integration.test.js src/controllers/__tests__/phase0.security.integration.test.js src/routes/__tests__/auth.routes.security.test.js` | exit 0 |
| Server QA | `cd server && npx vitest run --shard=1/4` through `--shard=4/4` | every shard exits 0 |
| Secrets | `npm run security:secrets` | exit 0 |
| Data boundaries | `npm run security:data-boundaries` | exit 0 |
| Agent contracts | `npm run agents:validate` | exit 0 or unrelated dirty-worktree blocker documented |
| Hygiene | `git diff --check` | no in-scope whitespace errors |

## Scope

**In scope**:

- `server/src/models/User.js`
- `server/src/services/authSession.service.js`
- `server/src/controllers/auth.controller.js`
- `server/src/routes/auth.routes.js`
- `server/src/__tests__/setup.js`
- `server/src/controllers/__tests__/auth.refresh-session.integration.test.js`
- `server/src/controllers/__tests__/auth.logout-session.integration.test.js`
- `server/src/scripts/singleAccountSync.runtime.js`
- `server/src/scripts/__tests__/singleAccountSync.runtime.test.js`
- `server/src/scripts/__tests__/singleAccountSync.contract.test.js`
- `docs/specs/refresh-session-security.md`
- `docs/plans/082-harden-refresh-session-rotation-and-logout.md`
- `docs/operations/runbooks/refresh-session-cutover.md`
- `docs/operations/runbooks/release-promotion.md`, `docs/operations/runbooks/production-rollback-runbook.md`
- `docs/plans/traceability/082.json`
- `docs/README.md`, `docs/plans/README.md`, `docs/plans/plan-state.json`

**Out of scope**:

- `client/src/utils/api.js`, `client/src/context/AuthContext.jsx` and all frontend UI.
- Cookie SameSite/HttpOnly policy, CSRF implementation, JWT/refresh secrets and OAuth provider config.
- Multi-device session management UI/API or a new session collection.
- Staging/production migration, data write, deploy, commit or push.
- P2+ Playwright MCP, commerce-agent and scale improvements.

## Steps

### Step 1: Rotate one refresh-token family atomically

Write one public HTTP regression at a time, confirm RED, then introduce additive hidden family/JTI/absolute
expiry fields and an auth-session service. New login/test sessions carry a signed family and standard JTI.
Refresh compares a full-token HMAC digest and commits the replacement with a database CAS; a CAS loser or
same-family stale JTI revokes the family and returns a generic 403.

**Behavior**: one request can rotate a token; duplicate concurrent use cannot leave a usable successor.

**Blast radius**: User auth metadata, issuance paths, refresh controller, test setup and focused integration test.

**Depends on**: none.

**Verify**: focused test cases for happy rotation, concurrent duplicate use and replay all pass.

### Step 2: Revoke by refresh credential during logout

Add RED tests for logout with no access cookie and for missing/invalid refresh cookies. Remove only the
`protect` requirement from the logout route, retain CSRF, verify the refresh JWT in the session service and
revoke only the matching current family. Always clear browser cookies; surface unexpected database errors.

**Behavior**: an expired/missing access token no longer prevents server-side refresh revocation.

**Blast radius**: auth route, controller, session service and the same HTTP integration test.

**Depends on**: Step 1.

**Verify**: valid-refresh logout, idempotent invalid logout and CSRF rejection cases pass.

### Step 3: Enforce absolute lifetime and fail closed for legacy sessions

Add RED tests proving a rotated token/cookie cannot outlive its family's initial expiry and that an existing
legacy token without family/JTI is rejected without bcrypt comparison. Preserve `refreshSession` beside
the verifier in one-account sync so target-only authentication state cannot be split; do not backfill documents.

**Behavior**: refresh rotation never creates an indefinitely sliding seven-day session, while current users
receive a one-time re-login at cutover instead of remaining replayable.

**Blast radius**: session service, cookie max-age mapping, model metadata, account-sync preservation and tests.

**Depends on**: Step 1.

**Verify**: decoded JWT expiry, Set-Cookie max-age, legacy rejection and account-sync preservation assertions pass.

### Step 4: Re-trace, review and close local evidence

Re-run the dependency map, inspect the complete in-scope diff, run focused and full server/security gates,
then obtain an independent read-only security review. Update plan state and evidence only with commands
actually executed.

**Behavior**: the P1 contract is locally verified without frontend or environment mutation.

**Blast radius**: documentation/state only after code verification.

**Depends on**: Steps 1-3.

**Verify**: commands in the Commands table and traceability validators report their real outcomes.

## Test Plan

- Public seam: actual Express auth router mounted on the in-memory Mongo replica set.
- Cases: happy rotation; no double-success under concurrency; old-token replay revokes successor; valid
  refresh logout without access; logout CSRF; fixed absolute JWT/cookie expiry; legacy rejection;
  cookie-only response and hidden model metadata.
- Existing regressions: phase-0 security integration, auth route security and auth middleware suites.

## Done Criteria

- [x] AC-001 through AC-009 pass through linked evidence.
- [x] New refresh metadata is additive, hidden and needs no backfill; legacy sessions fail closed.
- [x] No frontend auth file, CSRF policy or cookie security attribute changes.
- [x] Focused and full server/security verification results are recorded accurately.
- [x] Independent review has no unresolved BLOCK/HIGH/MED finding.
- [x] No migration or environment write occurred within Plan 082 verification; no deploy, commit or push occurred.
- [x] Plan index, state and traceability manifest match final lifecycle/evidence.

## Execution Results

- Evidence snapshot: `2026-09-05T15:09:13+07:00`, Git HEAD
  `833ed32f75d9126a7afa6da3f29aaf0f634447af`, plus the documented working-tree changes.
- Focused Auth, middleware and account-sync regression: 7 files, 53 tests passed.
- Full server suite was partitioned only to fit the local runner lifetime: shards passed with
  `53/288`, `53/313`, `53/337` and `52/288` files/tests, for 211 files and 1,226 tests total.
- The unsharded invocation exceeded the local runner lifetime before a final summary. Shard 3 exited 0
  after Vitest passed every test but force-closed one lingering child process; another shard emitted only
  the existing Mongoose `validateSync()` deprecation warning. Neither warning was an assertion failure.
- `npm run security:secrets`, `npm run security:data-boundaries` and `npm run agents:validate` passed.
- Node syntax checks for the five changed runtime/model modules and scoped `git diff --check` passed.
- Independent security/contract re-review passed with no remaining BLOCK, HIGH or MED finding.
- E2E was not run because no frontend behavior changed and no authenticated browser environment was needed.
- No migration or environment connection/write was used for Plan 082 verification, and no deploy, commit or push
  was performed. The later, separately authorized public-showcase sync is recorded in its own runbook.
- Rollout remains `NOT STARTED`; promotion must follow the refresh-session cutover runbook.
- The refresh integration test is 391 lines because the atomic rotation, replay, expiry and legacy-cutover
  cases intentionally share one costly MongoMemory/public-router fixture; production service code remains
  below the project 300-line guideline.

## STOP Conditions

- Existing Auth code acquires a concurrent working-tree edit.
- Correctness requires multiple active sessions or a new collection rather than preserving current semantics.
- A change to SameSite/HttpOnly/CSRF, token secrets or OAuth provider settings becomes necessary.
- Backfill, destructive data change or any staging/production write becomes necessary.
- The same verification fails three times after evidence-based fixes.

## Maintenance Notes

- Deployment must drain/restart old instances together; mixed old/new Auth code is unsupported. Existing
  sessions re-authenticate once after their access token expires (at most 15 minutes).
- The release-specific procedure is `docs/operations/runbooks/refresh-session-cutover.md`. Rollout remains
  `NOT STARTED` until staging proves the drain boundary and a Plan-082-compatible recovery target or
  forward-fix path is recorded. Do not use the generic pre-082 Render rollback ID for this cutover.
- A future P2 multi-device feature should introduce a dedicated refresh-session collection rather than
  stretching these single-session `User` fields into an array.
- P2 should also coordinate refresh across tabs/direct SSE callers, restore `/user/me` through refresh on
  hard reload and decide whether stateless access tokens remain valid for their bounded 15-minute lifetime.
- Reviewers should scrutinize CAS filters, family-scoped revocation, legacy downgrade paths and accidental
  token/session metadata in logs or JSON responses.
- Do not extend the absolute expiry during rotation; that invariant is intentionally stricter than the old flow.
