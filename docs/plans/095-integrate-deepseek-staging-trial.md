# Plan 095: Integrate DeepSeek staging trial

> Spec, plan and tasks approved by owner 2026-10-06 for local implementation.
> Owner approved commit, protected PR202 merge and staging deploy on 2026-10-06.
> Owner subsequently authorized the visible UI15 trial with their staging admin account.
> Drift check: verify baseline HEAD and product diff before writing. Never copy
> product edits from the dirty primary checkout or bypass release protection.

## Status

- Priority: P1; Complexity: COMPLEX; Effort: L; Risk: HIGH.
- Depends on: 094B baseline, not completion of 094C certification.
- Category: feature; Planned at / Updated at: 2026-10-06.
- Lifecycle: IN PROGRESS; Verification: FOCUSED; Rollout: PENDING.
- Owner: `01a111c7-ce7e-7321-bb6e-5e0611b266b1`; gateway continuation updated2026-10-07.
- Spec: [DeepSeek staging provider trial](../specs/deepseek-staging-provider-trial.md).
- Current authority includes scoped commit/push, protected merge and staging deployment.
- Deploy existing Gemini profile first; owner enters the DeepSeek key separately.

### Verification checkpoint — 2026-10-06

- TASK-001/002/003 implemented; independent review and PR202 CI5/5 complete.
- CI: server 3,616 tests, client 939 tests, AI eval73/73 and E2E129 PASS.
- Static CI build PASS; existing staging health7/7 PASS after bounded retries.
- Exact deployment is pending verification; paid DeepSeek trial is not authorized yet.
- Release sequence: commit Plan095 docs, fresh PR CI, protected merge, exact staging
  push CI, provider deploy identity and GET health. Preserve unrelated Plan094C edits.
- Release blocker: fresh CI found GHSA-wq5f-xc86-pv6w in sharp. Scope extends only
  to server manifest/lock patch0.35.5 and native dependencies; verify image regression,
  canonical dependency audit and fresh CI. No image behavior or audit-policy changes.
- Detailed provenance, earlier local failures, review gaps and remaining gates:
  [verification report](../reports/095-deepseek-pr202-ci-checkpoint-2026-10-06.md).

## Why This Matters

### Step 6: Gateway continuation — 2026-10-06 (TASK-006)

- Owner identified the purchased key as issued by vibi.top and supplied its docs.
  GET `https://vibi.top/v1/models` returned200 and `deepseek-v4.1-flash`; official
  DeepSeek401 was an endpoint mismatch, not proof that the gateway key was invalid.
- Baseline is staging `0977bd103c84a799d7cbb2186b61cc67b361f6e0`, isolated checkout,
  branch `codex/vibi-staging-gateway` on driveD. Existing primary/094C edits are out of scope.
- Root owns new `server/src/config/deepseekEndpoint.js`, existing `deepseekTrial.js`,
  `services/ai/providers/deepseek.provider.js`, their focused tests and canonical docs.
  Review found hardcoded model attribution: root also owns the minimal resolver import/use
  in `controllers/ai.controller.js` and the existing `aiDeepseekTrial.integration.test.js`.
  Independent billing discovery is read-only; independent security review precedes release.
- Add `DEEPSEEK_ENDPOINT_PROFILE=vibi` paired only with `deepseek-v4.1-flash` and
  fixed `https://vibi.top/v1/chat/completions`. Preserve the default official pair.
  Unknown profiles/model pairs fail before egress. Vibi requires the complete
  existing staging profile even when the exported provider is called directly.
- No arbitrary base URL, redirect, retry, fallback, dependency, schema, UI, quota,
  timeout or production change. Backend-only egress needs no browser CSP/CORS change.
- Verification: provider/config RED to GREEN; readiness/factory/controller/KB regressions;
  trusted exact-commit CI release build, unit, AI eval, E2E and security gates before merge/deploy.
- Live: owner's existing staging admin session, frozen14 original prompts plus replacement5,
  preserve4→5 and6→7. Submit once per case; retain visible test chats as requested.
  Conservative stop at USD1 measured decline and90 provider calls including any compatibility probes.
  Wallet balance and token quota are distinct; never report Unlimited quota as wallet credit.
- Stop on unsupported protocol, unknown pricing/balance, target drift, corpus overflow,
  failed security/release gate, or budget boundary. No fabricated web-grounding PASS.
- Done: guarded gateway tests and release gates pass, exact staging runtime verified,
  UI15 outcomes and before/after gateway billing evidence reported; no production certification.
- Focused evidence: initial gateway RED3/16, then seven files116/116 PASS. Independent
  review found one model-attribution issue; HTTP/SSE regression reproduced Vibi trace
  mismatch, resolver fix made the full controller file13/13 PASS, including static fallback labels.
  No live generation calls yet; trusted CI and exact gateway deployment remain pending.
- Resume 2026-10-07: current gateway/provider/config/controller set passed60/60 tests
  across4 files on Node22.23.1; first sandbox attempt was blocked by localhost EACCES.
  `agents:validate` and staged/unstaged diff checks passed. Vibi Wallet UI is signed in,
  showing USD10 balance, USD0 used and0 API requests before the trial.
  Fresh trusted CI, protected staging merge, exact deploy identity and UI15 remain pending.

The gateway profile above supersedes the original official-only endpoint/model
restriction below for this user-authorized staging continuation.

Owner wants a conversational assistant, not a FAQ-only responder. DeepSeek must
replace generation while preserving conversation memory, structured tools and
security. Existing Gemini embedding/web-search calls must not silently remain in
the assistant trial; Gemini and its vectors stay available for explicit rollback.
Trial evidence is diagnostic, not AC009/Plan092 certification or production GO.

## Current State / Drift Check

- Checkout `.local-data/ai-progress-staging-20261003`, implementation HEAD
  `089cb700dde95716c1d7c546c09eb42e8a7bef8f`; root checkout has unrelated changes.
- PR202 targets staging base `0a25bba1bcc79bfb2a057c2dc40703eb9d8851aa`.
- Provider/facade/config and additive retrieval traces are implemented. Contracts
  below describe the current code; CI37455832149 checked this exact product diff.
- Existing staging uses Gemini. No DeepSeek key/config activation or live trial
  is established by the PR tests. KB writes/duplicate checks remain outside trial.

Initial read-only commands: `git status --short`, `git diff --stat`,
`git rev-parse HEAD`; compare product diff with this state. Preserve existing
094C document changes; do not change its exhausted diagnostic budget.

## Contracts and Proposed Bounds

- Backend-only native fetch to fixed `https://api.deepseek.com/chat/completions`;
  `redirect:"error"`, no configurable base URL, SDK or dependency upgrade.
- Explicit model `deepseek-flash`, `thinking:{type:"disabled"}`; never expose
  reasoning. Chat 2048 output tokens; KB selection 256. One attempt/call, no retry
  or fallback to Gemini/mock. Required named tool uses official non-thinking format.
- Provider input JSON <=128 KiB; SSE frame <=64 KiB; cumulative response <=256 KiB;
  aggregated tool arguments <=64 KiB. Reject oversized input before egress.
- Keep runtime: history20, agent iterations5, tools4/iteration and8/request,
  chat deadline75s and tool deadline15s. Provider ceiling45s bounded by shared
  remaining deadline; KB ceiling15s within the same chat deadline, never added to it.
- `deepseekLLMStream(messages, tools, options)` keeps internal events. Options:
  `signal`, `deadlineAt`, `timeoutMs`, `requiredToolName`, `maxOutputTokens`,
  `responseFormat` (text or json_object), `surface` (chat or kb_selection).
  Usage goes to provider-specific metrics, not additional browser SSE events.
- Map internal assistant `tool_calls:[{id,name,args}]` to official function objects;
  internal tool result `id` becomes official `tool_call_id` (controller:1450/2090).
  Replace mechanical last20 trimming with complete-turn-aware selection <=20:
  discard only leading cut tool groups, preserve remaining ordered user/assistant
  turns and newest user. Do not reject an otherwise valid history merely because
  the cap cut a tool group. Genuine orphan/duplicate IDs or incomplete interior
  tool turns fail before request, not minimal-history retry. Aggregate argument
  chunks by index; validate name/ID/object args/available schema before yielding.
- Require terminal finish reason `stop` with text/no calls, or `tool_calls` with
  valid nonempty calls, AND `[DONE]`; mismatched finish/payload is an error. Empty,
  truncated, malformed, filtered, insufficient-resource or aborted stream fails;
  controller must not save partial output as completed. Buffer tool calls until
  finish reason and DONE both validate; emit only one complete tool-call batch.
  A later stream error must not execute a partially accumulated tool call. Trial
  controller rethrows `DEEPSEEK_*` errors before existing tool/card fallback branches:
  even a provider error after a successful tool round cannot finalize as completed.
  Cancel reader/timers; record the owned turn as failed through existing contract.
- New `searchAssistantKnowledgeBase(query, options)` facade handles only chat and
  Admin Search Test. Default wraps existing vector service; trial uses selection.
  Existing KB create/import/embedding/duplicate/generation workflows stay unchanged
  and must not be exercised or described as zero-Gemini in the trial.
- Selection: load at most65 eligible candidates to detect proposed cap64, with
  explicit projection. If65 fetched, STOP before privacy exclusions; rejecting
  unsafe entries must not hide unseen candidates or manufacture full coverage.
  Privacy-check full projected candidate including answer, tags, reviewed variants
  and source metadata. Exclude unsafe entries before egress; report safe/excluded
  counts, not their private content. Full eligible snapshot <=64 candidates AND
  serialized safe data<=64 KiB; otherwise `KB_TRIAL_CORPUS_LIMIT` and STOP trial,
  never popularity/keyword top-N. Controller/Admin must surface coverage failure,
  not swallow it through the existing non-blocking KB catch or treat it as no-hit.
  Typed fatal `KB_TRIAL_*` errors for overflow, invalid/stale selection or unexpected
  privacy/protocol failure propagate to the existing request error contract without
  paid generation/model-prior fallback. Deliberate privacy-ineligible query skip
  remains distinct from a retrieval failure; ordinary private chat policy is not
  expanded here. Only valid `{refs:[]}` is selection no-hit. Overflow prompts owner direction.
- One JSON selection call, no tools. Output exact `{refs:["kb_1",...]}` with <=3
  request-local references; reject unknown fields/references, excessive length
  and invalid JSON; deduplicate valid refs preserving order. Empty refs is a valid
  no-hit, not an error. Selection errors never silently become vector fallback.
- Re-fetch selected documents; enforce eligibility/privacy/revision and relevant
  content/provenance snapshot equality after selection. Changed/stale records fail
  closed. No model-generated Mongo query, matchedQuestion, URL or citation proof.
- Result metadata `retrievalMethod:"llm_selection"`, `retrievalRank:1..3` and
  `revision`; omit `similarity`. Server derives root/variant question identity
  only from existing reviewed text; never infer an exact citation match from rank.
- API preserves `{success:true,data:[...]}` and adds server-owned retrieval/coverage
  metadata for hit and miss. Vector response compatibility remains. Trial Admin
  Search ignores cosine threshold as a ranking parameter and labels that explicitly.
- Config proposal: `AI_PROVIDER=deepseek`, `AI_STAGING_PROVIDER_TRIAL=deepseek`,
  `AI_KB_RETRIEVAL_MODE=llm_selection`, `DEEPSEEK_MODEL=deepseek-flash`, secret
  `DEEPSEEK_API_KEY`. Flag/key alone never authorizes DeepSeek outside strict staging.
- Exact staging profile first positively checks `APP_ENV===staging` and explicit
  trial flag/provider/mode; helper.valid alone is insufficient because non-staging
  is a no-op success in `validateStagingEnvironment`. Then existing validation plus allowlisted
  client/API origins and DB `htcoaching_staging`; any mismatched flag/mode/provider
  rejects startup; use one shared predicate at startup/factory/facade/search guard.
  Test production APP_ENV with staging-looking DB/origins still rejects trial.
  Production default Gemini gates stay unchanged. Keep Gemini
  secrets and independent Meal Scan data-use gates; no bypass of unrelated checks.
- Web-required trial calls return existing unavailable-evidence shape with
  `meta.diagnosticCode:"unsupported_capability"`, `providerRequestMade:false`,
  `searchOutcome:"not_called"`, no Gemini request;
  not a fake search success. Preserve supported persisted outcome enum and capture
  capability code through tool engine's explicit diagnostic allowlist to operator
  evidence, not a ChatConversation schema change. Tool engine currently drops
  `meta.diagnosticCode`; add safe diagnostic enum plus boolean request attribution,
  not arbitrary metadata, using existing safe outcome enum.
  Deterministic unsupported direct-search reply records model
  `server:capability_unavailable`, not GEMINI_SEARCH_MODEL or claimed DeepSeek usage.

## Scope and Ownership

Provider worker (requested implementation role per session-governance, independent):
only new `providers/deepseek.provider.js`, `deepseek.protocol.js` and their focused
`providers/__tests__/deepseek*.test.js`. May read all files, may not edit factory,
controllers, config, metrics, KB, frontend or docs. Never revert others' edits.

KB worker (same constrained implementation role): only new
`services/ai/deepseekKnowledgeSelection.service.js` and
`services/ai/__tests__/deepseekKnowledgeSelection*.test.js`. Uses locked provider
options and existing eligibility/privacy helpers; no config/controller/UI edits.
Provider and KB workers may build independent modules concurrently, but root must
integrate only when each behavior seam passes. New modules <=300 lines or split
within reviewed ownership, not broad refactor. No test-only production exports.

Root owns factory; new `config/deepseekTrial.js`; `productionReadiness.js`;
new `services/ai/knowledgeRetrieval.service.js`; AI and KB controllers;
new `services/ai/conversationHistory.js` plus focused history tests (complete tool-group bounds);
`systemPrompt.js`; metadata-only `aiLogger.js` updates if necessary;
`observability/providerUsageMetrics.js`, metric allowlist `observability/metrics.js`;
`tools/searchKnowledge.tool.js`; `tools/toolEngine.js` diagnostic allowlist;
Admin KB Search label/helper;
related config/controller/service/metrics/client tests; isolated E2E spec;
`docs/operations/runbooks/deepseek-staging-trial.md`, spec/plan/index/traceability.
Root also owns generated `.agents/reference/project-inventory.json`: its canonical
generator counts product test paths from the Git index, so the seven new server
test files require a snapshot refresh before commit/CI. No inventory policy or
validator changes; verify with `npm run agents:validate` after staging.
The self-contained plan exceeds 300 lines to retain its security bounds, ownership,
acceptance/rollback contracts and verification checkpoint; new runtime/test modules
remain below 300 lines each.
Exact new helper paths must be recorded before edits if split is needed.

Out of scope: auth/CSRF/quota changes, `client/src/utils/api.js`, ChatWidget/SSE
rewrite, destructive schema/index/migration changes or re-embedding, broad KB writes,
Gemini deletion, Meal Scan or Admin generation, CI oracle/timeout relaxation,
production rollout. A backward-compatible additive `ChatConversation.answerTrace.kbRetrieval`
subdocument is in scope for trial evidence; it stores only allowlisted method/coverage/
counts and entry ID/rank/revision metadata, with no migration or backfill.
External provider is called server-side; browser CSP need not expose DeepSeek.

## Steps / Proposed Tasks

### Step 1: Chat with DeepSeek while preserving memory and tools (TASK-001)

- Behavior: selected strict staging profile streams conversational replies and
  follow-up context through existing SSE, including tool result → next model turn.
- Files: provider worker files plus root factory/config/controller/model metadata,
  metrics and focused tests (including `aiFeedbackTrace.integration.test.js`).
  Depends on owner approval of plan/tasks.
- Acceptance: no fallback, exact provider/model attribution, bounded request, abort,
  correct tool conversion; partial/failed replies never persisted as completed.
- Public seams: exported generator; factory imports; controller HTTP/SSE route.
- RED/GREEN tests: fragmented UTF-8, CRLF/SSE/comments/keepalive, multi-tool arguments,
  stop/tool finish, empty/missing DONE, bad JSON, HTTP429/5xx, redirect, no retry,
  wrong history/schema, cap cutting valid tool groups, forced tool, disconnect and
  deadline, all size caps. Missing DONE after tool_calls executes zero tools;
  provider failure on the round after tool result never saves completed assistant.
- Verify from server: `npx vitest run src/services/ai/providers/__tests__/deepseek.provider.test.js src/config/__tests__/deepseekTrial.test.js src/config/__tests__/productionReadiness.test.js src/controllers/__tests__/aiDeepseekTrial.integration.test.js` → exit0.

### Step 2: Retrieve semantic KB evidence consistently in chat/Admin (TASK-002)

- Behavior: paraphrase/reviewed-variant/no-hit uses bounded DeepSeek selection;
  chat and Admin share facade, cancellation, privacy, source guards and honest labels.
- Files: KB worker files plus root facade, AI/KB consumers, systemPrompt, Admin
  labels/helpers and tests. Depends on Step1 generator contract.
- Acceptance: full eligible cohort under caps or STOP; no vectors/PII sent;
  allowlisted selection, revalidation; no fake score/citation; no Gemini egress.
- Public seams: facade with synthetic isolated DB and mocked HTTP provider, Admin
  search HTTP response and rendered ranking label. No production DB mocks.
- Tests: relevant candidate at final eligible position, cap+1, byte cap,
  hidden/stale/unreviewed/wrong-profile candidates, private fields, hostile KB text,
  malformed/unknown/duplicate refs, revision/status/source edit race, abort/error,
  source misbinding, same mode for empty/hit/Admin, unchanged vector duplicate flow.
- Verify from server: `npx vitest run src/services/ai/__tests__/deepseekKnowledgeSelection.test.js src/services/ai/__tests__/knowledgeRetrieval.test.js src/controllers/__tests__/aiDeepseekTrial.integration.test.js src/controllers/__tests__/knowledgeBaseEvidence.routes.integration.test.js src/services/ai/__tests__/systemPrompt.test.js` → exit0.
- Verify: `npm run test:unit:client` and UI regression gate → exit0; cosine labels
  remain only for vector results. Read UI skills before editing; no redesign.

### Step 3: Fail closed for unsupported web search and unsafe config (TASK-003)

- Behavior: web-required questions transparently lack trial web evidence without
  contacting Gemini; accidental production/mixed trial config is rejected.
- Files: root search tool/engine diagnostic/config/factory/controller metadata and regression tests.
  Depends on Steps1–2 integration.
- Acceptance: no outbound Gemini requests on assistant hit/miss/error/search/Admin;
  no fabricated current sources; original production Gemini/Meal Scan gates intact.
- Verify from server: `npx vitest run src/config/__tests__/productionReadiness.test.js src/config/__tests__/stagingSafety.test.js src/services/ai/tools/__tests__/searchKnowledge.tool.test.js src/services/ai/tools/__tests__/toolEngine.test.js src/controllers/__tests__/aiDeepseekTrial.integration.test.js src/observability/__tests__/providerUsageMetrics.test.js` → exit0.

### Step 4: Verify and review the trial before asking to publish (TASK-004)

- Behavior: reproducible local/CI evidence covers conversation, retrieval and risk;
  operator runbook specifies key entry/rollback without storing secrets.
- Files: root integration/tests/E2E/runbook/evidence, no unrelated refactors.
  Depends on Steps1–3; independent security review read-only using actual diff.
- Verify under `qa`: `npm run test:unit`, `npm run test:ai-eval`,
  `npm run lint --prefix client`, `npm run build --prefix client`,
  `node .agents/scripts/validate-tools.mjs`, `npm run security:secrets`,
  `npm run security:data-boundaries`, `npm run security:docs-privacy`,
  `npm run agents:validate`, `git diff --check` → exit0.
- UI gate: `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` → exit0, no baseline changes to hide failures.
- `npm run test:e2e` only against isolated local fixtures with provider interception;
  if unavailable, NOT RUN + blocker, not UI staging PASS. Test history/Stop/Retry/
  failed-completion behavior and Admin empty/error/rank states.
- Reuse valid QA evidence by exact source fingerprint; trusted CI required for
  publishing. Run `ai-check`, `code-review`, `impact-check`, `cleanup-delivery`.

### Step 5: Conduct an approved, bounded live UI staging trial (TASK-005)

- Behavior: owner can compare live DeepSeek conversation and KB on actual staging
  UI, then decide provider; no production promotion from diagnostic results.
- Depends on trusted review/CI, explicit Git/publish/deploy authorization, exact
  deployment identity/SHA/health and owner-entered backend key. No calls before
  agreed synthetic account/fixture, paid budget/count and cleanup target.
- Proposed target identity: Render `srv-d9g8em61a83c73b4l61g`, DB
  `htcoaching_staging`; historical origins `https://staging--htcoachingweb.netlify.app`
  and `https://htcoachingweb-staging.onrender.com` must be verified, not assumed live.
- Proposed 8 cases: free conversation, context follow-up, KB paraphrase,
  reviewed variant/source binding, KB miss, read-only tool follow-up, Stop/Retry/
  reload history, web-required unsupported. Exact paid provider-call cap remains
  pending owner approval; turns are not equal to calls because of selection/tools.
- Verify actual UI with approved browser surface/fixture; record PASS/FAIL/NOT RUN,
  latency, sanitized request counts/usage/provider/model/SHA, IDs+revisions/retrieval
  method and observed history. Never store raw private conversation/key/cookie.
- Check eligible corpus count/bytes before paid selection; if over cap STOP and ask
  for approved cohort or separate embedding architecture, not silent truncation.
- Cleanup only approved test-owned records; KB usageCount/lastUsedAt may increase.
  Rollback snapshots config names/values without secrets, restores Gemini settings,
  redeploys exact known SHA; preserves vectors. Report Gemini surfaces outside trial.

## Done Criteria and STOP Conditions

- [x] Owner approves plan/tasks before product edits (2026-10-06).
- [ ] Steps1–4 test/review evidence passes, changes limited to declared ownership.
- [ ] Step5 verified live on exact approved staging target within approved budget.
- [ ] Gemini code/vector/profile preserved; no assistant-trial Gemini calls.
- [ ] No schema/data rewrite or production claim; 094C certification remains separate.

STOP for target/config ambiguity, privacy leak, unsupported official contract,
corpus overflow, unknown/stale selection, review critical finding, missing live
authority or budget; report root cause and required user help. Verification failures
allow at most3 evidenced repair cycles; do not loop one bug indefinitely. Scope
expansion requires plan amendment before code and owner direction if material.

## Review Notes

Independent read-only design critique found load-bearing gaps: complete tool-group
history, cap before privacy exclusions + surfaced overflow, and diagnostic/model
attribution on unsupported search. This proposal includes those amendments;
owner approved plan/tasks for local implementation. No runtime PASS inferred.

Scrutinize tool history semantics, stream terminal validation, secret/error sinks,
retrieval cohort coverage/races, citation proof, provider usage and startup exception.
Threat matrix LLM01–10 mapped to Step1 protocol bounds, Step2 privacy/provenance/
injection/source guards and Step3 fail-closed config/capability. Guards not yet tested
are proof gaps, never PASS. Official contract:
[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) and
[Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/), verified 2026-10-06.
