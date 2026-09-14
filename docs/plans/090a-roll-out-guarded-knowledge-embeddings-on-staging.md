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
Plan chưa hoàn tất: synthetic Knowledge Entry eligible đã chứng minh Search Test
và Chat đã hiển thị WHO citation, nhưng provenance KB và toàn bộ AC-009 live smoke
chưa được chứng minh; fixture đã được dọn qua staging UI.

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
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Explicit embedding-profile seam and regression tests.
- Staging-only Knowledge Base re-embed preflight/apply/rollback with exact target guards.
- Root and variant vector snapshot, source-hash CAS, plan digest and post-verification.
- Package scripts, runbook, plan state and traceability.
- PR to `staging`, exact-SHA CI/deploy verification, live staging retrieval smoke.
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

**Behavior**: all nine release steps have evidence on one final staging SHA.

**Verify**: acceptance workflow and live smoke report PASS; otherwise keep NO-GO with the exact blocker.

## Test Plan

- Unit: explicit profile formats request and partitions cache.
- Contract: only `--target=staging`; apply/rollback each require separate confirmation and reviewed digest.
- Planning: stable ordering/digest, eligible root/variant inventory, idempotent no-op.
- Data safety: source hash/version CAS, snapshot completeness, provider partial failure leaves source recoverable.
- Verification: exact document/variant counts, dimension 768, target version and rollback fingerprint.
- Live: authenticated citation rendering, retry/edit navigation isolation, streaming switch and provider failure.

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

## Done Criteria

- [x] Preflight defaults to zero writes and rejects every non-staging target.
- [x] Apply requires exact target, explicit confirmation, reviewed plan digest and a complete snapshot.
- [ ] Rollback restores the exact prior root/variant vector state and verifies its fingerprint; isolated tests and live read-only preflight PASS, but the real rollback was intentionally not invoked.
- [x] Focused/server/AI/security/agent gates pass for the deployed guardrail SHA.
- [x] Guardrail PR merges to `staging`; CI, Netlify and Render match one exact SHA.
- [x] Fresh backup gate passes with zero production writes.
- [ ] Re-embed, indexes, env cutover and live smoke pass only on `htcoaching_staging`.
- [x] Final acceptance cleanup has `residue=0`; Plan 090 state matches evidence.

## STOP Conditions

- Connected database is not exactly `htcoaching_staging`.
- Preflight/apply digest differs, or an entry source hash/version changes before its write.
- Snapshot is incomplete, cannot be decrypted/read back, or rollback verification cannot be proven.
- Fresh production backup cannot be independently recovered from canonical Drive/Bitwarden.
- Atlas index definition/status differs from the reviewed contract.
- Provider cost/error budget, authentication or staging test account is unavailable.
- Any step would write production or expose secret, health data, conversation content or raw vectors in Git/logs.
- The same gate fails three times after evidence-based fixes.

## Maintenance Notes

- Profile rollout order is data first, index readiness second, runtime env last.
- Unset both Atlas index variables to return to bounded fallback; do not delete indexes during an incident.
- Production rollout needs a new explicit approval and its own plan; staging success is not production approval.
