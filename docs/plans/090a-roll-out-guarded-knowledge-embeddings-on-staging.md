# Plan 090a: Roll out guarded Knowledge Base embeddings on staging

> **Hướng dẫn thực thi**: Chạy theo thứ tự, giữ preflight mặc định read-only và
> dừng trước mọi write nếu target, plan digest, source hash, snapshot hoặc backup gate sai.
>
> **Drift check**: Plan bắt đầu từ `origin/staging` tại
> `6757bd40bd81b25377be18ff5460dde3e1fb68fc`, là merge SHA của PR #114.
> Nếu `KnowledgeEntry`, embedding profile/service hoặc staging release workflow đổi sau SHA này,
> reconcile contract và cập nhật plan digest trước khi apply.

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: HIGH — ghi vector Knowledge Base trên staging và external Atlas indexes
- **Depends on**: 090, PR #114
- **Category**: migration | data | tests | operations
- **Planned at**: 2026-09-14
- **Lifecycle**: BLOCKED
- **Verification**: STAGING
- **Rollout**: LIVE
- **Owner**: root
- **Updated at**: 2026-09-15

Local evidence trước PR: Node 22 focused six files 47/47 PASS, gồm MongoMemory
replica-set apply→rollback; full server suite trước patch review cuối 257 files /
2.561 tests PASS. Guardrails sau đó đã được merge/deploy trên staging và rollout
staging đã chạy; evidence thực thi mới nhất nằm ở mục `Staging Execution Evidence`.
Plan chưa hoàn tất: PR #124 đã đưa recovery journal v2 lên staging tại exact SHA
`ada5610b2518ae6dc6dad8a90c7759a93db0169d`; CI và hai staging deploy cùng SHA đều
PASS/ready/live. Gemini đã hồi phục với một request mới HTTP `200`, nhưng live
acceptance gần nhất dừng trước lane AC-009 đầu tiên vì response KB không luôn render
exact citation URL. Incident đã được recovery về `verified=true, residue=0`; fix
deterministic citation hiện mới được verify local, chưa deploy trên một exact SHA mới.
Provenance KB, toàn bộ AC-009 live lanes và rollback vector thật vẫn chưa hoàn tất.

## Why This Matters

PR #114 đã đưa profile `question-answering-v1` và retrieval Atlas-aware vào code, nhưng staging
vẫn dùng profile legacy cùng bounded fallback. Đổi env ngay sẽ làm mọi vector cũ không còn eligible.
Rollout này tạo một đường re-embed staging có thể review, chống drift, kiểm chứng và rollback để
đánh giá chất lượng retrieval mà không ghi production.

## Current State

- `server/src/services/ai/embeddingProfile.js` khai báo profile đích
  `question-answering-v1`, version `gemini-embedding-2:768:question-answering-v1`.
- `server/src/services/ai/embedding.service.js` có formatter theo `profileId`, nhưng
  `generateEmbedding()` hiện luôn dùng profile runtime và chưa cho migration chỉ định profile đích.
- `server/src/models/KnowledgeEntry.js` lưu root `embedding`, `variants[].embedding`,
  `embeddingStatus`, `embeddingVersion`, `embeddingError` và `embeddingUpdatedAt`.
- `docs/architecture/atlas-vector-index.md` định nghĩa hai index độc lập
  `kb_embedding_v2` và `kb_variant_embedding_v1`; repository không tự tạo external indexes.
- Guardrail release `b81fb159a829059fd04176325416d5ee53561236` đã qua CI và được deploy
  đồng nhất lên Netlify/Render staging trước re-embed và acceptance hậu cutover.
- Staging re-embed đã hoàn tất với reviewed digest và encrypted snapshot; rollback
  preflight read-only PASS nhưng rollback thật không chạy.
- Backup gate hiện dùng `production-logical-backup-20260914T072629Z` và PASS cả
  release readiness lẫn isolated disaster-recovery verification.
- Corpus staging ban đầu chỉ có seed fixture `draft`, chưa review/evidence; dù
  vector `ready`, entry không eligible. Synthetic WHO fixture eligible được tạo
  theo scope user duyệt để smoke, rồi xóa qua admin UI; bảng hiện về seed ban đầu.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx -y node@22.23.1 server/node_modules/vitest/vitest.mjs run server/src/services/ai/__tests__/embedding.service.test.js server/src/scripts/__tests__/stagingKnowledgeBaseReembed.test.js` | exit 0 |
| Server unit | `npx -y node@22.23.1 scripts/run-server-test-batches.mjs` | exit 0 |
| AI tool gate | `npx -y node@22.23.1 .agents/scripts/validate-tools.mjs` | exit 0 |
| Security | `npm run security:secrets` and `npm run security:data-boundaries` | each exits 0 |
| Agent docs | `npm run agents:validate` | exit 0 |
| Preflight | `npm run preflight:kb-reembed:staging --prefix server` | JSON mode `preflight`, zero writes, plan digest present |
| Apply | `npm run migrate:kb-reembed:staging --prefix server -- --plan-digest=<reviewed-digest>` | exact staging target, verified snapshot and post-state |
| Rollback preflight | `npm run preflight:rollback-kb-reembed:staging --prefix server -- --snapshot=<absolute-encrypted-snapshot-file>` | JSON mode `preflight`, zero writes; snapshot file phải nằm ngoài repo |
| Live AI acceptance | `npm run acceptance:staging:ai --prefix server` | exact deployed SHA; positive KB/provider lane và deterministic UI/failure lanes PASS; cleanup `residue=0` |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Explicit embedding-profile seam and regression tests.
- Staging-only Knowledge Base re-embed preflight/apply/rollback with exact target guards.
- Root and variant vector snapshot, source-hash CAS, plan digest and post-verification.
- Package scripts, runbook, plan state and traceability.
- PR to `staging`, exact-SHA CI/deploy verification, live staging retrieval smoke.
- Request-scoped, signed staging-only AC-009 capability và isolated live browser runner; public conversation DTO,
  auth/CSRF/quota và provider credentials giữ nguyên.
- Fresh production backup that performs production reads only, as required by release gate.
- Creation/verification of the two staging Atlas Vector Search indexes and Render staging env cutover.

**Out of scope**:

- Any production database write, re-embed, Atlas index or runtime env cutover.
- Changing model, commercial quota, auth, CSRF or Knowledge Base content/evidence.
- Relabeling legacy vectors without calling the embedding provider.

## Steps

### Step 1: Add an explicit embedding profile seam

Pass `options.profileId` through `generateEmbedding()` to `prepareEmbeddingInput()` while preserving
the runtime default. Add a regression test proving the provider request and cache key use the requested
question-answering profile.

**Behavior**: migration can generate new vectors for the target profile before runtime env is switched.

**Verify**: focused `embedding.service.test.js` exits 0.

### Step 2: Build a staging-only reversible re-embed workflow

Create a deployable script split into contract/planning/Mongo/verification seams. Preflight connects
read-only, requires exact `htcoaching_staging`, inventories root/variant vectors and returns a deterministic
digest. Apply additionally requires dedicated CLI and env confirmations plus that reviewed digest. Before
updates, write an encrypted or access-restricted local snapshot outside Git containing the prior vector state;
each update uses source hash/version CAS. Rollback requires the exact snapshot ID/digest and rejects any
content/version drift. Post-state verifies counts, 768 dimensions and exact target version.

Apply phải fail trước DB connection nếu secret-free production backup readiness
không `disasterRecoveryReady`; rollback không phụ thuộc backup mới để tránh chặn
khả năng cứu dữ liệu staging. Admin KB writes cần tạm dừng trong maintenance window;
post-commit full-corpus check có thể phát hiện concurrent insert nhưng không biến
transaction snapshot thành collection-wide lock.

**Behavior**: zero-write preflight is the default; apply is idempotent and rollback is independently verifiable.

**Verify**: focused script tests cover target rejection, no-write preflight, digest mismatch, CAS drift,
provider failure, idempotency, post-verification and rollback.

### Step 3: Document and review the operational contract

Add package scripts and a runbook containing exact env names, artifact custody, STOP conditions and cutover order.
Update Plan 090/090a state without claiming database or live verification that has not run.

**Behavior**: another operator can execute or rollback using repository instructions without chat history.

**Verify**: `npm run agents:validate`, secret scan and `git diff --check` exit 0.

### Step 4: Land the guardrail code on staging

Run focused/full proportional QA and code review, commit/push the branch, open a PR targeting `staging`,
wait for required checks, merge, then verify Netlify and Render deploy the exact merge SHA.

**Behavior**: only reviewed code shipped on staging may touch staging data.

**Verify**: GitHub CI success and both staging deploy identities equal the merge SHA.

### Step 5: Refresh recovery evidence without writing production

Create a fresh encrypted logical production backup, upload only the encrypted archive to the canonical Drive,
retrieve the key from Bitwarden, download and restore-test in an isolated local MongoDB, compare fingerprints,
clean transient plaintext/residue, then update secret-free backup readiness evidence through a reviewed PR.

**Behavior**: release gate sees a verified backup younger than 24 hours; production receives zero writes.

**Verify**: `npm run verify:backup-release` exits 0 and private cleanup reports zero residue.

### Step 6: Re-embed and cut over only staging

Run preflight, review its digest, apply on `htcoaching_staging`, verify post-state, create/wait for the root and
variant Atlas indexes, then set Render staging `KB_EMBEDDING_PROFILE`, `KB_VECTOR_INDEX` and
`KB_VARIANT_VECTOR_INDEX`. If nested index compatibility fails, keep variant index unset and use bounded fallback;
if root retrieval fails, unset both index vars and roll back profile/vectors.

**Behavior**: staging retrieval uses the new profile and Atlas where proven, with bounded fallback preserved.

**Verify**: runtime identity, root/variant retrieval, fallback counters and authenticated live smoke pass.

### Step 7: Rerun staging acceptance and close Plan 090

Rerun the 9 acceptance flows after the final merge/deploy SHA, confirm cleanup residue is zero, complete authenticated
HT Assistant tests (citations, Retry/Edit, A→B streaming and provider failure), and update Plan 090 evidence.

AC-009 chạy trong lane riêng sau deploy-identity gate. Positive lane phải dùng frontend/backend staging, Gemini và
Knowledge Base thật; runner tạo fixture source-backed/reviewed theo run marker rồi đọc projection tối thiểu trực tiếp
từ Mongo để chứng minh đúng assistant message có `evidenceMode=internal_kb`, exact fixture ID và
`webSearchUsed=false`. Public DTO không được mở rộng chỉ để test.

Các lane A→B, Stop và provider-boundary failure dùng capability HS256 domain-separated từ staging JWT secret,
TTL ngắn, bind exact SHA/run/actor/request/conversation/payload digest và one-time claim trong collection control
ephemeral. Capability chỉ được chấp nhận khi `APP_ENV=staging`, database là `htcoaching_staging`, origin đúng,
runtime flag bật và actor synthetic đã đăng nhập; request thường không đổi byte/behavior. Failure được ghi đúng là
injected tại provider boundary, không tuyên bố Gemini thật trả lỗi và không đổi `GEMINI_API_KEY`/`AI_PROVIDER`.
Barrier nằm sau SSE text frame đầu, abort-aware và timeout hữu hạn để Stop/A→B không phụ thuộc timing.

Runner phải snapshot metrics trước/sau. Bảy chat attempts và hai admin KB searches
tạo metrics dùng capability riêng; runner preregister JTI `issued`, backend CAS
`issued → admitted` rồi ghi `settled` sau business finalization
với boot UUID/exact SHA lấy từ chính runtime; receipt inventory phải song ánh với
request inventory và cùng identity với cả hai structured snapshots. Raw/candidate
validator tự recompute delta từ timestamp, SHA, runtime fingerprint và counter allowlist,
đồng thời bắt buộc failure receipt của từng Retry/Edit lane settle trước recovery admission.
Mode observe không đổi
provider/retrieval/quota; receipt không mở public DTO/header/SSE. Cleanup chạy trong
`finally`, chỉ xóa exact registered control/KB/conversation/branch/user/quota IDs và
PASS duy nhất khi verifier trả `residue=0`; artifact không chứa token, raw
prompt/output, cookie hoặc Mongo URI.

Request-cohort proof chỉ chứng minh counters của AC-009 được tạo và settled trên một
runtime; không được đổi tên thành single-instance topology hay giả lập Render census.
Direct provider inventory `null` tiếp tục inconclusive. Capability/receipt và raw
evidence bump v2, release candidate bump v3; artifact cũ không đủ điều kiện theo
contract mới.

**Behavior**: all nine release steps have evidence on one final staging SHA.

**Verify**: acceptance workflow and live smoke report PASS; otherwise keep NO-GO with the exact blocker.

## Test Plan

- Unit: explicit profile formats request and partitions cache.
- Contract: only `--target=staging`; apply/rollback each require separate confirmation and reviewed digest.
- Planning: stable ordering/digest, eligible root/variant inventory, idempotent no-op.
- Data safety: source hash/version CAS, snapshot completeness, provider partial failure leaves source recoverable.
- Verification: exact document/variant counts, dimension 768, target version and rollback fingerprint.
- Live: authenticated citation rendering, retry/edit navigation isolation, streaming switch and provider failure.
- Staging capability: non-staging/wrong origin/wrong SHA/actor/body/algorithm/expiry/replay đều fail trước provider và
  quota; normal request không capability giữ nguyên behavior.
- Live cleanup: execute fail/abort/timeout vẫn dọn exact IDs và residue khác 0 luôn làm workflow FAIL.
- Hard-kill recovery: revoke + quiescence + re-inventory bắt late KB/JTI writes;
  `admitted` không terminal giữ tombstone/fixture và chặn rerun.
- KB fixture mutation: journal durable `pending` trước POST, bind run/SHA/admin/question
  và chỉ `settled` sau validated `201`; missing/pending/malformed proof là manual blocker.
- Evidence tamper: raw/candidate validator từ chối chronology đảo ngược giữa
  provider failure settlement và Retry/Edit recovery admission.

## Staging Execution Evidence — 2026-09-14

| Gate | Evidence | Result / limitation |
|---|---|---|
| Exact release identity | SHA `b81fb159a829059fd04176325416d5ee53561236`; canonical CI run [34830572458](https://github.com/ThienAress/htcoachingweb/actions/runs/34830572458); Netlify deploy `6aa7c5449e21464e943801c0`; Render deploy `dep-dajsusbm8hqs739juqdg` | PASS: CI, client và server cùng exact SHA. |
| Recovery gate | Backup `production-logical-backup-20260914T072629Z`; release candidate artifact của run [34843937729](https://github.com/ThienAress/htcoachingweb/actions/runs/34843937729) | PASS: `releaseReady=true`, `disasterRecoveryReady=true`; production không nhận write. Continuous recovery vẫn không khả dụng và không được suy thành PITR. |
| Staging re-embed | Plan digest `c5bcbad239871a6e89522359d8c35248645d29d3e32ae0614f9599b68b02c597`; encrypted snapshot `kb-reembed-staging-20260914T115622Z-c5bcbad2`; post-verification trước cutover | PASS trên exact `htcoaching_staging`; không commit key, URI hoặc raw vector. Rollback preflight read-only PASS `1/1`; rollback thật không chạy. |
| Final staging acceptance | Run [34843937729](https://github.com/ThienAress/htcoachingweb/actions/runs/34843937729), `2026-09-14T12:32:27.388Z` → `2026-09-14T12:33:16.366Z` | PASS 9/9 flows; exact deploy identity PASS; cleanup `verified=true`, `residue=0`; backup và disaster-recovery gates PASS. |
| Public health | `ALLOW_REMOTE_STAGING_HEALTH=true` với Node `22.23.1`, checked `2026-09-14T13:16:27.911Z` | PASS 7/7: client, manifest, live, ready và ba public API đều HTTP 200. |
| Deterministic authenticated-chat regressions | `npx -y node@22.23.1 node_modules/@playwright/test/cli.js test e2e/ai-chat.spec.js --project=chromium` | PASS 7/7: incremental/coalesced SSE, A→B isolation + citation, Stop không nhận late suffix, provider failure → Retry/Edit + citation, confirmation flow. Đây là loopback mock, không phải provider-failure injection trên staging. |
| Current-diff QA/review | Node `22.23.1`: focused re-embed/embedding cuối 46/46, stream hook 20/20, full AI-chat spec 7/7, Stop stress 3/3; full client 816/816; full server 258 files/2.581 tests; staging-configured client release build; static gates và independent review | PASS: release build prerender 54/54, bundle/search-index gates PASS; review `PASS WITH WARNINGS`, không còn BLOCK/HIGH/MED/LOW finding. Mock vẫn không thay live provider/proxy/fallback evidence. |
| Initial live diagnostic | Admin Search Test với exact seed question ở production parity `top=3, threshold=0.75`, rồi explore `top=5, threshold=0.60`; authenticated HT Assistant | Seed `draft`, `vector: ready` nhưng chưa review/evidence cho `0` hit ở cả hai search mode; exact seed question route `general/model_prior`, Chat không render KB citation. Không phải bằng chứng Atlas/vector regression. |
| Eligible-fixture live smoke | Synthetic WHO source-backed staging entry `training`, `published`, `vector: ready`; Admin Search Test `threshold=0.75`; authenticated HT Assistant | Search Test có một hit `98,7%`. Chat lần đầu lỗi generic, Retry thành công với claim ≥150 phút/tuần và citation `https://www.who.int/news-room/fact-sheets/detail/physical-activity`. Search Test chứng minh retrieval eligible; WHO URL trong Chat chưa tự chứng minh provenance từ KB thay vì grounding khác. Quota quan sát cuối `1197/1200`. |
| Manual smoke cleanup | User xác nhận xóa; staging admin KB và conversation UI, rồi exact WHO Search Test | Hai conversation và WHO fixture đã xóa qua UI; sidebar không còn conversation, KB table `2 → 1` còn seed `draft`, exact WHO query trả `0` ở cả `0.75`/`0.60`, conversation admin filter “Tất cả” không thấy mục phù hợp. UI-observed, không phải DB-level residue counter; tách biệt acceptance cleanup `residue=0` ở trên. |

### Post-smoke local hardening — chưa deploy

Review rollback phát hiện snapshot prior state hợp lệ ở target version nhưng
`failed`/`pending` từng qua apply rồi không rollback được. Diff local giờ dùng
chung validator cho preflight và transaction: phục hồi đúng trạng thái prior
không-ready nhưng vẫn chặn vector `ready` hỏng, drift/CAS và forward target
không-ready. Regression RED tái hiện lỗi; GREEN Node `22.23.1` focused 52/52
(migration state/Mongo + embedding/metrics). Telemetry mới tách counter fallback
`root`, `variant`, `combined` và giữ counter tổng cũ; nhánh không index là
combined scan, không bị gán nhầm root. AI eval 49/49, tool validator 11/11,
Chat loopback E2E 7/7, client release build/prerender 54/54, security/agent
gates PASS. Review độc lập `PASS WITH WARNINGS` đã nêu thiếu round-trip encrypted
snapshot → rollback và đồng thời root+variant fallback trong cùng một search.
Hai khoảng trống test local này đã có regression bổ sung: snapshot mã hóa →
giải mã → apply/rollback trên Mongo cô lập cho prior `failed`/`pending`, root+variant
fallback cùng một search và Atlas healthy zero fallback. Focused Node `22.23.1`
hai file 46/46 PASS. Full server suite trên diff cuối PASS 9/9 batches,
258 files/2.581 tests; không dùng kết quả local như deployed-SHA hoặc rollback
drill trên staging.

Full client suite Node `22.23.1` lần đầu 815/816 do một source assertion phụ thuộc
LF trong Windows CRLF checkout; sửa helper test normalize newline (không đổi UI)
và rerun 170/170 files, 816/816 tests PASS.

Worktree vẫn ở `b81fb159a829059fd04176325416d5ee53561236`; fix và metrics
chưa commit/deploy. Máy local không có staging-only DB credential, key hoặc
absolute encrypted snapshot file để chạy drill. GitHub environment
`staging-live-acceptance` có staging DB credential nhưng không có snapshot key;
không chuyển secret qua repo/log. Không chạy rollback thật trên binary cũ.

Seed script cố ý tạo fixture `draft` không có evidence; re-embed chỉ thay vector
state. Runtime yêu cầu `published + ready + exact version + reviewed` và approved
evidence trước threshold. WHO fixture dùng nguồn thật và đã được dọn sau smoke,
không đổi nội dung production hoặc suy citation Chat chắc chắn đi từ KB.

**NO-GO để đóng Plan 090a**: AC-009 còn thiếu live Retry/Edit đầy đủ, A→B
streaming, Stop, provider-failure behavior và root/variant fallback metrics;
provenance KB của citation Chat chưa có trace quyết định. Retry sau generic failure
đã được quan sát, nhưng không thay thế provider-failure injection. Các behavior
còn lại có deterministic loopback E2E evidence, không phải live provider/proxy.

## AC-009 topology investigation and hardening — 2026-09-15

**Target**: staging only. Production env, data, deploy và rollback ngoài scope.

| Boundary | Evidence | Result |
|---|---|---|
| Final runner release | PR [#119](https://github.com/ThienAress/htcoachingweb/pull/119), merge SHA `5fb8bfba7596e20f22737654ef26fc98e92330e8`; canonical CI [34924645034](https://github.com/ThienAress/htcoachingweb/actions/runs/34924645034) | PASS client/server/E2E/docker/secrets. |
| Staging deploy identity | Netlify `6aa8b9a385e4d10008d6e058`; Render `dep-dakbluuk1f9s73cnr8bg` | Both live/ready at exact merge SHA; Render staging acceptance flag enabled, auto-deploy remains disabled. |
| Live acceptance | Run [34925142825](https://github.com/ThienAress/htcoachingweb/actions/runs/34925142825), attempts 1 and 2 | FAIL at topology verification before acceptance, AI runner or cleanup; no synthetic writes from these attempts. |
| Sanitized inventory probe | Runs [34926118247](https://github.com/ThienAress/htcoachingweb/actions/runs/34926118247), [34926269008](https://github.com/ThienAress/htcoachingweb/actions/runs/34926269008), [34926506701](https://github.com/ThienAress/htcoachingweb/actions/runs/34926506701) | `/instances`: HTTP 200, JSON content type, parsed `null` repeatedly. Probe exits before checkout/acceptance and never logs token, instance IDs or raw payload. |
| Alternative metric sources | Last probe above | `/metrics/instance-count`: empty array for both `resource` and deprecated `service`; CPU has two historical instance series with latest sample age 450 seconds, not an authoritative current census. |
| Wake discriminator | Known staging health GET returned HTTP 200 after spin-up; immediate probe [34926875617](https://github.com/ThienAress/htcoachingweb/actions/runs/34926875617) | `/instances` remains JSON `null`; spin-down-only hypothesis rejected. |

Hypotheses and closing evidence:

- Envelope mismatch rejected: observed payload is `null`, not an object envelope.
- Deploy warm-up/transient weakened by repeated stable-deploy probes with identical result.
- Spin-down-only rejected by healthy wake followed immediately by the same `null` response.
- Provider inventory unavailability supported; exact upstream reason remains unproven.
- CPU/Free-plan fallback rejected: historical samples or a scaling limit do not prove absence of a
  second serving runtime during restart/transition. Existing before/after runtime UUID cannot bind
  every chat request in between.

**Hardening slice plan**, owned by root:

1. Add RED regression tests through exported `verifyRenderSingleInstanceTopology()` for malformed
   records and JSON parse canaries in `scripts/deployment-identity.test.mjs`.
2. In `scripts/lib/deployment-identity.mjs`, validate required `id` and `createdAt` on every inventory
   record; `null` stays inconclusive. Wrap JSON parse failures with static provider labels, never raw
   upstream exception text. No fallback count or artifact-schema change.
3. Run `node --test scripts/deployment-identity.test.mjs`, `npm run test:ops`, secret/boundary gates
   and `git diff --check`; review independently. Remove the temporary workflow probe before delivery.

**Done for this slice**: focused/ops regression GREEN, temporary probe absent, no topology certificate
 for `null` or malformed records. **Not done for Plan 090A at that checkpoint**:
 choose and implement a replacement proof, then final AC-008/009; real vector
 rollback also requires the original encrypted snapshot and separate key custody.
 The request-cohort replacement is approved in the amendment below; it does not
 retroactively make the failed topology runs conclusive.

### AC-009 request-cohort contract amendment — 2026-09-15

User yêu cầu tiếp tục làm tới xong. Ba workstream architecture/impact/security đã
review và thống nhất dùng server-written admission/settlement receipts thay vì lộ
runtime identity qua response header. Contract mới bind đúng 7 chat attempts và 2
admin Knowledge Base searches vào cùng boot UUID/exact SHA với metrics snapshots;
mọi request thiếu/thừa, restart, cross-runtime, non-terminal receipt hoặc replay đều
fail closed. Một synthetic admin run-scoped giữ authorization route hiện có; capability
không cấp quyền admin và run phải được revoke trước exact cleanup để token chưa hết
hạn không thể replay sau khi tombstone bị xóa.

Implementation phải TDD theo các vertical slice: ordinary request parity và strict
capability v2; immutable `issued → admitted → settled` receipt lifecycle cho
success/failure/abort;
9-request runner inventory + metric correspondence; evidence v2/candidate v3 tamper
validation; workflow bỏ AC-009 dependency vào unavailable topology artifact nhưng
vẫn verify deploy identity trước/sau. Sau local QA/security review, deploy exact SHA
lên staging rồi chạy fresh AC-008/009; không reuse acceptance evidence từ binary cũ.

### AC-009 fixture rejection incident — 2026-09-15

- Staging Live Acceptance [34961418907](https://github.com/ThienAress/htcoachingweb/actions/runs/34961418907)
  chạy trên exact deploy SHA `aa2d031d4420ba96d3e34e6fa87fba23e246755a`: deploy identity và AC-008 `9/9`
  PASS, nhưng AC-009 fail trước capability cohort. Render application log ghi exact
  `POST /api/knowledge-base/` status `400` tại `2026-09-15T11:07:19.008Z`.
- Reproduction qua parser/privacy/publication thật chứng minh payload hợp lệ về schema/publication,
  nhưng answer mở đầu `Theo WHO, ...` bị privacy guard phân loại `ambiguous_person_identity`.
  Controller trả rejection trước `createKnowledgeRecord`; runner v1 vẫn giữ journal `pending`
  theo fail-closed contract nên cleanup report là unknown.
- Remediation TDD: đổi fixture wording nhưng giữ WHO citation/source; journal v2 bind request-ID và
  canonical payload digest, chỉ terminal hóa exact pre-write privacy rejection; thêm manual staging-only
  recovery workflow verify exact failed-run artifact và Render application log qua provider API.
  Production không bị ghi; journal v1 không bị giả thành `settled`.
- Local focused evidence sau recovery hardening: AC-009 script/recovery/receipt/provider-evidence tests `95/95` PASS;
  workflow contract `5/5` PASS. Vẫn **NO-GO** cho tới khi patch merge/deploy, legacy recovery report
  `verified=true, residue=0` và fresh AC-009 live evidence PASS trên SHA mới.

### AC-009 recovery review correction — 2026-09-15

**Complexity**: COMPLEX; root owns provider proof/docs/integration, report-retry worker owns
recovery CLI/workflow/tests. Five user-owned sitemap/generated files remain excluded.

1. **Retain current unknown mutations**: restrict operator fallback to exact journal v1.
   RED: both v2 pending cases (matching and unrelated request ID) incorrectly returned verified cleanup.
   GREEN: recovery suite `15/15` PASS before report-retry changes; both cases retain actor/journal/tombstone.
   Verify final: `npx vitest run src/scripts/__tests__/stagingAiChatAcceptance.recover.test.js` in `server/`.
2. **Bind the audited provider evidence**: restrict the compatibility escape hatch to the incident tuple
   above plus service `srv-d9g8em61a83c73b4l61g`, deploy `dep-dakiao1594qs73e61jkg` and observed timestamp
   `2026-09-15T11:07:19.008Z`. GET exact deploy ID/SHA/finishedAt; reject all malformed/duplicate or
   conflicting records rather than filter them. Provider regressions RED → GREEN `21/21` PASS.
   This remains operator attestation: API detail does not prove full historical serving interval.
   Verify: `npx vitest run src/scripts/__tests__/stagingAiChatAcceptance.rejectionEvidence.test.js`.
   Shared cleanup also rejects a v2 `terminal/rejected` proof when the exact Knowledge Entry exists
   before cleanup or appears during receipt quiescence; RED `2/2` → cleanup suite GREEN `7/7`, preserving
   the actor, contradictory entry, journal and run tombstone rather than deleting evidence.
3. **Make successful recovery retry usable**: add optional prior recovery run/attempt inputs,
   verify trusted staging workflow provenance, download immutable prior report to a separate input,
   validate before connect/revoke and retain v2 operator-proof digest. Prepare output directory before
   mutation, upload artifacts named with run ID and attempt. Keep the post-journal/pre-report crash gap
   as a manual blocker, never manufacture a report from an apparently empty inventory.
   Verify: recovery tests plus `node --test scripts/release-workflows.test.mjs`.
4. **Final gates**: one Node 22 QA pass, secret/boundary/dependency/agent gates, independent security
   and general re-review; then obtain explicit Git/release authority if it is not available in current
   task context. No live acceptance until exact legacy recovery artifact proves `verified=true, residue=0`.
   Production remains read-only, and real vector rollback is still a separate incomplete done criterion.

### AC-009 live retry and upstream blocker — 2026-09-15

- PR #124 merged as `ada5610b2518ae6dc6dad8a90c7759a93db0169d`. CI
  [34992043457](https://github.com/ThienAress/htcoachingweb/actions/runs/34992043457) PASS `5/5`;
  Netlify staging deploy `6aa96dcd263dfdb20343d08f` was `ready` and Render staging deploy
  `dep-dakmpvh42hec73b4hu80` was `live`, both on the exact release SHA.
- Live acceptance runs
  [34993500580](https://github.com/ThienAress/htcoachingweb/actions/runs/34993500580),
  [34994461651](https://github.com/ThienAress/htcoachingweb/actions/runs/34994461651) and
  [34995417387](https://github.com/ThienAress/htcoachingweb/actions/runs/34995417387) each passed
  AC-008 `9/9` with cleanup `verified=true, residue=0`. AC-009 created a reviewed/published/embedding-ready
  fixture but recorded no completed lane and failed closed with `STAGING_ACCEPTANCE_CLEANUP_FAILED` while
  the browser mutation outcome was unknown.
- Render application logs bind the latter two attempts to exact `GEMINI_HTTP_ERROR` responses:
  HTTP `503`, provider status `UNAVAILABLE`, at `2026-09-15T16:23:31.648Z` and
  `2026-09-15T16:32:19.556Z`. This is an upstream availability blocker, not an injected AC-009 failure lane.
- Recovery bridge runs
  [34994072308](https://github.com/ThienAress/htcoachingweb/actions/runs/34994072308),
  [34994974894](https://github.com/ThienAress/htcoachingweb/actions/runs/34994974894) and
  [34995932013](https://github.com/ThienAress/htcoachingweb/actions/runs/34995932013) each produced a closed
  journal-v2 report for its exact incident with `alreadyClean=true`, `verified=true`, `residue=0` and
  `fixtureRejectionProof=null`; no ad-hoc deletion or production write was used.
- **Decision**: `NO-GO/BLOCKED`. Stop condition “the same gate fails three times” is met. Do not rerun again
  until Gemini availability has recovered; then run one fresh AC-008/AC-009 acceptance on unchanged exact
  deploy identities or repeat the full identity gate if either deploy changes. Real vector rollback remains
  an independent incomplete done criterion.

### AC-009 provider recovery and deterministic citation fix — 2026-09-16

- Live acceptance
  [34998972302](https://github.com/ThienAress/htcoachingweb/actions/runs/34998972302) giữ exact
  deploy identity trên SHA `ada5610b2518ae6dc6dad8a90c7759a93db0169d` và AC-008 PASS `9/9` với
  cleanup `verified=true, residue=0`. AC-009 vẫn chưa ghi lane đầu tiên; run fail closed với
  `STAGING_ACCEPTANCE_CLEANUP_FAILED` và `outcomeUnknown=true`.
- Exact incident recovery
  [34999668236](https://github.com/ThienAress/htcoachingweb/actions/runs/34999668236) PASS với
  `alreadyClean=true`, `verified=true`, `residue=0`; không có production write.
- Render log sau đó ghi một request `/api/ai/chat` mới HTTP `200` trong khoảng `10.2s`;
  `chat_end` có `durationMs=8561`, `kbHits=1`, và không có `502`, `503`, `GEMINI_HTTP_ERROR`
  hoặc `chat_error` mới. Hai log `503 UNAVAILABLE` còn thấy chỉ thuộc các attempt cũ lúc
  `2026-09-15T16:23:31.648Z` và `2026-09-15T16:32:19.556Z`.
- Root cause evidence: browser runner chờ exact `a[href=sourceUrl]` tối đa 90 giây trong
  `stagingAiChatAcceptance.browser.js`, trong khi `ai.controller.js` trước đây chỉ append
  citation deterministically cho web grounding; response từ internal KB phụ thuộc provider tự chèn link.
  Backend success rồi runner timeout khớp failure chronology này.
- Local fix trên base HEAD `0cadfc8fba48e7c88cdb472bd7689e108800ca9a`: lấy tối đa ba nguồn từ chính
  KB results đã `published`, còn hạn review, `source_backed`, qua privacy/HTTPS guard, rồi append
  tại assistant output boundary nếu provider bỏ sót. SSE và persisted conversation dùng cùng canonical output.
- Local evidence: focused prompt/output `30/30` PASS; focused controller regression `1/1` PASS;
  full server suite trên Node `22.23.1` PASS `266 files / 2752 tests`; client compile-only PASS;
  tool registry `11/11`, secret scan và repository data-boundary scan PASS. Release build bị chặn ở
  prebuild do các dynamic sitemap sources đồng loạt `ECONNABORTED`; Vite compile không có lỗi.
- **Decision**: giữ `NO-GO/BLOCKED`. Không chạy lại acceptance trên SHA cũ. Cần review/commit/deploy
  fix thành exact SHA mới, xác minh cả Netlify và Render cùng SHA, rồi dispatch đúng một fresh acceptance.
  Real vector rollback vẫn là done criterion độc lập chưa hoàn tất.

## Done Criteria

- [x] Preflight defaults to zero writes and rejects every non-staging target.
- [x] Apply requires exact target, explicit confirmation, reviewed plan digest and a complete snapshot.
- [ ] Rollback restores the exact prior root/variant vector state and verifies its fingerprint; isolated tests and live read-only preflight PASS, but the real rollback was intentionally not invoked.
- [x] Focused/server/AI/security/agent gates pass for the deployed guardrail SHA.
- [x] Guardrail PR merges to `staging`; CI, Netlify and Render match one exact SHA.
- [x] Fresh backup gate passes with zero production writes.
- [ ] Re-embed, indexes, env cutover and live smoke pass only on `htcoaching_staging`.
- [ ] Signed AC-009 runner chứng minh positive real-KB provenance/citation, Retry/Edit, A→B, Stop,
  injected provider-boundary failure, root/variant metrics và cleanup `residue=0` trên cùng exact SHA.
- [x] Every failed acceptance incident has exact cleanup/recovery evidence with `residue=0`; Plan 090 state matches evidence.

## STOP Conditions

- Connected database is not exactly `htcoaching_staging`.
- Preflight/apply digest differs, or an entry source hash/version changes before its write.
- Snapshot is incomplete, cannot be decrypted/read back, or rollback verification cannot be proven.
- Fresh production backup cannot be independently recovered from canonical Drive/Bitwarden.
- Atlas index definition/status differs from the reviewed contract.
- Provider cost/error budget, authentication or staging test account is unavailable.
- Capability có thể chạy ngoài exact staging target, không bind actor/request/SHA, bị replay, hoặc cần nới
  auth/CSRF/quota/provider credential.
- Metrics bị reset/load-balanced mà không thể gắn delta với instance, stream không terminal, hoặc cleanup không
  chứng minh exact `residue=0`.
- Any step would write production or expose secret, health data, conversation content or raw vectors in Git/logs.
- The same gate fails three times after evidence-based fixes.

## Maintenance Notes

- Profile rollout order is data first, index readiness second, runtime env last.
- Unset both Atlas index variables to return to bounded fallback; do not delete indexes during an incident.
- Production rollout needs a new explicit approval and its own plan; staging success is not production approval.
