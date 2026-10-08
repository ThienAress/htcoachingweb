# Plan096A — Vibi production preparation, 2026-10-08

Base: staging a0a4f2555fde0fef162307cc3a02c87ee380cd39 (PR208).
Owner authorized production release and explicitly selected Vibi + Brave.
Implementation is isolated on codex/vibi-production-20261008; root dirty files are excluded.
Production is not deployed by this report. Trusted candidate acceptance remains pending.

## Changes and scope

- `deepseekProduction.js` validates the explicit production profile, fixed endpoint/model,
  production environment/database/origins, keys and Brave; staging trial flags are forbidden.
- `deepseekProfile.js` dispatches production opt-in or the existing unchanged staging validator.
  Factory/startup, provider, KB selection, search and controller use this shared profile.
- `productionReadiness.js` retains Gemini requirements for non-chat consumers and identifies
  staging/production correctly. No provider silently falls back on invalid production opt-in.
- `mealRequestConstraints.js` and controller explain unsupported explicit calorie targets before
  model/tool execution. Bounds remain 500 per meal / 800 per day; 450 is never silently replaced.
- Generated dependency manifest reflects the already-merged sharp 0.35.5 server dependency.
  No sitemap/public-content updates are included; generated build drift is excluded from commit.
- Verified 2026-10-08 backup readiness supersedes the stale pointer, with owner-attested
  Drive/Bitwarden custody and an actual downloaded-archive restore. Continuous recovery remains false.

## Acceptance and evidence integrity

Fifteen cases were owner-accepted PASS_WITH_NOTE on the previous staging candidate.
Case10 original rubric failure and raw grader missing-record failures remain preserved.
The corpus contains 14 original questions plus the owner-approved case5 replacement.
This is baseline owner acceptance, not new exact-15 machine certification for the changed SHA.
UI PASS is based on owner inspection. No repeat of the completed fifteen questions.

TALK01 completed three paired tool groups across forked history: two successful meals and one
terminal validation failure. Normalized history passed; the actual final Vibi answer ended with
the requested marker. First prompt omitted its final period. Individual billing is unverified.
The validation failure was caused by null targetCalories for an unsupported 450 kcal target;
the new regression proves a deterministic explanation without provider/meal-tool execution.
Owner-attested wallet after TALK01: 9.06 USD. Stop new paid requests at unverifiable balance or <=3 USD.

Production config preflight at 08:58:05Z: validated proposed Vibi profile and full strict readiness,
zero errors/warnings and zero writes. Gemini retained. Production eligible KB count is zero
at 09:02:31Z; no catalog/KB migration is included and no reviewed production KB coverage is claimed.
Old failed acceptance run37404475141 was inspected using its exact owned IDs/marker;
read-only verifier at 09:09:40Z found residue zero across all cleanup collections. No cleanup writes.

## QA and review checkpoint

- Focused profile/provider/retrieval/Brave/meal integration: 239 tests in 11 files PASS.
- Final readiness/search regression after summary adjustment: 101 tests in 2 files PASS.
- Client: 945 tests PASS; release build 58/58 prerender routes, bundle/search-index gates PASS.
  First build lacked VITE_API_URL and failed; configured rebuild passed. No failure was waived.
- AI eval: 73/73 PASS (11 oracle fixtures; no new runtime-capture certification).
- Tools: 11/11 validated. Agent validation PASS after correcting plan traceability.
- Secret/data-boundary scans PASS. Client/server dependency audits PASS with no waived advisory.
- Client lint: zero errors, one pre-existing React Hook Form advisory.
- UI regression: zero new blocking findings; source baseline debt is retained.
- Full server suite: 3710 tests / 320 files PASS; affected readiness/search tests rerun 101/101 PASS.
- Trusted exact-SHA CI, staging acceptance and production rollout remain pending.
- Local E2E is not rerun: affected backend contracts have integration evidence; canonical CI E2E
  remains required before staging merge/release. Owner UI inspection does not substitute for CI.

Review: no BLOCK/HIGH found in this diff. Trace env config -> dispatcher/startup -> fixed provider;
user query -> router/privacy preparation -> Brave -> quote/numeric/scope guards -> sanitized SSE;
meal message -> canonical target bound -> deterministic response. Auth/ownership/CSRF/quota,
tool schema, deadlines/token/context bounds, untrusted-context and output guards remain intact.
LLM03/06/09/10 covered by focused profiles, existing engine/grounding guards and regressions;
LLM02 uses unchanged ownership/privacy and safe metadata logging. No new write tool or embedding write.
Prior main-to-staging features, full paid production telemetry and final acceptance/observation
are outside this diff review; their release evidence must be verified separately before promotion.

## Live release checkpoint — 2026-10-08 09:56 UTC

Canonical staging merge SHA: 88b5d3078ca6abadcead29e079bd6a677f1aae09.
PR209 is merged. Staging push CI37756754770 PASS5/5; promotion PR196 CI37758737545 PASS.
Netlify6ac761f4b97de10008aafbd6 ready and Renderdep-db3ma0favr4c73acli70 live,
with canonical paired identity and readiness HTTP200. PR196 now points to the same SHA,
remains draft and requires one approving review from another GitHub account.
Production auto-deploy/publish remain disabled; no production environment change or database write.

Trusted acceptance37758558812 FAILED. Business acceptance and cleanup PASS with residue0.
AC009 fixture creation, reviewed embedding and catalog-readiness passed; two non-certifying
KB readiness searches succeeded. The first certified KB root search failed before browser lanes.
Render telemetry identifies DEEPSEEK_TIMEOUT at09:45:34Z, approximately13974ms provider duration;
HTTP GET /api/knowledge-base/search returned503 after15754.95ms. Do not raise the15s bound,
silently fall back providers or retry to hide this failure.

AC009 intent runId9c7c1ab5-f0a1-43fa-b1ea-d3aa73326dbc remains FAILED:
initial cleanup residue6, receipt2e4b64d0-bc8a-4bc8-8f31-91d5c7eb54ca admitted,
fixture journal terminal/created. Exact recovery37759297315 failed with
STAGING_AI_RECOVERY_ADMITTED_UNKNOWN and retained the tombstone. Read-only inventory
at09:55:53Z confirms residue7: three control records, one KnowledgeEntry, two synthetic
users and one question-discovery record; no owned conversations. Neither Plan092 round ran.
No release candidate or production promotion PASS exists for this SHA.

Root localization: server/src/middlewares/stagingAiAcceptance.js:89 deliberately settles
only responses below500. A completed503 leaves the KB search receipt admitted; elapsed
expiry and quiescence do not authorize deletion. Existing recovery correctly refuses it.
This explains the retained fixture; it does not prove historical request settlement.
Provider latency is confirmed; the upstream reason for that latency is not established.

Proposal requiring explicit scope approval before changing the recovery policy:
1. Add bounded terminal failure handling for KB read-only requests after the handler/provider
   has actually finished; preserve unknown handling for open/disconnected requests and chat mutations.
2. Design a separate operator recovery path for this historical incident, preserving FAILED
   artifacts and never rewriting admitted to settled without proof. Bind exact service/deploy/SHA,
   run/JTI, provider drain evidence, actor IDs, payload inventory and preflight digest.
3. Require negative regressions for wrong target/run/actor, concurrent or unexpired request,
   missing drain/settlement proof, foreign data and partial cleanup. Review before any apply.
   If proof cannot be obtained, keep quarantine and NO-GO rather than fabricate a terminal result.
4. Only after verified cleanup0, run fresh exact-SHA acceptance, main review/merge,
   exact main-SHA staging certification, protected promotion and30-minute observation.
This proposal is not an executable cleanup approval or a waiver of certification.

Production configuration snapshot: Windows DPAPI CurrentUser encryption,77 env variables,
persisted round-trip restore PASS at09:55:50Z; plaintext secrets were not written to disk/logs.
The encrypted snapshot requires the same Windows user/host; the separate off-device database
backup remains unchanged. Snapshot is local/private, not committed.
Wallet owner-attested8.98 USD after this failed acceptance. Individual billing remains unverified.
No new paid request after that confirmation. NO-GO FOR PRODUCTION until recovery/certification.

## Approved recovery and production configuration checkpoint

The owner subsequently approved Plan096B evidence-bound recovery with review/tests.
The earlier unapproved proposal status is superseded; original acceptance remains FAILED.
Production env is now changed in Save only mode: Vibi/Brave keys/profile/model and
AI_PROVIDER=deepseek, AI_WEB_SEARCH_PROVIDER=brave, AI_KB_RETRIEVAL_MODE=llm_selection,
AI_PRODUCTION_PROVIDER_PROFILE=vibi are verified. No production deploy/database writes.
The current deployment has not switched provider. Private rollback snapshot is retained.
Focused recovery/middleware suites passed70 tests; live read-only proof diagnostic passed.
Historical CAS deletion and trusted workflow recovery are not yet executed.

Review checkpoint: Standards/Contract/Security surfaces cover completed KB503 settlement,
closed incident proof, staging-only read projection, archive-before-CAS workflow provenance,
expired/revoked synthetic ownership and canonical cleanup/report compatibility. Operator
correlation remains an explicit proof limitation; no cryptographic request linkage is claimed.
Production Meal Scan regression reproduced RED, fixed GREEN: validated Vibi chat retains
explicit Gemini image provider; invalid profile/mock image override does not gain access.
Focused suites PASS73 recovery tests +65 provider/Meal Scan tests; workflow18 and privacy86.
AI tool validator, agent governance, secret/data/docs boundary gates PASS. CI/full build/E2E,
trusted cleanup and release certification are pending; production remains NO-GO.
