# Security coverage ledger — 2026-08-02

## Scan identity

- **Target revision**: `86a19ad` + current Plan 019/020 working tree.
- **Scope type**: working-tree focused security review.
- **In scope**: Google OAuth state/callback, refresh response, dev-login, F1 assignment authorization,
  Codex Security governance/wrapper.
- **Out of scope**: full business-logic audit, schema/data migration, paid/deep Codex Security scan,
  production data writes.
- **Threat-model context**: root `SECURITY.md` and `.agents/rules/security/security.md`.

## Reviewed surfaces

| Surface | Entry point/untrusted input | Validation | Authorization | Sink/asset | Evidence | Result |
|---|---|---|---|---|---|---|
| Google OAuth start/callback | `client_url`, callback `state`/`code`, browser cookie | HMAC, TTL, timing-safe nonce, redirect allowlist | Browser-bound nonce before Passport code exchange | Login session/JWT cookies | `oauthState.test.js`, `auth.routes.security.test.js`, staging integration assertion | reviewed/fixed |
| Refresh | refresh cookie + CSRF header | CSRF middleware, JWT verify, user lookup | Existing refresh-token contract | Rotated access cookie + sanitized user | `phase0.security.integration.test.js`; `api.js`/`ai.service.js` consumers only await success | reviewed/fixed |
| Dev login | environment flags, query email, remote address | exact development opt-in + loopback check | route absent by default; remote request returns 404 | Local test login only | `oauthState.test.js`, `auth.routes.security.test.js` | reviewed/fixed |
| F1 create assignment | request `assignedTrainerId` | existing create validation/field contract | protect + entitlement; non-admin forced to self | `F1Customer.assignedTrainerId` | F1 authorization integration test + UI/service trace | reviewed/fixed |
| F1 update assignment | patch `assignedTrainerId` | existing update validation | ownership access + admin-only reassignment | F1 ownership/private health record | trainer 403 + admin reassignment regression tests | reviewed/fixed |
| Codex Security wrapper | CLI scope/cost/options | allowlisted args/path, cost ceiling, explicit execute/full/deep | user authority remains required for paid scan | external scan invocation/artifacts | 6 Node policy tests + CLI dry-run | reviewed/pass |

## Candidate validation

| Candidate | Root control/sink | Attack path | Validation method | Reachability/impact | Decision |
|---|---|---|---|---|---|
| Login CSRF/session swap | OAuth state accepted without browser binding | attacker starts login and forwards callback state | route/code trace + regression test | practical auth session confusion | accepted → fixed |
| Refresh token exposure to JS | access token returned in JSON | XSS reads response token | consumer trace + integration assertion | weakens httpOnly protection | accepted → fixed |
| Trainer changes F1 owner | request body controls assignment | entitled trainer transfers private record | route/controller/model trace + integration tests | private health data authorization break | accepted → fixed |
| Dev bypass on misconfigured runtime | route enabled by negative production check | remote host with wrong `NODE_ENV` | env/route trace + loopback regression | auth bypass on misconfiguration | accepted → fixed |
| New candidates after re-trace | affected producers/consumers above | none demonstrated | focused code review | no additional confirmed path | rejected/no finding |

## Deferred và proof gaps

| Area | Reason | Risk | Follow-up owner/gate |
|---|---|---|---|
| Live Google provider round trip | local QA không có provider/browser session phù hợp | OAuth cookie/provider compatibility | staging integration + manual/browser verification |
| Full/deep Codex Security | chỉ được duyệt preflight; paid scan cần explicit cost execution authority | external coverage chưa complete | record `PREFLIGHT ONLY`; local gates remain mandatory |
| Full repository security coverage | audit này focused vào Plan 019/020 | non-scoped business logic có thể còn issues | periodic `$audit security` theo risk |

## Re-validation

| Finding/fix | Focused regression | Broader gate | Residual risk | Result |
|---|---|---|---|---|
| OAuth browser binding/dev-login | targeted Auth route + utility tests | server 382 + E2E 61 passed | live provider compatibility | local pass; staging provider check pending |
| Refresh cookie-only response | phase-0 integration | client 223 + server 382 + E2E 61 passed | old unknown external client could expect JSON token; repo consumers do not | local pass |
| F1 assignment authorization | trainer/admin integration tests | server 382 + E2E 61 passed | admin workflow remains privileged by design | local pass |
| Scan governance/wrapper | 6 policy tests + dry-run | ops 17, agents 22/0 warnings, secrets/boundaries/dependencies passed | paid scan intentionally not executed | `PREFLIGHT ONLY`; local gates pass |
