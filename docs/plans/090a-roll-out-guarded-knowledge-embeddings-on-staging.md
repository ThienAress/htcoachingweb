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
- **Lifecycle**: IN PROGRESS
- **Verification**: FOCUSED
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-14

Local evidence trước PR: Node 22 focused six files 47/47 PASS, gồm MongoMemory
replica-set apply→rollback; full server suite trước patch review cuối 257 files /
2.561 tests PASS, nên không được tái sử dụng như full evidence cho diff mới.
AI tool validator 11/11, client compile-only, secret/data-boundary/docs-privacy
và agent validation PASS. Backup audit đo 73,4 giờ > policy 24 giờ:
`BACKUP_STALE`; không có staging DB write/provider call.

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
- Render staging tại preflight chưa có `KB_EMBEDDING_PROFILE`, `KB_VECTOR_INDEX` hoặc
  `KB_VARIANT_VECTOR_INDEX`, nên runtime đang dùng legacy profile và bounded fallback.
- Backup gate gần nhất trỏ tới `production-logical-backup-20260911T054030Z`, đã quá giới hạn 24 giờ.

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
| Rollback preflight | `npm run preflight:rollback-kb-reembed:staging --prefix server -- --snapshot=<id>` | JSON mode `preflight`, zero writes |
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

## Done Criteria

- [ ] Preflight defaults to zero writes and rejects every non-staging target.
- [ ] Apply requires exact target, explicit confirmation, reviewed plan digest and a complete snapshot.
- [ ] Rollback restores the exact prior root/variant vector state and verifies its fingerprint.
- [ ] Focused/server/AI/security/agent gates pass.
- [ ] Guardrail PR merges to `staging`; CI, Netlify and Render match one exact SHA.
- [ ] Fresh backup gate passes with zero production writes.
- [ ] Re-embed, indexes, env cutover and live smoke pass only on `htcoaching_staging`.
- [ ] Final acceptance cleanup has `residue=0`; Plan 090 state matches evidence.

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
