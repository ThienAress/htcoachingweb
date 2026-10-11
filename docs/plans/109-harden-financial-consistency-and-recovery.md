# Plan 109: Harden financial consistency and recovery

> **Hướng dẫn thực thi**: Làm từng behavior slice theo RED → GREEN → review.
> Chạy đúng verification trước khi sang step kế tiếp. Gặp STOP condition thì
> dừng, không tự sửa dữ liệu hoặc mở rộng sang production.
>
> **Drift check chạy đầu tiên**: `git status --short`, `git diff --check` và
> `git diff --name-only b102572c626b1b79c290a786c96a51ebfc28c242 -- <in-scope paths>`.
> Các thay đổi route-transition hiện có thuộc user và phải được giữ nguyên.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: XL (nhiều behavior slice)
- **Risk**: HIGH
- **Depends on**: 023, 081, 085
- **Category**: bug | security | recovery | migration | tests
- **Planned at**: 2026-09-18
- **Lifecycle**: DONE — LOCAL IMPLEMENTATION COMPLETE
- **Verification**: LOCAL FULL — QA PASS 2026-10-02; NOT DEPLOYED
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-10-02

## Why This Matters

Audit đã tái hiện race SePay và Contract trên MongoDB replica set, đồng thời xác
nhận signing/GridFS cùng wallet reconciliation còn failure window. Các lỗi có xác
suất thấp nhưng tác động tài chính/pháp lý cao. Plan đóng invariant bằng database
CAS/transaction và recovery evidence, không dựa vào timing hoặc mutex process.

## Approved Decisions

- Spec canonical: `docs/specs/acid-financial-integrity-hardening.md`.
- SePay mơ hồ giữ hai incoming records và chuyển loser sang manual review.
- Contract finalize chưa commit thì khách ký lại; không auto-finalize thay khách.
- Giữ Atlas Free + verified logical backup, RPO tối đa khoảng 24 giờ; không bật
  PITR hoặc thay production evidence trong plan.
- Migration/index artifacts được tạo và test local nhưng không apply.

## Initial State at Plan Start (2026-09-18)

- `bankTransactionIngestion.service.js:94-137` check fingerprint rồi create;
  khác source/reference null không đụng unique index.
- `bankTransactionSettlement.service.js:10-16,143-151` cho phép deposit success
  settle tiếp và tạo ledger key theo incoming `_id`.
- `contract.service.js:539-571,722-742` view/send/edit dùng read-then-save.
- `contract.service.js:590-675` reserve signing, upload GridFS, rồi catch có thể
  delete candidate mà chưa reconcile unknown commit.
- `Contract.js:76-110` chưa có business revision hoặc signing attempt reference.
- `db.js:4-8` chỉ pin `autoIndex`; production readiness chưa reject concern downgrade.
- `walletReconciliation.service.js:40-357` chạy nhiều query không cùng snapshot và
  chỉ kiểm `TrainerSubscription`.
- Latest verified logical backup vẫn giữ evidence thật nhưng vượt freshness policy;
  code implementation không được sửa manifest để giả current recovery point.

## Implementation Result

Năm behavior slices đã được implement, test local và review trên working tree:

- SePay cross-channel settlement có guard trong transaction, giữ incoming records
  riêng và chỉ tự động credit tối đa một bản mơ hồ.
- Contract draft/send/view dùng revision CAS; stale client nhận typed `409` và UI
  giữ local draft trước khi refetch snapshot mới.
- Signing dùng durable attempt, candidate GridFS ID, lease/fence/tombstone và
  read-back khi outcome không xác định; recovery không tự hoàn tất chữ ký thay khách.
- Runtime và các production-capable CLI/migration seam dùng Mongo durability
  resolver; readiness chặn explicit downgrade.
- Wallet reconciliation chạy trên một snapshot transaction có `limit + 1`, báo
  `coverageComplete=false` khi bị cắt và kiểm tra Fitness+ self-purchase.

Không có migration/index apply, backup/restore, staging/production write, deploy
hoặc PITR operation nào được thực hiện.

## Historical Verification Evidence (2026-09-22)

The environment blockers below were superseded by the completed local QA follow-up
on 2026-10-02. They remain here as historical evidence, not current open tasks.

| Gate | Kết quả | Ghi chú |
|---|---|---|
| Focused server | PASS | 13 files, 81 tests; signing subset rerun after final schema binding: 3 files, 23 tests |
| Full server Vitest trực tiếp | PASS | 253 files, 1.580 tests |
| Full client Vitest | PASS | 174 files, 809 tests |
| Client lint | PASS WITH EXISTING WARNING | Warning cũ tại `TrainerTransferPanel.jsx:91` |
| Client compile-only (`npx vite build`) | PASS | Release build chưa kết luận |
| Secret/data-boundary/docs privacy/agent/governance gates | PASS | Không phát hiện secret hoặc boundary regression |
| UI audit regression gate | PASS | 0 regression mới, 0 high-confidence blocking |
| `git diff --check` | PASS | Không có lỗi whitespace |
| Canonical `npm run test:unit:server` | BLOCKED | Repo yêu cầu Node `22.23.1`, runtime hiện tại `24.15.0` |
| Canonical `npm run build --prefix client` | BLOCKED | Thiếu `VITE_API_URL`; network bị chặn nên prerender `0/48` route |
| E2E | NOT RUN | Chưa có backend/test environment phù hợp |
| `npm run audit:backup-readiness` | WARN/BLOCKED | Backup gần nhất khoảng 269 giờ, vượt RPO 24 giờ; continuous/PITR unavailable |

Các blocker trên là evidence môi trường/recovery thật, không được làm xanh bằng
cách sửa manifest hoặc nới gate. Release chỉ được xem xét sau khi chạy lại bằng
Node `22.23.1`, có `VITE_API_URL`, môi trường E2E phù hợp và backup freshness đạt
policy theo runbook.

## Verification follow-up (2026-10-02, complete)

Continuation evidence: [QA report](../reports/109-qa-resume-2026-10-02.md).

Final result: server 259 files / 1,646 total tests, client 176 files / 844 passing
tests, E2E 118 passing tests with no retries, and release build 58/58 prerender
routes. Lint passed with one pre-existing React Hook Form warning. UI regression,
secrets, data-boundary, docs-privacy and agent validation gates passed. Backup
readiness passed at 09:57 on 2026-10-02 (Asia/Saigon); release freshness expires
after 11:13:57 that day unless a new verified backup is supplied. No deployment,
index application, migration or real-data write was performed in this follow-up.

Resume from the saved 2026-10-01 receipts in
`.local-data/qa-runs/plan-091-resume-20261001/`; do not repeat the completed
database restore, source backup work or secret-scanner implementation.

1. Complete auth refresh regression coverage (403, network failure, concurrent
   session/protected requests). Preserve anonymous public navigation, protected
   request redirects and CSRF. Scope: `client/src/utils/api.js` and its tests.
2. Fix Progress Hub month-start filtering using the canonical reporting-period
   contract. Trace server sources/read model and client chart consumers; preserve
   stored weekly keys and ownership. Add fixed-date API/chart regression cases.
   Scope: `progressSources.service.js`, `progressReadModel.service.js`, their
   progress tests, and the client progress chart/presentation consumers. Keep raw
   keys as identity and add `periodStartDateKey` for the timeline; normalization
   alone is rejected because legacy and merged records can share a display date.
3. Diagnose the seven failed E2E cases from the saved DOM/error artifacts. Change
   stale fixtures/assertions only when the current spec proves the expectation;
   preserve actual application behavior. Verify affected specs first.
4. Re-run affected client/server suites and the failed release build/E2E gates,
   serially with Node 22.23.1 and bounded memory. Reuse unaffected receipts with
   explicit scope; keep all new results in a separate dated run directory.
5. Review the final diff, update QA evidence and this plan with exact pass/fail
   counts and remaining blockers. Do not deploy or write real data.

Acceptance: no future weekly period leaks into current charts, the current
partial first week appears immediately, auth failures settle all queued requests,
and every attempted QA gate has a recorded result. Stop after three unsuccessful
repair cycles for the same failure or if a fix needs a new data/permission policy.

- Reuse the existing local Node `22.23.1` runtime through process-scoped `PATH`;
  preserve the globally installed runtime and the required-version gate.
- Run `npm run test:unit:server` and `npm run test:unit:client` against the current
  dirty working tree. Keep test temporary databases and logs on the workspace
  drive because the system drive has insufficient free space.
- Inspect release-build and E2E configuration, then run the canonical commands
  with the required public build configuration and isolated synthetic test data.
  Record any external dependency or uncovered financial E2E behavior explicitly.
- Recheck security, governance, UI regression and backup-readiness gates; keep
  command results tied to the current revision and working-tree fingerprint.
- Done when each gate has a verified result and the remaining release blockers
  are documented. This follow-up does not authorize deployment, applying indexes,
  migrations, or writes to staging/production.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Focused server | `cd server && npx vitest run <focused files>` | exit 0 |
| Full server | `npm run test:unit:server` | exit 0 |
| Focused client | `cd client && npx vitest run <focused files>` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0, no new warning |
| Client build | `npm run build --prefix client` | exit 0 |
| Secrets | `npm run security:secrets` | exit 0 |
| Data boundary | `npm run security:data-boundaries` | exit 0 |
| Docs privacy | `npm run security:docs-privacy` | exit 0 |
| Agent contracts | `npm run agents:validate` | exit 0 |
| Traceability | `npm run test:agents:governance` | exit 0 |
| Backup audit | `npm run audit:backup-readiness` | read-only; stale is reported, not edited |
| Diff hygiene | `git diff --check` | no errors |

## Scope

**In scope**:

- SePay incoming model, settlement guard, index manifest/migration, spec/runbook
  and concurrency tests.
- Contract schema/lifecycle/API/UI; new bounded signing-attempt model, recovery
  service, GridFS adapter, cron integration, restore verifier and tests.
- Shared Mongo connection option resolver, runtime/readiness and every direct
  production-capable connection seam found by the source inventory.
- Wallet reconciliation service/CLI/consumers, Fitness+ checks and snapshot tests.
- Additive docs, plan state and traceability.

**Out of scope**:

- Deploy, production/staging writes, index apply, backup/restore, Atlas billing/PITR.
- Historical wallet corrections, merging incoming rows or deleting GridFS files.
- Changing SePay provider contract, wallet commercial rules, Auth/CSRF/JWT.
- Route-transition files already modified in the working tree.

## Implementation Workstreams

- **Worker A — SePay**: owns IncomingBankTransaction, ingestion/settlement tests,
  SePay index artifact and runbook. Không sửa Contract/DB/reconciliation files.
- **Worker B — Contract backend**: owns Contract/signing attempt/service/cron/
  verifier/server tests. Không sửa SePay, Mongo config hoặc client UI.
- **Worker C — Durability + reconciliation**: owns Mongo config/readiness/direct
  connect inventory and wallet reconciliation/Fitness+ tests. Không sửa Contract.
- **Root**: owns spec/plan integration, Contract client UI, cross-review and final QA.

## Steps

### Step 1: Serialize ambiguous SePay auto-settlement

Viết deterministic RED fixture với hai incoming `received`, khác source/ID, cùng
fingerprint/no-reference và cùng deposit. Trong settlement transaction, query peer
cross-source đã settled/reversed trước wallet mutation; loser chuyển review. Thêm
non-unique lookup index và guarded migration contract, không unique fingerprint.

**Behavior**: một bank transfer mơ hồ tạo tối đa một automatic credit; hai transfer
thật vẫn có thể tạo hai credits.

**Blast radius**: Incoming model, settlement service, index migration/tests,
SePay integration tests và docs.

**Depends on**: none.

**Verify**: focused SePay provider/reconciliation/webhook/index suites pass trên
`MongoMemoryReplSet`; RED test phải fail trước patch và pass sau patch.

### Step 2: Make Contract draft lifecycle revision-aware

Thêm additive `revision`, validate `expectedRevision`, chuyển update/send/view sang
atomic predicates và typed 400/404/409 contract. Client edit dùng revision cùng
snapshot, send dùng revision từ save response; 409 giữ draft local và refetch.

**Behavior**: edit chậm không đổi nội dung sau send; hai editors chỉ một writer thắng;
view request chậm không hồi sinh terminal state.

**Blast radius**: Contract model/service/controller/validation, contract client
service/edit modal và focused server/client tests.

**Depends on**: none.

**Verify**: contract lifecycle integration + client service/modal tests pass;
ownership và CSRF assertions vẫn xanh.

### Step 3: Add fenced signing attempt and crash recovery

Tạo `ContractSigningAttempt`, GridFS adapter preallocate candidate ID, reserve/finalize
transactions và DB-fenced recovery lease. Unknown commit phải read-back; chỉ cleanup
attempt aborted đã fence và không còn Contract reference. Client signing refetch khi
pending; restore verifier hiểu tracked in-flight candidates nhưng vẫn fail orphan.

**Behavior**: crash/timeout tại mọi boundary không làm signed Contract mất PDF, không
double consent/audit và không kẹt signing vô thời hạn; uncommitted user được ký lại.

**Blast radius**: Contract model/new model/service/new recovery modules/cron/controller,
GridFS verifier/runbook, ContractSign UI and fault-injection tests.

**Depends on**: Step 2.

**Verify**: signing integration, restart/fault tests and GridFS verifier suite pass;
two recovery workers produce exactly one fenced outcome.

### Step 4: Enforce production Mongo durability options

Tạo pure resolver cho connection options. Production pins primary/majority/journal
and retries; dev/test preserves current behavior. Runtime, financial CLIs and all
production-capable direct `mongoose.connect` seams from inventory consume resolver.
Readiness rejects explicit downgrade without logging URI.

**Behavior**: production cannot start/run a guarded operation with weaker Mongo
durability/routing than approved contract; test/local standalone remains usable.

**Blast radius**: Mongo config/readiness, direct connector imports, focused tests
and operational docs. Không đổi credentials hoặc environment values.

**Depends on**: none.

**Verify**: resolver/readiness tests plus source inventory assertion pass; mocked
connect verifies options are actually passed, not merely documented.

### Step 5: Reconcile wallets from one bounded snapshot

Chạy all reconciliation reads/aggregates trong one snapshot transaction. Scan
stable `limit+1`, report incomplete coverage, update CLI exit contract and consumers.
Thêm Fitness+ `self_purchase` ledger/cardinality/amount/user/idempotency/orphan checks;
admin grants only counted as excluded scope.

**Behavior**: concurrent writer không tạo false mismatch trong a run; report cannot
claim clean when truncated; valid Fitness+ purchases reconcile cleanly.

**Blast radius**: reconciliation service/CLI/Phase 6 and staging consumers, Fitness+
model reads and focused replica-set tests.

**Depends on**: Step 4.

**Verify**: snapshot concurrency, Fitness+ invariant and CLI exit tests pass; existing
financial integration suites remain green.

### Step 6: Integrate, review and prepare non-production handoff

Re-trace all producers/consumers and migrations, review diff independently across
Standards/Spec/Security, run QA gates and update plan evidence truthfully. Generate
only guarded migration/preflight instructions; do not apply or deploy.

**Behavior**: local tree is implementation-complete with reusable evidence and an
explicit production rollout boundary.

**Blast radius**: docs/plan state/traceability and cleanup caused by this plan only.

**Depends on**: Steps 1–5.

**Verify**: full server, focused/full affected client, lint/build, security/data
boundary/docs/agent gates and `git diff --check` pass or blockers are recorded.

## Test Plan

- Public seams: exported services and HTTP routes; no test-only production exports.
- Financial/concurrency tests use `MongoMemoryReplSet`, literal expected balances
  and independent fixtures.
- Contract crash coverage includes reserve, upload, before/after commit, unknown
  result, late uploader, cancel/expire race and process-style restart without catch.
- Durability tests never print URI; reconciliation tests assert snapshot and
  `coverageComplete`, not private query order.
- Client tests cover stale revision, unsaved draft preservation and pending-sign refetch.

## Done Criteria

- [x] All five spec requirements and traceability ACs pass local verification.
- [x] SePay ambiguous concurrency produces one credit and one review record.
- [x] Contract writers use lifecycle CAS; signed PDF cannot be deleted by failure cleanup.
- [x] Production Mongo concern downgrade fails closed.
- [x] Wallet reconciliation uses a bounded complete snapshot and checks Fitness+.
- [x] Additive migration artifacts are tested but not applied.
- [x] No production/staging/backup/PITR/deploy operation was performed by this implementation/QA work.
- [x] Full proportional QA, security review and cleanup evidence is recorded.
- [x] Plan lifecycle/verification updated to actual result.

## STOP Conditions

- Provider data cannot distinguish the proposed ambiguous SePay class without
  false-merging legitimate transfers.
- A fix requires correcting/reversing historical production financial data.
- Legacy `signing`/GridFS state lacks evidence needed for non-destructive recovery.
- Old and new Contract writers must remain active simultaneously without a safe drain.
- Snapshot reconciliation exceeds tested transaction lifetime/memory at current bound.
- Production connection option conflicts with verified Atlas topology or SLA.
- An in-scope file acquires overlapping user/other-task edits after drift check.
- Same verification fails three repair rounds with the same blocker.

## Maintenance Notes

- Never replace SePay ambiguous identity with fingerprint uniqueness.
- Contract attempt journals are recovery evidence; retention is a later privacy spec,
  not an opportunistic TTL.
- Majority durability does not replace operation idempotency or snapshot reads.
- `continuousRecoveryAvailable` remains false until a separately authorized paid
  PITR restore drill succeeds.

## Port log

- 2026-10-10 port: số cũ 090/091 trùng plan đã có trên staging nên đổi thành 108/109; đã port
từ working tree root (backup cục bộ ngoài repo) sang branch
`codex/plans-108-109-port-20261010` từ `origin/staging` (883681e). Chưa commit/push/deploy.
- Conflict `stagingSearchIndexCohortSync.js` giải quyết bằng cách gộp resolver durable với
  `autoCreate:false` của staging. Sáu script staging AI mới (recoverStagingAiReliability, stagingAiCatalogRollout,
  stagingAiChatAcceptance{,.kbFailureCli,.recover}, stagingKnowledgeBaseReembed) chuyển sang
  `resolveMongoConnectionOptions({ durable: true, autoIndex: false })`; inventory test bỏ qua `__tests__` (in-memory).
- Verify (Node 22.23.1): server unit 11 batches/342 files/3.920 tests PASS; focused 456 + 273 PASS;
  client 982 PASS; agents:validate, security:secrets, data-boundaries PASS.
- Blocker môi trường: `npm run build` fail ở verify-search-index-build (public content API 404, cũng fail trên
  `origin/staging` sạch); `audit:backup-readiness` BACKUP_STALE (28,88h > 24h). Không deploy/migration/write.
