# Plan089 — Effective coach local delivery

## Result

Implemented local, focused verification PASS; full server gate FAIL due unrelated
Radar ordering expectation. Not production deployed or release-approved.
Base HEAD196198a7c661e3c32fac6149a13475b5d30b93b4, preexisting086–088 dirty preserved.

## Contract and impact

- effectiveCoach.service centralizes explicit/default resolution, active order
  conflict, current actor/client existence and personal effective coach access.
- DEFAULT_ADMIN_TRAINER_ID existing mechanism reused, no new setting or private
  production ID hardcoded; legacy ADMIN_EMAIL fallback preserved compatibility.
- New/admin-created and approved legacy pending orders persist designated lead;
  assigned other trainers untouched. Missing/invalid config fails before mutation.
- Designated lead included in candidates; personal schedule/checkin scope uses
  lead/null filter, search combines separately so it cannot override ownership.
- Contract creation uses responsible effective trainer, not administrative operator;
  workout relationship and saved meal plan metadata use same resolution.
- Journal/weekly operational admin reads preserved; personal comments/BodyAssessment
  check effective coach. Habit/wellness admin operations retain authority with
  correct effective attribution. Admin comments store actual admin authorship;
  client UI labels these as Huấn luyện viên.
- Weekly/habit/wellness/schedule/comment replay rechecks present authorization
  before serving current data; valid idempotency/version behavior preserved.
- Email batches resolve legacy default; opted-in valid customers selected, invalid
  assignment/conflict excluded; tick counts logged without email/health payload.
- Transfer from legacy lead uses effective source + explicit raw assignment CAS;
  to designated lead supports preserved admin capacity semantics with clear UI.
  Past contracts/checkins remain unchanged; no migrations executed.

## Verification

All DB tests used synthetic isolated MongoDB in-memory. Mail provider mocked.

| Command/group | Result |
|---|---|
| npm run test:unit:client | PASS165 files/759 tests |
| npm run test:unit:server (Node22.23.1) | FAIL batch5: Radar assertion assumes first item has skillsShUrl |
| first4 canonical batches | PASS32 files each,234/225/196/185 tests; not summed with overlapping focused reruns |
| batch-range120–164 rerun, maxWorkers2 | 44 files PASS,1 Radar file FAIL;298 passed/1 failed |
| remaining165+ service files, maxWorkers2 | PASS77 files/421 tests |
| effective resolver/access/email/comment/replay grouped | PASS5 files/62 tests |
| saved meal/contract/workout/transfer/replay grouped | PASS6 files/54 tests |
| final order conversion/default/checkin search | PASS12 tests |
| schedule replay | PASS8 tests; phase7 existing7PASS |
| effective transfer | New6PASS + existing9PASS |
| client scoped ESLint | PASS |
| npx vite build in client | compile-only PASS; not release build |
| UI baseline regression | PASS0 new blocking |
| agents validator | PASS |
| secret/data boundary checks | PASS |

Radar failure: test `src/routes/__tests__/skillRadar.routes.integration.test.js:56`
expects first item to have skillsShUrl, while date-based ordering puts sourceType
repository first with null link. No effective-coach code reaches this read model;
not modified or skipped to claim full pass. Full gate remains FAIL until separately
resolved. Some test runner child shutdown warnings occurred but reported passing
groups exited0. No total unique-count claim from overlapping reruns.

## Review outcomes

Independent Astra security review identified and root/workers fixed: pending
approval missed lead persistence; admin checkin selector excluded new lead order;
schedule old-command replay exposed current data; comment/weekly/habit/wellness
replay checks; subscribed trainer wellness lost capability; checkin search OR
collision. Regression tests added/re-run for these boundaries.
Remaining residuals: no live production verification, no new full E2E run, no
backfill/config/deploy; public service free-sleep reliability separate from resolver.

## Rollout

Use `docs/operations/runbooks/default-lead-coach.md`. Configure explicit lead ID
only after release approval; validate staging synthetic lead/admin-other/trainer
scenarios, then production exactSHA and morning tick evidence. Do not retroactively
send missed days or toggle all background jobs. Optional data backfill requires
separate dry-run/approved cohort/CAS/backup; no broad updateMany ownership rewrite.
