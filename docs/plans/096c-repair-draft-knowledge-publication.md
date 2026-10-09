# Plan 096C: Repair the 28 draft Knowledge Entries and release publication

- Complexity: COMPLEX; priority P1; lifecycle IN PROGRESS; risk HIGH.
- Owner: 01a11e5a-2e00-7001-94b7-9aefa3462f7e; updated 2026-10-09.
- Verification: FOCUSED; rollout NOT STARTED; depends on Plan096A.

## Authority and current state

The owner explicitly requested checking and fixing all 28 production drafts, pushing the code,
then publishing the entries on 2026-10-09. Production target is Render srv-d70gd0fafjfc73csn9ag,
APP_ENV=production, database gym-app. Staging uses srv-d9g8em61a83c73b4l61g/htcoaching_staging.
Production runtime is 89ac30fc31aa49628b89b308ae4b53ad9c4c8c55; candidate is
2be0141f352eddf400703f43a69cabce2c42e90d. Work in the isolated release checkout only.
The root checkout contains unrelated work and is out of scope.

The original 28 complete drafts fail both validators. The owner authorized inspecting the content
requiring editing for all 28. Prepared educational edits now pass privacy and publication validators
for 28/28 entries; the focused regression suite passes 646 tests across seven files. These checks
used zero database writes and zero paid provider requests. Production remains unchanged.
Bibliographic DOI/PMID labels are removed from source titles while retaining source URLs;
no identifier exemption is introduced. Scientific claims were checked against their public sources.

## Scope

- services/ai/knowledgePrivacy.js and narrowly scoped helper modules, personalHealthData.js if proven necessary.
- services/ai/__tests__/knowledgePrivacy*.test.js and personalHealthData tests; publication route regressions.
- This plan, index/state/traceability and the canonical knowledge-quality spec for clarified examples.
- Private local diagnostic/publication helpers and metadata evidence; never commit production KB payloads.

No auth, quota, rate-limit, model, schema or frontend changes. The owner authorized
one timeout exception on 2026-10-09: KB selection may wait up to 30 seconds instead
of 15. Share the cap across search controller, selection service and provider;
preserve shorter caller deadlines/abort, chat/tool caps, retry and token/context bounds.
Do not bypass privacy, editorial review, source validation, publication fences or branch protection.

## Steps and verification

### Step 1: Inspect all 28 entries with bounded read-only probes

Freeze IDs/content hashes and collect per-field reason/pattern metadata. Read question, answer,
variants, tags and sources in memory only. Do not print/store raw health/PII or credentials.
Classify each failure as proven false positive, content requiring editing, or unresolved evidence.
Verify: private diagnostic exits 0, inventory=28, databaseWrites=0, paidProviderRequests=0.

### Step 2: Correct each proven failure through a public regression seam

Reproduce each class with synthetic questions/variants/sources, then make the smallest correction.
Maintain negative cases for private labels, first-person health, names, metrics, DOB, URLs and secrets.
Preserve source provenance and same-topic variants; edit draft content only when its generic educational
meaning can be preserved and privacy-safe editorial content is reviewable. The owner delegated the
disposition of six off-topic variants: prepare separate drafts for straps, gloves, wrist wraps,
F1 exercise clearance, asthma and diabetes. Add suitable sources before their future publication;
F1 clearance requires canonical internal policy. Do not publish unsupported drafts.
Verify: focused privacy and publication suites exit 0, followed by metadata validation of 28/28 drafts
or their prepared edits. Do not call unresolved entries ready merely to achieve the count.

### Step 3: Push and certify the new exact SHA on staging

Commit/push only scoped changes; use protected PR flow and exact-SHA CI. Prepare paired staging deploy,
acceptance and two reliability rounds. Reuse approved UI15/manual evidence. Obtain fresh verified wallet
evidence >3 USD before a paid batch; require cleanup verified residue0 after every run.
Refresh the expired 24-hour production backup before acceptance writes or production rollout.
For the authorized KB timeout change, require synthetic controller/service/provider
regressions: response after 20 seconds succeeds, stall cancels at 30 seconds, shorter
caller deadline and caller cancellation remain effective without retries. Historical
15-second acceptance failures remain FAIL; certify a fresh exact SHA before release.
Verify: candidate CI PASS, paired deploy identities match, machine acceptance/reliability PASS.

### Step 4: Release and publish the validated cohort

Merge through protection, run merged-SHA CI and exact merged-SHA staging certification. Deploy paired
production artifacts with rollback ready. Publish only the inspected cohort using authenticated CSRF
requests and current publication fences/receipts; preserve source/reviewer/revision integrity.
Verify: 28 exact entries published/reviewed/embedding-ready and retrieval-eligible, no partial unknown
publication outcome, paired SHA and at least 30 minutes GET/HEAD observation PASS.

## Hypotheses and stop conditions

- Generic title-cased terms are mistaken for names; synthetic concept fixtures must distinguish this.
- Private clinical ranges bind across unrelated clauses; preserve genuine inherited/private assertions.
- Formal public bibliography identifiers collide with phone patterns; do not exempt credential/private URLs.
- Public-role abbreviations/nickname bindings differ from private-person labels; establish identity in question only.
- Some content is actually personal or source evidence is inadequate; retain rejection and prepare explicit edits.

Stop dependent actions when an entry's privacy/source meaning cannot be established, concurrent edits invalidate
its content hash, exact-SHA gates fail, credential access fails, or a paid batch lacks fresh balance evidence.
Record the evidence and continue unaffected work. Never weaken a gate or fabricate readiness;
the owner-authorized 30-second KB cap is a bounded behavior change requiring fresh certification.

## Done criteria

- All 28 inspected, with per-entry disposition and preserved same-topic variants/sources.
- Six off-topic variants preserved as separate drafts with explicit source/review disposition.
- Public regression suites and protected CI PASS; changes limited to this scope.
- Production code deployed and all 28 approved entries published through the real API.
- Paired SHA, rollback, backup and 30-minute observation verified; release GO recorded.

## Maintenance

Keep concepts and public-identity binding contextual. No whitelist of production entry IDs or arbitrary people.
On later edits, normal revision/re-review behavior remains authoritative. Rollback code and content separately.
