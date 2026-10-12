# AI + Progress staging deployment — 2026-10-03

Application deployment, recovery/custody gates and staging KB publication are
complete. All 15 live prompts completed: **7 PASS, 4 PARTIAL, 4 FAIL** under
semantic review. Cleanup passed with zero synthetic residue. Live execution
completion is not semantic acceptance PASS. This report updates plan 094 after
its October 2 local-readiness checkpoint.

## Scope and provenance

The owner authorized an isolated checkout, branch `odex/ai-progress-staging`,
commit/push, CI and staging deployment. Production deployment is excluded.

- Candidate commit: `161f5a5cbf795b8325a86826046a58f18fe63dd2`.
- [PR 189](https://github.com/ThienAress/htcoachingweb/pull/189): merged into staging.
- Staging merge commit: `32cf6e80ce698b98669d0761461b038072bff36e`.
- Both commits have tree `c00e7c7cb54697963e0e29f1380f5631c1ae2764`;
  the merge introduced no source changes.
- Checkout preparation verified 2,291 candidate files against the saved content
  fingerprint. Subsequent changes regenerated Git-index inventory and clarified
  a synthetic refresh-cookie fixture; application behavior did not change.
- Root checkout application edits were preserved.

## Verification and deployment

| Gate | Evidence/result |
|---|---|
| Candidate CI | [37040495419](https://github.com/ThienAress/htcoachingweb/actions/runs/37040495419), all five jobs passed |
| PR CI | [37045453566](https://github.com/ThienAress/htcoachingweb/actions/runs/37045453566), all five jobs passed |
| Local promotion preparation | Refresh-cookie regression 26/26, operations 125/125; secret, data-boundary, documentation-privacy, governance and whitespace gates passed |
| Exact staging CI | [37047525381](https://github.com/ThienAress/htcoachingweb/actions/runs/37047525381), all five jobs passed |
| Netlify staging | `6abff77f59ccf10008b1024d`, `ready`, exact staging SHA verified by provider GET API |
| Render staging | `dep-davvjqe0tbcc73fj3la0`, `live`, exact staging SHA verified by provider GET API |
| Post-deploy health | PASS, 7/7 read-only checks, exit 0 |
| Post-deploy security | PASS, 7/7 read-only checks, exit 0 |

Deployment identity was verified at `2026-10-02T18:40:20.782Z` (October 3 in
Asia/Saigon). The canonical deployment-identity validator accepted the same
40-character SHA and both provider deployment IDs. Frontend, manifest, API
liveness/readiness, blog and recipe endpoints responded successfully. Security
smoke confirmed headers, allowed/denied CORS, anonymous metrics rejection,
private legacy-media denial and JSON 404 behavior.

Staging entry point: https://staging--htcoachingweb.netlify.app.
Private execution receipts remain under the ignored
`.local-data/staging-ai-resume-20261003/` directory. This report is saved locally;
no documentation-only commit was deployed after the verified merge SHA.

Direct fast-forward was rejected by GitHub protected-branch checks. Promotion
continued through PR CI and normal merge; branch protection was not changed.
An earlier staging CI run was cancelled when another push event for the same
SHA created the replacement run above. No cancelled run is counted as PASS.

The existing Single Test Account Pull Sync workflow automatically ran after
the staging push and succeeded. It reads the pinned account graph from
production and writes its configured staging target; this is separate from
KB maintenance and acceptance. No production write was requested here.

## Latest data gate status

- The October 3 backup passed downloaded-copy isolated restore and owner-attested
  fresh Bitwarden retrieval/re-prompt. Disaster-recovery readiness passed again
  before acceptance; continuous recovery/PITR remains unavailable.
- Separate KB snapshot-key custody and exact reviewed-digest re-embedding passed.
  All 28 root vectors are ready with the question-answering profile.
- Authenticated Admin review published 26 entries. Entries 29 and 33 remain draft
  because their question identities cannot yet be bound to the official sources.
- Production-mode Admin retrieval smoke passed three representative root queries.
- The 14 original prompts plus replacement case 5 completed through actual
  staging Gemini/API. Semantic acceptance remains FAIL; synthetic cleanup passed.

This document is operational evidence, not production promotion approval. The
full release remains incomplete until the data gates and live acceptance pass.

## Continuation — October 3, Asia/Saigon

Scope remains staging KB publication and the preserved live acceptance corpus.
No application edits, Git writes or production data writes are part of this
continuation. Existing dirty workspace changes are preserved.

1. Recheck deployed identity; both providers returned the same merge SHA at
   `2026-10-03T03:05:53.157Z`, with the deployment IDs listed above.
2. Create and locally restore a fresh read-only production backup. The earlier
   interrupted attempt did not produce an archive or success manifest; it is
   not recovery evidence. Retain existing backups.
3. Upload only the encrypted archive to the canonical Drive account/folder,
   download it again, verify size/hash, and restore using the recovery password
   retrieved from the separately saved Bitwarden item. Until all checks pass,
   keep off-device and independent-custody verification pending.
4. Verify KB snapshot-key custody and the exact staging embedding profile,
   rerun the digest preflight, then re-embed and review/publish through an
   authenticated Admin. Verify retrieval before live acceptance.
5. Run the 14 original prompts plus the labeled replacement case 5, preserving
   baselines for cases 5 and 7. Record each semantic result and verify cleanup
   of only the run's synthetic fixtures.

The October 1 backup's independent restore was already completed, as documented
in `production-backup-record-2026-10-01.md`; the earlier pending-custody sentence
above is superseded by that record. Its recovery point remains older than the
24-hour policy. Fresh backup and new KB snapshot custody are still required.

### Fresh backup checkpoint

The fresh backup `production-logical-backup-20261003T032918Z-e241eacf9e4ea846`
completed at `2026-10-03T03:31:10.803Z`: 83 collections, 4,557 documents,
matching source/restore fingerprints, zero GridFS findings and zero production
writes. The encrypted archive was uploaded to the verified canonical Drive
account/folder, downloaded again and matched against the private manifest.

Independent Bitwarden custody and the downloaded-copy restore remain pending.
The readiness pointer records the fresh local backup with
`offDeviceRecoveryVerified=false`; no recovery flag is inferred from upload.
Details: [backup record](../operations/production/production-backup-record-2026-10-03.md).
KB re-embedding/publication and the 15 live cases have not run in this continuation.

### KB read-only preflight

At `2026-10-03T03:43:30.017Z`, the unchanged operator script from the candidate
checkout passed against Doppler project `htcoaching-server`, config `stg`, with
an exact connected staging database guard. The checkout is at `161f5a5`, whose
tree is identical to the deployed merge SHA as recorded above.

- Documents: 28; updates/root vectors: 28; variant vectors: 0.
- Expected provider calls: 28, below the explicitly bounded cap of 100.
- Profile: `question-answering-v1`.
- Version: `gemini-embedding-2:768:question-answering-v1`.
- Digest: `67f79a570ca24b16c4f17635cda5abf73a654d828a61e851b369ec36c7bd1c15`.

This preflight made no provider calls, snapshots or database writes. It does not
prove Render's runtime profile, editorial review, independent snapshot-key
custody, or acceptance. Rerun immediately before apply to reject intervening drift.
The existing automated 7-lane and 11-scenario acceptance runners do not execute
the preserved 15-case corpus; they cannot substitute for that requested run.

### Owner password-entry checkpoint

The owner confirmed saving the backup password in Bitwarden. The downloaded-copy
restore returned `RESTORE_PASS` at `2026-10-03T05:46:14.534Z` in session
`a9984854-bb79-4122-87a4-c2f3dfa977fa`: all fingerprints/GridFS matched and cleanup
passed, with no production connection or writes and no local DPAPI recovery key
used by the restore. This supersedes the earlier NOT RUN restore status.

Fresh retrieval from the saved Bitwarden item and master-password re-prompt
remain to be owner-attested; the helper's expected-source label is not independent
proof of either action. Readiness therefore remains fail-closed with
`offDeviceRecoveryVerified=false`. Separate KB snapshot custody and all pending
staging data/acceptance gates remain unchanged.

### Continuation to the preserved 15-case run

The owner requested continuing through staging acceptance. The ordered gates
remain: reviewed backup custody -> separately saved KB snapshot key -> exact
digest apply -> authenticated Admin publication -> retrieval smoke -> all 15
preserved cases with baseline/cleanup evidence. A successful local-key test must
not be substituted for owner retrieval from Bitwarden.

At `2026-10-03T05:56:25.811Z`, provider GET API confirmed the current Render
staging configuration: Gemini enabled; `question-answering-v1` profile;
`kb_embedding_v2` root index and `kb_variant_embedding_v1` variant index. The
provider key is configured; its value was not printed or saved in evidence.
This is configuration evidence, not a completed runtime retrieval test.
Netlify and Render were re-attested to the same `32cf6e8` SHA at
`2026-10-03T05:56:30.360Z`.

The browser's Admin KB route redirected to the staging login page. Publication
requires the owner's actual Admin login. Existing protected staging credentials
contain database/provider credentials only, not a KB snapshot encryption key.

Preparation scope: an ignored local owner-custody helper and focused synthetic
checks, plus this operational report. The helper must keep keys DPAPI-protected
outside the repository, never print them, require fresh owner entry after a
Bitwarden save, and leave readiness/application/database state unchanged.
Root will validate helper safety and inspect receipts before continuing; missing
custody or Admin login blocks only the dependent mutations.

### Live KB inventory and editorial review

The owner completed the Admin login. The staging Admin KB page loaded with
28 total entries; selecting Published returned an empty list. A read-only
database inspection at `2026-10-03T06:02:27.424Z` independently confirmed all
28 entries were draft/needs_review with pending zero-length vectors and no
reviewer. Answers and sources matched all 28 reviewed manifest records.
Both vector indexes were READY/queryable with the expected 768-dimensional
cosine definitions and nested variant root.

Independent editorial/source review found 17 unchanged entries ready for Admin
review. Ten bounded answer/source corrections were prepared and re-reviewed
locally; they have not been applied. Entry 29 remains draft because the mapping
between its question's personal name and the official competition name is not
verified. The proposed final set is 27 reviewable entries after those corrections,
not a claim that all 28 are publishable. The private proposal artifact is
`kb-editorial-proposals.json` beside the other continuation receipts.

No KB document or embedding has been changed, published or regenerated during
this continuation. No live acceptance prompt has been sent. An owner-operated
KB snapshot-key custody helper is prepared separately; the verified database
archive password is not being reused as the KB snapshot key.

The owner-custody helper is ready at
`.local-data/kb-custody-20261003/start-custody.ps1`. Root reran its synthetic
PowerShell suite: 29 checks PASS, exit 0, covering parsing, real synthetic
DPAPI/ACL storage, exclusive locking, safe resume, negative retrieval/attestation
and conditional clipboard cleanup. Independent security review found no blocking
issue; live clipboard timing and Bitwarden persistence/re-prompt remain owner QA.
No real KB key was generated and no custody receipt was claimed during preparation.
The helper binds to the initial reviewed digest; any later editorial/content
change requires a fresh plan review and an explicit key-purpose decision, not
silent relabeling of the original receipt.

### Owner custody helper continuation

The saved-item verification attempt failed after masked input, before a receipt
was written. Root reproduced a Windows PowerShell 5.1 clipboard defect using
synthetic text: `Set-Clipboard -Value ''` throws `ArgumentNullException` in its
native sink, although parameter binding accepts it. The previous clipboard mock
did not model this behavior. The helper now clears its matching clipboard with
the parameterless Windows PowerShell command. A regression run failed before the
fix and then passed 35/35 checks; a native synthetic clipboard test also passed.
The existing key and Bitwarden item were retained. Owner verification must still
complete and write its receipt; no custody claim follows from the helper fix.

An ignored apply bridge has been prepared, with strict staging target, receipt,
fresh preflight, private encrypted snapshot and canonical backup-readiness gates.
Its nine negative/positive preflight tests pass. It has not been run against the
live database. Editorial corrections and publication remain unapplied; the live
15-question corpus has not been sent. The owner reauthenticated the Admin UI.

At `2026-10-03T11:12:37.216Z`, the owner completed saved-item KB key verification.
Root reviewed the receipt's key ID, digest, staging SHA, observed password
equality and separate owner attestations for Bitwarden retrieval/re-prompt.
The receipt also confirmed independent retrieval/re-prompt for the already
successful downloaded-copy database restore. Backup readiness is now verified
off-device; PITR remains unavailable. Netlify and Render were re-attested to the
same deployed SHA at `2026-10-03T11:12:38.256Z`. Fresh read-only KB preflight retained
the reviewed digest and estimated exactly 28 calls, under a cap of 100.

### Completed re-embedding and Admin publication

Apply succeeded at `2026-10-03T11:16:32.849Z`: 28 documents updated and verified,
28 provider calls, no variants, under the bounded cap of 100. Profile/version:
`question-answering-v1` / `gemini-embedding-2:768:question-answering-v1`.
Snapshot ID: `kb-reembed-staging-20261003T111613Z-67f79a57`; the AES-GCM snapshot
and separate recovery key remain in private local custody, outside the repository.

Final editorial coverage supersedes the earlier 27/1 proposal: 17 unchanged,
nine corrected answers/source sets, two HOLD entries (29 and 33). Corrections were
applied through authenticated Admin without bypassing the privacy validator.
The final read-only DB check at `2026-10-03T11:56:53.149Z` verified 26 published /
reviewed entries, two draft / needs_review entries, exact final answers and sources,
server reviewer metadata, all 28 ready vectors and both READY/queryable indexes.
Changing source metadata correctly reset review to draft; those four entries were
reviewed and republished after their retrieval dates were saved.

Admin Test Search in production mode (threshold 0.75, limit 3) returned the
intended entry at rank 1 for three representative queries: footwear 96.4%,
IF/keto/eat-clean 96.8%, omega-3/multivitamins 98.3%. Updated answers were visibly
returned. This is browser diagnostic retrieval evidence, not canonical E2E PASS.
Receipts and screenshot: `kb-final-readonly.json`, `kb-retrieval-ui.json`,
`kb-retrieval-staging.jpg` in the ignored continuation directory.

Backup readiness passed with age 8.43 hours; Netlify and Render were re-attested
to the same deployed SHA at `2026-10-03T11:56:56.267Z`. No application or production
data change was made by this continuation.

### Live runner recovery

The first attempt preserved case 1 and sent case 2. Its evidence reader selected
an empty assistant tool-call message before the final nonempty response and
incorrectly rejected terminal persistence. Cleanup failed closed; no new attempt
was sent for either question. Exact run-owned read-only reconciliation found
case 2's successful meal tool/card and final persisted assistant response with
the stream lease cleared.

The ignored runner now selects the last nonempty assistant response without a
tool call. A synthetic regression reproduced RED before the fix and passed
afterwards. Runner/continuation tests: 17/17 PASS; independent security review
found no blocking issue. The continuation preserves case 1 verbatim, recovers
case 2 from the exact terminal DB turn, hashes/links the unchanged first artifacts,
reuses only the two verified synthetic actors and sends cases 3–15 once. Runtime
SHA/UUID/fingerprint are pinned; uncertain requests block cleanup. This harness
repair did not change or redeploy the application.

### Completed 15-case live review

Run `957cefc1-5b7d-4b84-b017-83a901621575` completed all 15 persisted turns by
`2026-10-03T12:18:42.826Z`. Continuation exit code: 0. The same runtime SHA and
instance fingerprint were observed throughout the collected requests. Case 2
was recovered from its original terminal database turn; the first artifact
does not retain its SSE copy. No semantic failure was overwritten by a retry.
Cases 4→5 and 6→7 retained their respective conversation IDs.

| Case | Semantic result | Observed evidence / limitation |
|---|---|---|
| 1 | PARTIAL | Approximately 600 kcal / 51 g protein, no chicken meat; eggs given as two units, without the requested grams. No structured meal card. |
| 2 | PASS | 501.1 kcal / 30 g protein, grams for all foods, no eggs, successful server meal card. Original response recovered; no resend. |
| 3 | PASS | 501.1 kcal / 30 g protein, grams for all foods, no milk/whey, successful meal card. |
| 4 | PASS | 2,196 kcal / 140.2 g protein, rice/fish/vegetables/tofu present with grams and summed macros. Practical menu quality remains limited. |
| 5 | FAIL | Replacement case, same conversation as 4. Tool-processing-limit response; no tofu-to-fish change or before/after quantities. |
| 6 | PASS | Four meals, 2,500.2 kcal / 170.1 g protein; displayed ingredients exclude whey/lactose/peanuts. Catalog price estimate 127,347 VND ≤150,000. |
| 7 | PARTIAL | Same conversation as 6. Correctly refuses scoped adjustment because baseline has no rice/oil; requested 2,200 kcal result not achieved. |
| 8 | FAIL | Refuses to generate a four-day dumbbell/band plan; no schedule or deload. |
| 9 | FAIL | Text includes chair/table for incline push-ups; card lists different exercises including Plyo/Clock push-ups. Five-result count does not prove beginner/no-equipment quality. |
| 10 | PASS | WHO activity and strength recommendations, live webSources card and grounded web-required trace. |
| 11 | PASS | Five grouped intake questions; does not invent calories or a personalized plan. |
| 12 | PARTIAL | Seven days covered, but generic food groups and unspecified full-body sessions fall short of a detailed plan. |
| 13 | PARTIAL | Stop/medical-referral cautions present; pain-free loading advice and source support inadequate for the suggested split squat/lunge/knee-sleeve claims. Exercise catalog tool was still called. |
| 14 | PASS | TDEE form requests missing data and confirmation; no fabricated numeric TDEE. Secondary defect: supplied 60–90 minute duration remains marked missing. |
| 15 | FAIL | Ronaldo answer cites supplement/weight-loss sources. Trace uses internal KB with no web search despite requesting current public sources. |

Root independently summed every displayed ingredient for cases 2, 3, 4 and 6:
protein, carbohydrate, fat and calories exactly matched the reported totals at
the displayed precision. This checks arithmetic and visible constraint handling;
it does not independently validate nutrient/cooking-state or current market-price
provenance. The three-food menu in case 6 and dried-cassava/dried-shrimp choices in
case 4 merit practical nutrition review despite passing numeric requirements.

Independent semantic review covered cases 8–15. WHO values agree with the
[official guideline](https://www.who.int/publications/i/item/9789240015128).
For knee-pain safety, [AAOS Knee Conditioning Program](https://orthoinfo.aaos.org/globalassets/pdfs/2023-rehab_knee.pdf)
supports avoiding painful exercise; the assistant's unrelated KB references do
not establish its specific unloading claims. Source provenance and factual
content were assessed separately; citation presence alone was not counted PASS.

Canonical scoped cleanup registered only the two synthetic actors and returned
`verified=true`, `residue=0` across users, conversations, usage buckets, memories,
memory preferences, tool confirmations, moderation states and acceptance claims.
No owner chat or existing KB entry was registered for deletion.

Evidence: `original15-continued-20261003.json`, unchanged first-run/recovery
artifacts, `original15-meal-audit.json`, and the final semantic assessment in the
ignored continuation directory. These are live API-harness and manual-review
evidence, **not canonical E2E or a fresh full release QA PASS**. Existing CI and
deployment evidence above remain separate; no new application build/deploy was
performed during KB publication and acceptance.

Before claiming full semantic acceptance: resolve case 5's bounded substitution,
case 8's constrained workout fallback, case 9's beginner/equipment and text/card
consistency, and case 15's public-source routing. Improve cases 1/12 completeness,
case 13 pain-safe routing/source support, and case 14 duration extraction. Keep
case 7's safe scoped refusal and offer a clear allowed-change clarification.
Entries 29/33 remain HOLD pending identity/source verification.
