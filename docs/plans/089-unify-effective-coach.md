# Plan 089: Unify effective coach across coaching workflows

## Status

- Priority: P1
- Complexity: COMPLEX
- Risk: HIGH
- Lifecycle: DONE
- Verification: FOCUSED
- Rollout: NOT STARTED
- Owner: root
- Updated at: 2026-09-10

User approved spec and requested local implementation. No production config,
data backfill, email send, commit/push/deploy authorized. Spec:
`docs/specs/default-lead-coach.md`. Preserve dirty086–088 changes.

## Current state

defaultAdminTrainer.service resolves explicit DEFAULT_ADMIN_TRAINER_ID or legacy
ADMIN_EMAIL. Schedule uses fallback; cron/preferences/bodyAssessment require
explicit trainerId. Other admin reads are intentionally broad; preserve admin
operations, scope personal coaching separately. Order.trainerId ObjectId User.

## Contract

Root-owned effectiveCoach.service exports:
- resolveOrderCoach({order,session,env}): {trainerId,assignmentSource}; explicit
  trainer must exist and have trainer/admin/subscription capability; null default
  uses existing default resolver compatibility. Explicit invalid never fallback.
- resolveEffectiveClientCoach({clientId,session,env,orderId}): {order,trainerId,
  assignmentSource}; active approved remaining sessions, existing client; bounded
  query max101 active orders; multiple distinct effective trainers409 conflict;
  deterministic selection only among same coach. Optional orderId pins owned active order.
- assertEffectiveCoachAccess({actor,clientId,session,orderId}): same result; compare
  actor.id with effective trainer, no any-admin bypass. Existing explicit admin
  operations outside personal coach scope keep their audited branch.
- effectiveCoachOrderFilter({trainerId,session,env}): explicit assignment OR null
  only when trainer is designated default; invalid/missing default must not grant
  null to ordinary trainers. All consumers still apply lifecycle and client scope.

## Steps and ownership

### Step 1: Root canonical resolver and unit integration

Own new effectiveCoach.service + focused tests; existing default resolver interface
preserved with explicit-ID required for production rollout. Test null/explicit/
missing/deleted/invalid/multi-order/other-admin. No production hardcoded ID.
Verify `cd server; npx vitest run src/services/__tests__/effectiveCoach.integration.test.js`.

### Step 2: Producer and schedule assignment slice (agent)

Own order.controller, trainingSchedule.controller, trainingScheduleCommand.service,
trainerAssignment.service/read, contract.service, workoutPlanRelationship.service
and their tests. New orders default explicit, lead in candidates, contract uses
effective coach not operator; admin management vs personal clients separated.
No default resolver/effectiveCoach/shared validation edits; send root requests.
Verify focused HTTP/service tests plus existing schedule/order/contract tests.

### Step 3: Personal coaching access slice (agent)

Own dailyJournalAccess, weeklyCheckinAccess, coachingHabitAccess, wellnessTargetAccess,
bodyAssessmentAccess, coachingCommentAccess and tests; root owns requestActor and
schema if requested. Preserve existing admin operations, no relaxation global role;
personal lead null access and comment author semantics verified with two admins.
Verify focused journal/weekly/habit/wellness/bodyAssessment/comment tests.

### Step 4: Email and notification eligibility slice (agent)

Own morningHealthReminderCron, notificationPreference.service and associated tests.
Use batch-safe effective coach resolution, no N+1 individual client lookup loop
for every recipient if possible. Keep preference/date/delivery keys/consent;
structured tick counts no raw health/email data. Catch conflict/invalid assignment
as per-client exclusion with safe counts, not silent broad exception.
Verify morning cron tests and notification preference regressions with mocked provider.

### Step 5: Root integration, cross-consumer trace and QA

Additional traced scope: trainerTransferQuery/service + assignment active read,
TransferPreview unlimited display; CoachingComment/Revision actorRole additive
admin value and controller audit/service author role; client comment role label;
savedMealPlan metadata resolver. No historical document rewrite or backfill.
Designated lead capacity preserves former unassigned admin-order behavior, no
commercial trainer limit changed; explicit and implicit designated lead equivalent.

Root traces serviceAccessPolicy/todayDashboardSources/retention/read filters and
related privacy consumers for raw trainer assumptions; owns shared hotspot updates
with evidence. Run full server Node22.23.1 tests, client tests if relevant, secret/
boundary/governance/diff. Independent security review current delta; fix findings.
No production writes. Any source choice changing business beyond spec → ask.

## Done criteria

- Legacy null recognized only as lead, explicit others preserved.
- Missing/default invalid/client deleted/ambiguous fail closed; no email misroute.
- New orders persist effective trainer; contracts historical untouched.
- Admin operational access preserved; personal coaching scopes tested separately.
- Regression and QA results captured honestly; no deployment/backfill run.
- Rollout runbook: configure ID, test synthetic staging, approve separate production
  rollout and optional dry-run manifest before any backfill. Config change while
  null legacy exists is transfer-sensitive; no automatic config endpoint.

## Commands

Runtime implementation complete; final verification in progress. Focused groups:
email/preferences23PASS, access31PASS, comments3PASS, replay17PASS, schedule replay8PASS,
transfer15PASS(combined existing9+new6), order11/assignment3/schedule7PASS.
Root combined canonical/access/email62PASS and contract/workout/meal/transfer/replay54PASS.
Client759PASS; scoped client lint and compile-only PASS; UI regression0new.
Full server runner stopped batch5 on preexisting Radar order-dependent expectation
`items[0].skillsShUrl` (repository entry now first with null link). This is FAIL,
not full-server PASS; remaining services checked separately. No release authority.
Runbook `docs/operations/runbooks/default-lead-coach.md` separates code/config/backfill.

`npm run test:unit:server`, `npm run test:unit:client`, `npm run agents:validate`,
`npm run security:secrets`, `npm run security:data-boundaries`, `git diff --check`.
No FE redesign; build only if affected. Any failed gate remains FAIL/BLOCKED.

## Delivery

Implementation done; evidence `docs/reports/089-effective-coach-delivery.md`.
Full server gate remains FAIL (unrelated Radar source-order expectation), so
FOCUSED verification only and NOT ready for automatic production promotion.
Root fixed final checkin search ownership OR collision with12-test HTTP PASS.
