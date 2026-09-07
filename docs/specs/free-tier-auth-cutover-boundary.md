# Spec: Free-tier Auth cutover boundary

## Approval and assumptions

- User authorized completing and deploying the release to staging without a separate approval for each step.
- Production remains fail-closed until staging rehearsal, exact-SHA acceptance and recovery gates pass.
- Render Free cannot build while suspended; the staging rehearsal proved that suspending the service cancels
  an in-progress deploy, so application-level maintenance is the available no-cost boundary.
- This boundary coordinates the format cutover specified in
  `docs/specs/refresh-session-security.md`; it does not change JWT, CSRF, cookie or session semantics itself.

## Objective

Provide a legacy-compatible application boundary that prevents old and new Auth implementations from
mutating sessions concurrently during the Plan 082 rollout. The boundary must be explicit, observable by
validated release SHA, safe by default outside the cutover and operable on the current Free-tier services.

## Priority triage

- **P0 in scope**: shared Auth maintenance boundary, strict production configuration, exact-SHA drain probe,
  legacy bridge rehearsal and Plan-082-compatible recovery.
- **P1 in scope**: bounded blocked-request metric and operator runbook evidence.
- **P2+ deferred**: paid blue/green infrastructure, load-balancer draining, managed canary and Atlas PITR.

## Product and security requirements

### REQ-005 Free-tier cutover boundary

- AC-010: An explicit `AUTH_CUTOVER_MAINTENANCE=true` blocks every `/api/auth/*` request before
  OAuth, CSRF, refresh rotation or logout can mutate session state; the response is a no-store `503`
  with `Retry-After` and contains no token/session data.
- AC-011: Missing or `false` configuration preserves the existing Auth contract outside production,
  while production readiness rejects a missing or invalid value so a typo cannot silently open Auth.
- AC-012: A blocked response exposes only the validated public Render Git SHA when available, allowing
  repeated no-follow probes to prove which revision served Auth during the maintenance window.
- AC-013: Free-tier rollout uses a legacy-compatible bridge before Plan 082 and keeps the boundary enabled
  through the Plan-082 deployment. It is reopened only after an uninterrupted exact-SHA probe window of at
  least two minutes proves the old revision no longer serves Auth.

## File surface

- `server/src/config/authCutover.js`: strict environment resolver and validated release identity.
- `server/src/middlewares/authCutover.middleware.js`: shared no-store `503` boundary.
- `server/server.js`: early boundary after the global limiter but before Passport, the Auth limiter and
  global CSRF cookie helper.
- `server/src/routes/auth.routes.js`: middleware registration before every Auth route.
- `server/src/config/productionReadiness.js`: explicit production configuration requirement.
- `server/src/observability/metrics.js`: bounded blocked-request counter.
- `scripts/auth-cutover-drain.mjs`: no-follow exact-SHA probe verifier.
- `docs/operations/runbooks/refresh-session-cutover.md`: bridge, candidate, reopen and recovery procedure.
- Plan 082A, plan indexes/state and traceability evidence.

## Testing strategy

- Test the public Express router with the boundary enabled and disabled.
- Prove the server mounts the boundary after the global limiter but before Passport, the Auth limiter and
  global CSRF cookie helper; the router guard must run before OAuth, route-level CSRF and downstream handlers.
- Allow only a 40-hex `RENDER_GIT_COMMIT` value in the response header.
- Reject missing or invalid production configuration while keeping non-production defaults compatible.
- Verify the bounded metric without request, cookie, token or session labels.
- Rehearse bridge to candidate on staging with at least two minutes of no-follow exact-SHA probes, then run fresh
  staging acceptance and release-candidate gates.

## Boundaries

### Always

- Keep `AUTH_CUTOVER_MAINTENANCE=false` as steady state and `true` only for an observed cutover window.
- Block before any Auth/OAuth/CSRF/session mutation and return no-store responses.
- Validate the public release SHA before emitting it and record only bounded metrics.
- Keep production writes and test credentials out of drain verification.

### Stop and ask

- The boundary would require disabling CSRF, changing cookie attributes or changing token secrets.
- Staging serves an unexpected SHA, leaves acceptance residue or lacks a compatible recovery target.
- Production promotion lacks current backup/recovery or protected candidate evidence.

### Never

- Never use service suspension as a Free-tier build boundary after it has been shown to cancel deploys.
- Never reopen Auth until the two-minute probe proves only the expected candidate revision is serving.
- Never roll back a post-cutover server to a pre-082 Auth implementation.
- Never log or expose raw cookies, tokens, session identifiers, credentials or provider secrets.

## Success criteria

- AC-010 through AC-013 have executable code, test and runbook traceability evidence.
- Existing refresh, logout, OAuth and CSRF behavior remains unchanged while the boundary is disabled.
- The legacy bridge contains no Plan-082 session-format code.
- Staging bridge to candidate to reopen rehearsal passes without mixed-version Auth mutation.
- Fresh CI, provider identity, acceptance cleanup and candidate evidence agree on one exact SHA.
- A Plan-082-compatible recovery target exists before production promotion.
