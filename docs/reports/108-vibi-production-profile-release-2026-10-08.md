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
