# Plan 082A: Provide a free-tier Auth cutover boundary

> **Execution**: Follow each behavior slice in order. Do not deploy the Plan-082
> session format while any revision can still mutate Auth with the legacy format.
>
> **Drift check**: confirm `git status --short --branch`, exact candidate SHA and
> current Render staging deploy before editing or mutating provider state.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 082
- **Category**: security | operations
- **Planned at**: 2026-09-07
- **Lifecycle**: IN PROGRESS
- **Verification**: NONE
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-07

## Why This Matters

Render Free cancels an in-progress build when the service is suspended, so the
staging rehearsal deploy `dep-daf5ean40ujc739mcps0` proved that suspend cannot be
the maintenance boundary for this cutover. Plan 082 cannot roll from legacy bcrypt
sessions to HMAC family sessions while both revisions receive Auth traffic. A small
legacy-compatible application boundary is therefore required before the format change.

## Current State

- `server/server.js` mounts the Auth limiter and global CSRF cookie helper before Auth routes, while
  `server/src/routes/auth.routes.js` registers OAuth, refresh and logout directly; there is no shared
  cutover guard before those layers or session mutations.
- `server/src/config/productionReadiness.js` does not require an explicit Auth cutover mode.
- `server/src/observability/metrics.js` has bounded Auth counters but no cutover-block counter.
- Render documents `RENDER_GIT_COMMIT` as a runtime SHA and allows environment values
  to be saved without immediately deploying them.
- Staging is healthy again on exact SHA
  `e2e4c4b46ae6c4a912da8f60e3bbcf1c6141ae79`; production remains unchanged.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused boundary | `npm run test:unit:server -- --run src/routes/__tests__/auth.cutover.integration.test.js src/config/__tests__/productionReadiness.test.js src/observability/__tests__/metrics.test.js` | exit 0 |
| Auth regression | `npm run test:unit:server -- --run src/controllers/__tests__/auth.refresh-session.integration.test.js src/controllers/__tests__/auth.logout-session.integration.test.js src/routes/__tests__/auth.routes.security.test.js` | exit 0 |
| Security | `npm run security:secrets && npm run security:data-boundaries` | exit 0 |
| Governance | `npm run agents:validate` | exit 0 |
| Hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Auth cutover config/middleware, early server/router wiring, one bounded counter and production readiness.
- Server example environment, focused tests and Plan-082 release documentation.
- A legacy-compatible bridge commit built from production `main` plus only this boundary.
- Staging rehearsal of bridge → Plan 082 → reopen, exact-SHA probes and fresh acceptance.

**Out of scope**:

- CSRF, cookie attributes, JWT/refresh secrets or user/session schema semantics.
- Frontend UI, paid Render features, database migration/backfill or production test-user writes.
- Production deployment before staging rehearsal, recovery and candidate gates pass.

## Steps

### Step 1: Block Auth mutations through one explicit public boundary

Write a failing public-router regression, then add a strict config resolver and
middleware mounted before all Auth handlers. When enabled, every Auth request returns
no-store `503`, `Retry-After`, one stable error code and a validated Render SHA header;
the server-level mount must run after the global limiter but precede Passport, the Auth
limiter and global CSRF cookie helper so it does not reach CSRF generation, Passport,
controllers or cookie-clearing code.

**Behavior**: login, callback, refresh and logout cannot create, rotate or revoke a
session while the boundary is enabled; missing/false leaves current local behavior intact.

**Blast radius**: server assembly, Auth router, new config/middleware, metrics and focused tests.

**Depends on**: none.

**Verify**: focused boundary and existing Auth security tests pass.

### Step 2: Make production configuration explicit and observable

Require `AUTH_CUTOVER_MAINTENANCE` to be exactly `true` or `false` in production
readiness, add it to the example profile and expose only the boolean in readiness
summary/test evidence.

**Behavior**: missing/invalid production configuration stops the new binary instead
of silently opening Auth; valid false remains the steady state.

**Blast radius**: production readiness config/test and example environment.

**Depends on**: Step 1.

**Verify**: production readiness tests pass for valid, missing and invalid values.

### Step 3: Build and rehearse a legacy-compatible bridge on staging

Create a branch from exact production `main` containing only Steps 1–2. Save the
staging flag as `true`, deploy the bridge, and repeatedly probe `/api/auth/google`
without redirects until only its exact SHA serves `503`. Deploy the exact Plan-082
candidate with the same flag and repeat until only the candidate SHA serves `503`.
Set the flag to `false`, verify Auth resumes, then run fresh staging acceptance and
candidate gate against the new deploy IDs.

**Behavior**: the Free plan performs a format cutover without any request reaching
legacy and Plan-082 session mutations concurrently.

**Blast radius**: staging Render environment/service and immutable acceptance artifacts;
no production state.

**Depends on**: Steps 1–2 and CI.

**Verify**: bridge/candidate exact-SHA probe windows of at least two minutes, Auth smoke and acceptance cleanup
`verified=true`, `residue=0` all pass.

### Step 4: Prepare compatible recovery and production gate

Create and validate the smallest Plan-082-compatible recovery release before the
full candidate. Production promotion remains blocked until the owner explicitly
accepts the bounded initial forward-only cutover window or another compatible target
exists, and the protected candidate gate passes with current backup evidence.

**Behavior**: after the format cutover, the full release can recover to a known
Plan-082-compatible deploy and never to pre-082 Auth.

**Blast radius**: release branches, provider deploy identities and runbook evidence;
no database restore.

**Depends on**: Step 3.

**Verify**: recovery deploy identity/health/Auth regression and release candidate gate pass.

## Test Plan

- Server assembly and public Express router: gate remains behind the global limiter but precedes Passport,
  Auth rate limiting, global CSRF cookie generation, OAuth and route-level CSRF; enabled responses contain
  no session cookie and never execute downstream middleware.
- Config: missing/false behavior outside production; required valid boolean in production.
- Header: only a 40-hex Render SHA is emitted; arbitrary environment text is dropped.
- Metrics: blocked counter increments without high-cardinality labels or sensitive payloads.
- Staging: at least two minutes of repeated no-follow exact-SHA probes, then existing auth acceptance and cleanup.

## Done Criteria

- [ ] AC-010 through AC-013 pass and map to traceability evidence.
- [ ] Existing refresh/logout/CSRF/cookie behavior is unchanged when disabled.
- [ ] Legacy bridge contains no Plan-082 session-format code.
- [ ] Staging bridge → candidate → reopen rehearsal passes without overlap.
- [ ] Fresh CI/provider/acceptance/candidate SHA evidence passes.
- [ ] Compatible recovery path exists before the full production candidate.

## STOP Conditions

- The boundary runs after Passport, CSRF or a session write.
- A blocked response clears or creates an Auth/OAuth cookie, or exposes an invalid SHA/value.
- Render serves a SHA other than the expected bridge/candidate during its drain window.
- Staging acceptance residue is nonzero or recovery is only a pre-082 deploy.
- The same focused verification fails three times after evidence-based fixes.

## Maintenance Notes

- `AUTH_CUTOVER_MAINTENANCE=false` is the steady-state value; `true` is only for a
  bounded, operator-observed cutover.
- Do not count Render `Live` alone as drain proof. Use the response SHA header and
  maintenance error code over an uninterrupted window of at least two minutes plus exact provider identity.
- Do not remove the boundary until Plan 082 has a proven compatible recovery target.
