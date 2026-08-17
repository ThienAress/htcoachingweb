# Plan 053: Harden backend foundations và async resilience

> Thực thi local theo từng behavior và dừng trước mọi production operation. Target ban đầu là
> `staging@4a5897a3d773668e6f69e729deb3b4eef59b28aa` cộng working tree Plan 052.

## Status

- **Priority**: P0 → P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: Plan 052
- **Category**: security | reliability | performance | operations
- **Planned at**: 2026-08-13
- **Current status**: LOCAL COMPLETE — external production gates pending owner approval

## Why This Matters

Audit 10 backend foundations xác nhận repo đã có correctness/security controls mạnh nhưng còn một public mutation trust-boundary gap, cache stampede risk và process-local scheduler limitations. Plan chỉ harden controls có evidence, không thêm Redis/MQ/CQRS theo phong trào. Mọi migration, index apply, cleanup, backup/restore, provider/Render config và deploy vẫn nằm ngoài quyền local implementation.

## Current State

- `server/src/routes/exerciseSuggestion.routes.js` — public/admin suggestion API; Step 1 đã thêm CSRF và validation.
- `server/src/services/ai/embedding.service.js` — cache vector TTL/size-bounded nhưng chưa coalesce in-flight identical work.
- `server/src/services/{depositCron,subscriptionCron,contractCron,cleanupCron,scheduleReminderCron}.js` — interval jobs; mức độ claim/overlap không đồng nhất.
- `server/src/routes/ops.routes.js` + `server/server.js` — app đã có live/ready/drain/graceful shutdown.
- `docs/audits/backend-foundations-and-advanced-concepts-2026-08-13.md` — audit matrix và production boundaries canonical.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Focused suggestion API | `cd server && npx vitest run src/routes/__tests__/exerciseSuggestion.routes.integration.test.js` | exit 0, 4 tests pass |
| Focused embedding | `cd server && npx vitest run src/services/ai/__tests__/embedding.service.test.js` | exit 0 |
| Server suite | `npm run test:unit:server` | exit 0 |
| AI validator/eval | `node .agents/scripts/validate-tools.mjs && npm run test:ai-eval` | exit 0 |
| Local gates | `npm run security:secrets && npm run security:data-boundaries && npm run agents:validate` | exit 0 |

## Scope

**In scope local**:

- Exercise-suggestion CSRF/input/list bounds + regression tests.
- Embedding single-flight that does not weaken request cancellation, cache bounds or error cleanup.
- Same-process cron lifecycle/overlap guards and tests where behavior can be proven without running business cleanup.
- Audit/plan/runbook evidence.

**Out of scope / approval required**:

- Any staging/production migration, index apply, cleanup, cron execution, data write/delete or backfill.
- Deploy/Render/Netlify config, replica/worker count, Redis/MQ/KMS/PITR purchase/config.
- Backup/restore/off-device upload, secret access, paid security scan.
- OpenAPI big-bang migration, transactional outbox schema or production mutating AI tool.

## Steps

### Step 1: Close public suggestion trust boundary

Add CSRF, exact allowlist/type/length validation, bounded admin query and escaped search. Cover missing CSRF, rejected payload, normalized success and oversized list limit through HTTP.

**Behavior**: malformed or cross-site public mutations fail before a DB write; valid anonymous suggestions remain compatible.

**Verify**: focused route integration → 6/6 pass; client service contract → 1/1 pass.

**Status**: DONE LOCAL.

### Step 2: Coalesce identical embedding misses safely

Implement process-local single-flight keyed by normalized text. The shared provider operation must have its own deadline; an individual caller may stop waiting without cancelling other callers. Remove in-flight state on success/failure and never cache failure.

**Behavior**: two concurrent identical requests make one provider call and get the same vector; provider failure cleans state so a later request retries; cache size/TTL remains bounded.

**Blast radius**: `server/src/services/ai/embedding.service.js` + focused unit test only.

**Verify**: focused embedding tests + existing metrics/AI tests.

**Status**: DONE LOCAL — concurrent coalescing, failure cleanup và caller-abort isolation pass.

### Step 3: Prevent same-process cron overlap and expose lifecycle ownership

Use a small reusable interval runner only if deletion test proves it centralizes real timer/overlap complexity. At minimum, each starter must be idempotent, retain/unref its timer and skip a tick while the prior invocation is running. Do not execute cleanup functions in verification; inject synthetic tasks or test exported lifecycle seam.

**Behavior**: calling a starter twice creates one timer; slow tick does not overlap; stop hook clears timer in tests/shutdown-compatible path.

**Blast radius**: cron services and dedicated unit tests; no controller/model/schema changes.

**Verify**: focused fake-timer tests, then server suite.

**Status**: DONE LOCAL — lifecycle 6/6, schedule regression 2/2; shutdown stops timers and awaits active ticks before Mongo close.

### Step 4: Re-run integrated local gates and review

Run server tests, AI eval/tool validator, client/release tests only if affected, security/data/agent gates and `git diff --check`. Review Standards, Contract and Security/Operations axes; update audit/plan with actual evidence.

**Behavior**: no regression and evidence fingerprint matches final working tree.

**Status**: DONE LOCAL — client 420, server 748, Chromium E2E 79, AI eval 9, tools 11, ops 26; lint/build/security gates pass.

### Step 5: Execute external production readiness only after approval

Owner chooses target and approves separately: index apply/verify, Render liveness/readiness + designated worker config, off-device backup/key custody, PITR/continuous recovery and restore drill. Record real IDs/timestamps without secrets.

**Behavior**: external gates change from truthful pending/NO-GO only after observed evidence.

**Status**: BLOCKED BY EXPLICIT OWNER APPROVAL; not attempted.

## Test Plan

- HTTP regression for suggestion CSRF/validation/list bounds.
- Embedding concurrent dedupe, failure cleanup, completed-cache hit and caller abort behavior.
- Cron fake-timer idempotent start, overlap skip and stop; no DB cleanup execution.
- Full server unit/integration, AI eval/tool validator, security and instruction gates after final code.

## Done Criteria

- [x] Suggestion public mutation has CSRF + bounded exact contract and focused tests pass.
- [x] Identical embedding misses produce one provider call; failures do not poison cache/in-flight map.
- [x] Cron starters cannot duplicate/overlap in one process and expose test cleanup.
- [x] Server/AI/security/agent gates pass on final diff.
- [x] Audit matrix lists P0/P1/P2 and clearly separates local-safe vs approval-required actions.
- [x] No migration/index/deploy/cleanup/production data operation was run.

## STOP Conditions

- A fix requires schema/index/backfill, production config or real data mutation.
- Single-flight would couple one caller's abort to other callers or remove provider deadline.
- Cron hardening changes job business semantics, retention policy or deletion filters.
- Any focused verification fails three rounds after evidence-based fixes.

## Maintenance Notes

- Redis/MQ/outbox/OpenTelemetry remain P2 architecture decisions driven by multi-instance traffic/SLO and require a spec/ADR plus rollout plan.
- Process-local single-flight is an immediate stampede guard, not distributed cache or global deduplication.
- Background cleanup remains disabled except on an explicitly designated worker and must never be run from local QA against production.
