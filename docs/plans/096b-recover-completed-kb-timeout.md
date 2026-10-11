# Plan 096B: Recover the completed staging KB timeout with evidence

- Priority P0; complexity COMPLEX; risk HIGH; lifecycle IN PROGRESS.
- Verification NONE; rollout NOT STARTED; depends on096A.
- Owner01a1172c-d836-7250-8396-275f41a6f75d; updated2026-10-08.
- Spec: docs/specs/staging-kb-timeout-recovery.md.

## Current state and drift

Staging88b5d307 is ready/live; canonical CI37756754770 PASS5/5.
Acceptance37758558812 failed with DEEPSEEK_TIMEOUT/503 before chat lanes.
Middleware stagingAiAcceptance.js:89 refuses settlement on every5xx, including
a completed read-only search; recovery37759297315 retains its admitted receipt.
Read-only inventory residue7 counts the same KB entry by ID and normalized question;
there are six unique persisted documents, including the recovery tombstone.
Root checkout is dirty; only use the isolated vibi-production-20261008 worktree.
Check git status/HEAD before edits. Do not change source/timeouts/certification or
reinterpret the operator correlation as cryptographic request linkage.

## Steps and verification

### Step 1: Close only known-completed read-only failures

Add HTTP integration regression for KB503 and confirm RED. Change the settlement
wrapper to accept a resolved KB handler with an ended response, recording failed.
Open/disconnected/throwing requests and all chat5xx remain admitted.
Scope: middleware stagingAiAcceptance.js and a new controller integration test.
Verify: focused terminal-KB integration tests plus existing acceptance integration PASS.

### Step 2: Archive the registered historical receipt using provider proof

Add a closed operator proof validator/builder and exact CAS receipt removal, integrate
with recovery and its report. Workflow downloads the original failed artifact,
verifies Render identity/log completeness, reads exact receipt projection, and uploads
the archive before cleanup. Preserve normal recovery default and all unknown guards.
Scope: new stagingAiChatAcceptance.kbFailure*.js modules/tests, recovery script,
staging-ai-recovery.yml and staging-security.yml bridge, canonical policy/runbook.
Verify: unit/integration negatives for wrong incident/log/actor/expiry/tombstone,
overlapping requests, archive absence and CAS races; focused existing recovery PASS.

### Step 3: Review, recover, then continue release gates

Review exact diff, run AI/security/agent gates and CI. Dispatch trusted recovery with
the registered provider request ID, retain proof and verified cleanup0 artifacts.
No acceptance rerun until residue0. Run fresh exact-SHA certification and update PR196;
main still requires another-account approving review and its merge SHA must be certified.
Verify: recovery artifact PASS, unchanged failed source artifact, new release evidence.

## STOP conditions

Stop if provider logs are incomplete/malformed/overlapping; if completed HTTP/provider
events cannot be matched uniquely; if tuple/receipt/actor/database/deploy differ;
if archive upload is unverified; or if cleanup/CAS/foreign data checks fail.
No production release from this plan alone; wallet must be verified above3 USD.
No subagents, arbitrary exception registry additions or broad cleanup queries.

Checkpoint2026-10-08: owner approved the scoped recovery proposal with review/tests.
Terminal resolved KB503 now settles as failed; throwing/in-flight/chat5xx remain admitted.
Focused canonical recovery/middleware/proof suites passed70 tests before CLI additions.
Read-only live Render/Mongo diagnostic built a valid registered completion proof.
Production Vibi/Brave keys and four selectors are saved only; the old deployment remains live.
Historical deletion, trusted recovery, new acceptance and production deployment are pending.
