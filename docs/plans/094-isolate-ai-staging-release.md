# Plan 094: Isolate the AI staging release

## Status

- Priority: P0; Complexity: COMPLEX; Risk: HIGH; Owner: root.
- Lifecycle: IN PROGRESS; Verification: FOCUSED; Rollout: NOT STARTED.
- Planned/updated: 2026-10-02. Depends on Plan 092.

## Why this matters and current state

User selected an AI staging release and deferred contract/wallet changes, then
explicitly approved the already-tested Progress month-start hotfix on 2026-10-02.
Backend staging runs fba17e6e1cf877edfb5e0bfba3cd0a08de0f5d9a;
frontend runs ae1252881219e4842bb144e753e9498501dc594a. The latest contract
client requires revision metadata absent from the live backend. Candidate must
retain latest non-contract frontend and baseline-compatible contract behavior.
Source snapshots are isolated under .local-data/staging-ai-resume-20261002;
root dirty files are not inputs except the approved Progress closure, whose hashes
must match the earlier Plan 091 QA fingerprint. The user authorized staging deploy,
KB publication and the full test sequence. Git writes remain subject to AGENTS.md;
this plan itself does not grant commit/push permission. Production is excluded.

## Scope and impact

Runtime overlay: ai.controller.js and changed files below server/src/services/ai
from ae125288, with their tests. The approved Progress exception adds
periodStartDateKey at the read boundary and uses it for filter/order/display while
preserving raw keys for identity and legacy fallback. It touches two backend
services and five client modules plus their regression tests and existing spec.
Other backend runtime code,
contract/wallet schemas, migrations and global DB config remain baseline-exact.
Preserve latest client except the eight contract paths in ai-only-candidate.json.
KB operator scripts run separately from the source snapshot; do not add them to
the runtime release. No schema migration or production data write is required.

Additional fix: server/src/middlewares/optionalAiAuth.js currently calls next()
whenever accessToken is absent. With a refresh cookie still present this treats
an existing user as a guest, bypassing the client's existing 401 refresh trigger.
Call protect unless both cookies are absent; protect still verifies only access
credentials. Consumers: POST /api/ai/chat and meal-replacements. Guest quota,
CSRF, ownership, session rotation and the client refresh implementation stay intact.

## Step 1: Build a compatible release tree

Narrow the overlay to AI runtime/tests and the non-contract client, restore
server config/tooling to baseline. Maintain a SHA256 manifest.
Exception after actual release audit: remove unused nodemailer, pin grpc-js1.14.5
and glob brace-expansion2.1.7, update client axios1.20.0. Only these dependency
closures may differ from the baseline lockfiles; no npm audit fix or broad update.
Dependency gate uses the existing production high/critical threshold unchanged.
Verify candidate non-AI backend hashes and all eight contract paths against
baseline; other client files must equal latest except generated inventory and the
approved Progress closure. No schema, stored key or ownership change is allowed.

### Approved continuation checkpoint

- Progress server focused: 19/19 passed, exit 0, at 2026-10-02T10:02:53Z.
- Final full server: 3,180 tests / 290 files PASS. Final full client: 915 tests /
  186 files PASS. AI eval: 73/73 PASS. Release build/lint/UI PASS. E2E: 123/124
  initially passed; the one mock timing race was fixed and both recovery cases
  passed with retries disabled. No runtime changes after the final test gate.
- Rerun the client suite and affected server batches after integration; preserve
  successful untouched-batch receipts and verify complete file coverage.
- Complete release build, E2E, lint/UI, integrity and governance/security gates.
- Independent review found two reachable AI regressions: citable KB suppressed
  required freshness verification; meal canonicalization discarded requiredFoods.
  Add HTTP regressions and bounded fixes before promotion. Keep these exceptions
  explicit in the candidate manifest; no new schema or permission change.
- Heavy commands run serially. Evidence lives in ../qa; the isolated candidate
  has no Git index, so index-dependent scans cannot attest a committed candidate.

## Step 2: Recover a user session before entering guest AI flow

Add refresh-only HTTP regression cases to existing aiGuestAccess.integration.test.js
for chat and meal-replacements. Assert 401, no guest cookie, provider call, quota
bucket or conversation mutation, including junk refresh credentials. Observe RED
before the middleware fix, then GREEN across the whole existing integration file.
Run client ai.service tests proving 401 causes one refresh and retries the same
conversation/request with rotated CSRF. Security reviewer audits ordering and
ownership. Broader concurrent refresh and transient logout behavior is deferred.

## Step 3: Verify the candidate and prepare promotion

Run targeted AI/auth tests, AI eval, full unit suites, client lint/release build,
UI regression and security gates using Node 22.23.1. Record exact commands,
exit codes and source fingerprint. Dependencies must match candidate lockfiles;
borrowed node_modules alone is diagnostic evidence only. Run local E2E where
available. No test reads production customer data or calls a real AI provider.
Before promotion, obtain explicitly authorized Git publishing operations and
attest Netlify/Render to the same new candidate SHA. Never deploy all of ae125288.

## Step 4: Complete KB and live acceptance

KB: 28 drafts, needs_review, embedding pending. Category correction for manifest60
is already complete; do not repeat sync. Re-embed requires fresh verified backup,
independent snapshot key custody, exact staging target/digest and provider profile.
Review/publish through an authenticated Admin, then retrieval smoke. Do not fake
reviewer identity or publish merely because metadata checks pass.
Retest failed/partial cases, then the 14 recovered original prompts plus replacement
case5 (user forgot original). Case5 requires a tofu baseline; case7 requires the
foods targeted by its edit. Formal 11-prompt reliability rounds are separate.

## Done criteria and stop conditions

Current gate details and remaining authorization/custody conditions are recorded
in ../reports/094-ai-progress-release-readiness-2026-10-02.md. Full local test results
do not imply a successful deployment or published Knowledge Base.

- [ ] Non-AI backend and contract closure hashes match baseline; dependency exceptions audited.
- [x] Refresh-only requests fail closed and existing guest/auth tests pass.
- [ ] Candidate local release gates pass with recorded provenance.
- [ ] Both staging deployments attest the same candidate SHA.
- [ ] KB review/embedding/publication and retrieval verified.
- [ ] 14 original + 1 replacement and formal acceptance recorded; fixture residue zero.

Stop dependent work on missing custody/expired backup, failed ownership tests,
unresolved candidate scope drift, or missing authority for Git writes. Do not
bypass gates, mutate root dirty files, or count NOT RUN as PASS. Two failed repair
rounds require reporting the blocker; independent authorized work may continue.
