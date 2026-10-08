# Plan 096A: Enable the approved Vibi production profile

- Complexity: COMPLEX; priority P1; lifecycle IN PROGRESS; risk HIGH.
- Owner: 01a1172c-d836-7250-8396-275f41a6f75d; updated 2026-10-08.
- Verification: NONE; rollout NOT STARTED; depends on Plan096 and staging PR208.

## Why and authority

The owner explicitly authorized production release and selected Vibi + Brave on 2026-10-08.
Current staging a0a4f255 uses Vibi, but production still uses Gemini and the provider guard
rejects production. Enabling the production profile must preserve staging isolation.
The owner accepted the fresh 15 cases as PASS_WITH_NOTE and personally passed staging UI.
Keep original machine grading and case10 rubric failure; do not manufacture exact-15 certification.

## Current state and drift check

Run `git status --short` and `git rev-parse HEAD` before implementation.
Base is a0a4f2555fde0fef162307cc3a02c87ee380cd39 in the isolated production worktree.
`deepseekTrial.js` rejects APP_ENV other than staging. `deepseek.provider.js` requires
`isDeepseekStagingTrial()` for Vibi. `knowledgeRetrieval.service.js` uses the same trial assertion.
Production Render reports APP_ENV=production and database gym-app; client/api origins come from
the existing trusted deployment environment. Do not hardcode production URLs or copy staging env.
TALK01 completed three paired groups (two successes, one validation failure), with a fork.
The failed 450 kcal breakfast canonicalizes targetCalories to null because per-meal minimum is 500.

## Scope and steps

### Step 1: Validate production Vibi + Brave

Add an explicit production-only `AI_PRODUCTION_PROVIDER_PROFILE=vibi` guard and a shared
   provider-profile dispatcher. Require fixed Vibi endpoint/model, valid key, Brave provider/key,
   production environment, database gym-app, HTTPS origins and no staging trial flag.
   Preserve `deepseekTrial.js` semantics. Update startup, factory, retrieval, search and controller
   consumers so production uses the same bounded provider and guarded evidence flow.
   Files: config/deepseekProduction.js, config/deepseekProfile.js, productionReadiness.js,
   providers/index.js, deepseek.provider.js, knowledgeRetrieval.service.js,
   tools/searchKnowledge.tool.js, controllers/ai.controller.js and their focused tests.
   Verify: focused Vitest profile, gateway, readiness, retrieval and Brave integration suites exit 0.
### Step 2: Explain unsupported meal targets

Return a clear deterministic response for an explicitly unsupported calorie target before
   LLM/tool execution. Do not lower the 500-per-meal/800-per-day bounds, coerce arbitrary arguments,
   invent totals or silently replace 450 with a different target.
   Files: mealRequestConstraints.js, ai.controller.js and focused canonical request/controller tests.
   Verify: 450 kcal regression rejects without provider/tool execution; 500 kcal and daily guards pass.
### Step 3: Verify release readiness

Carry forward verified 2026-10-08 backup readiness and record (secret-free documents only),
   then QA, security review and staging promotion. Preserve raw/manual evidence distinctions.
   Files: docs/specs/vibi-evidence-and-certification.md, plan index/state/traceability,
   docs/operations/production/backup-readiness.json and backup record; bounded release reports; generated systemDependencyManifests.json and project-inventory.json.
   Verify: release and disaster-recovery readiness commands exit 0; exact candidate CI 5/5;
   both staging deploy identities match candidate; trusted staging acceptance passes.
### Step 4: Promote and observe production

Promote only after gates pass. Configure production Vibi + Brave internally, retain all
   unrelated production secrets/settings and retain Gemini for embedding/Meal Scan consumers.
   Capture previous provider settings and production rollback deploy IDs privately.
   Verify: protected promotion, paired production deploy SHA, health and >=30 min observation.

### Step 3A: Capture the finalized conversation baseline before isolation

Acceptance37784156355 failed after the live KB/provider lane with a generic browser assertion.
Recover only this synthetic run using trusted staging-ai-recovery; require verified residue0.
The browser currently captures stableBody before captureUiEvidence waits for persisted assistant identity.
Scope: stagingAiChatAcceptance.browser.js, its reconciliation regression test and synthetic
browser boundary fixture, plus this canonical plan/traceability and release checkpoint documents.
Keep actual isolation assertions, request inventory, timeouts and failure grading intact.

H1: citation precedes final streamed text; a partial baseline creates false isolation failure.
Prediction: a synthetic browser with valid final reconciliation must reach the isolation checkpoint.
Probe: stagingBrowserReconciliation.test.js through public runBrowserAcceptance; RED1/3 on2026-10-08.
H2: an actual conversation isolation defect changes the completed answer after navigation.
Probe: mutate only the answer on return; the guard must continue to reject that change.
H3: control admission or navigation fails independently; existing generic error cannot distinguish it.
Preserve fail-closed control barriers and add bounded codes to baseline/reconciliation assertions.
The local race is reproduced; original incident linkage remains unconfirmed until fresh live evidence.

Verify: run the focused Vitest command below -> all pass, including unchanged
and actually changed completed-answer cases. Then exact-SHA CI and paired staging deployment;
fresh trusted acceptance only after cleanup0 and a new verified wallet balance above3 USD.
No production publish until required main approval and promotion gates pass.

```powershell
cd server
npx vitest run src/scripts/__tests__/stagingBrowserReconciliation.test.js src/scripts/__tests__/stagingAiChatAcceptance.browser.test.js
```

## Commands and verification

- `cd server; npx vitest run src/config/__tests__/deepseekProfile.test.js` -> exit 0.
- `node .agents/scripts/validate-tools.mjs` -> exit 0.
- `npm run security:secrets` and `npm run security:data-boundaries` -> exit 0.
- `npm run agents:validate` -> exit 0.
- `node scripts/check-backup-readiness.mjs --mode=release` -> PASS.
- Canonical CI runs client/server/secrets/E2E/Docker; reuse exact-SHA artifacts.

## Boundaries and done criteria

No root dirty files, catalog writes, migration, quota/CSRF/auth changes or repeated fifteen prompts.
No additional paid request while wallet balance is unverifiable or <=3 USD.
Stop promotion on failed guard, uncertain provider identity, missing trusted acceptance,
stale recovery evidence, cleanup findings or rollback identity mismatch.
Done requires meaningful regressions, review with no blocking findings, exact-SHA release evidence,
production Vibi + Brave verified and completed observation. Until then report IN PROGRESS.

## Progress

2026-10-08: focused regressions PASS, 239 tests / 11 files. Release and disaster-recovery backup gates PASS.
Production/staging profile behavior, fixed endpoint, citations, history and unsupported breakfast response verified locally.
Full QA, trusted staging acceptance and production rollout remain pending. Wallet owner-attested at 9.06 USD after TALK01.

Local QA completed: server 3710/320 files, client 945, AI eval 73/73, release build 58/58,
security/dependency/agent/UI gates PASS. No local E2E rerun; trusted CI E2E required.

Live checkpoint09:56UTC: staging merge88b5d307 CI37756754770 PASS5/5 and paired deploy ready/live.
PR196 updated to this SHA; CI37758737545 PASS, draft, approving review still required.
Acceptance37758558812 FAIL on certified KB search DEEPSEEK_TIMEOUT/503; business cleanup0,
AI cleanup6 then7 after recovery tombstone. Recovery37759297315 fails ADMITTED_UNKNOWN.
Do not rerun acceptance, delete admitted receipts or release production before exact recovery proof.
See report108 for scoped terminal-KB/recovery proposal; policy change/apply are not approved by this checkpoint.
Production env snapshot encrypted and persisted restore verified; production remains unchanged.
Wallet owner-confirmed8.98 USD after this run. Fifteen owner-accepted cases remain unchanged.

The owner approved scoped Plan096B recovery on2026-10-08. Production keys plus the
four Vibi/Brave selectors are now saved and verified, with no deployment. The older
checkpoint saying env unchanged/proposal unapproved describes historical state only.

Checkpoint13:47UTC: recovery37782755084 verified0 closed the historical KB incident.
Staging fac6438 CI37782647818 PASS5/5, Netlify6ac796ed55c88600081737ca and
Renderdep-db3pi38m7kps73fjpecg ready/live. Acceptance37784156355 remains FAILED:
live KB/provider PASS; browser assertion failed before isolation PASS; cleanup inconclusive.
Normal trusted recovery37786369781 PASS with verified residue0 and alreadyClean=true.
Step3A regression RED1/3 -> GREEN102/102 across5 focused acceptance/recovery files,
including detection of real returned-answer drift. Agent/tool/secret/data-boundary gates PASS.
Wallet balance after the latest run is not verified; further paid requests remain blocked.
PR196 is ready for review with no approving reviews; production has not been deployed.
