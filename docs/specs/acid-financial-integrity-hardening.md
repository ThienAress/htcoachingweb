# Spec: ACID financial integrity and recovery hardening

Status: Implemented locally — owner chốt A/A và duyệt implementation ngày
2026-09-18; rollout và production evidence chưa bắt đầu (2026-09-22).

## Objective

Khép năm finding từ audit ACID mà không thay đổi business behavior hợp lệ:

1. Không double-credit cùng một giao dịch SePay khi webhook và reconciliation
   chạy đồng thời nhưng thiếu bank reference chung.
2. Không cho phép edit snapshot hợp đồng sau khi snapshot đó đã được phát hành.
3. Không để crash/unknown commit trong luồng ký làm mất PDF đã commit, kẹt
   `signing` vô hạn hoặc tạo GridFS orphan không truy vết được.
4. Biến production Mongo durability thành contract được code/readiness gate kiểm
   chứng, đồng thời giữ backup/PITR là evidence vận hành thật.
5. Chạy wallet reconciliation trên consistent snapshot, fail closed khi coverage
   bị cắt và đối soát cả HT Fitness+ self-purchase.

Không có bằng chứng production đã gặp finding 1–3. Implementation không tự sửa
dữ liệu lịch sử, không chạy migration, backup, restore, deploy hoặc thay đổi Atlas.

## Assumptions đề xuất

1. SePay thiếu immutable identity chung phải fail closed vào manual review; không
   dùng fingerprint làm unique key và không gộp hai incoming records.
2. Contract signing recovery chỉ xác định outcome. Nếu finalize chưa commit, khách
   ký lại; hệ thống không tự hoàn tất chữ ký thay khách.
3. Signing attempt không lưu ảnh chữ ký pending. Journal/tombstone không dùng TTL
   trong release đầu để không mất cleanup evidence.
4. Fitness+ reconciliation cover `source=self_purchase`. `admin_grant` được đếm
   riêng nhưng chưa suy ledger semantics khi repo chưa có producer canonical.
5. Local implementation tạo guarded index/migration artifacts nhưng không apply.
6. Backup policy mặc định tiếp tục là verified logical backup không quá 24 giờ;
   PITR chỉ được coi là available sau paid tier + isolated restore drill thật.

## Tech stack liên quan

- Node.js 22.23.1, Express 5, Mongoose 9.8, MongoDB replica set.
- React 19, TanStack Query 5 và service layer hiện có cho Contract UI.
- Vitest, Supertest và `MongoMemoryReplSet` cho regression concurrency/fault tests.
- GridFS bucket `contracts` và wallet append-only ledger hiện có.

## Behavior requirements

### REQ-001 — SePay cross-channel settlement guard

- `AC-001`: Hai incoming khác source/ID nhưng cùng fingerprint/no-reference được
  settle đồng thời chỉ tạo một automatic credit; bản còn lại vào
  `POSSIBLE_CROSS_CHANNEL_DUPLICATE`.
- `AC-002`: Replay/canonical-reference/two-real-transfer cases và guarded index
  contract vẫn đúng; không unique fingerprint hoặc merge incoming.

- Giữ unique source key và canonical reference hash hiện có.
- Trước `applyWalletEntry`, settlement transaction tìm peer khác source có cùng
  `provider + fingerprintDigest`, không có canonical reference và đã `settled`
  hoặc `reversed`.
- Nếu có peer, incoming hiện tại chuyển atomically sang `needs_review` với
  `POSSIBLE_CROSS_CHANNEL_DUPLICATE`; không tạo ledger entry.
- Hai settlement đồng thời cùng wallet dùng transaction conflict/CAS để chỉ một
  transaction commit; callback retry phải nhìn thấy peer đã commit.
- Hai giao dịch thật không bị gộp. Admin vẫn có thể xác minh và approve incoming
  thứ hai bằng flow audit hiện có.
- Thêm non-unique lookup index; không backfill field và không sửa lịch sử.

### REQ-002 — Contract revision CAS

- `AC-003`: Delayed edit, two editors, stale send và delayed view đều được
  serialized bằng status + revision CAS với typed 400/404/409 outcome.
- `AC-004`: Client gửi revision của đúng form snapshot, giữ draft khi conflict
  và send bằng revision từ save response vừa thành công.

- Contract có business `revision` nguyên không âm, mặc định 0.
- `PUT /api/contracts/:id` và `POST /api/contracts/:id/send` yêu cầu
  `expectedRevision` của đúng snapshot đang hiển thị.
- Mutation dùng predicate `_id + owner + status=draft + revision`, field allowlist,
  `$inc revision` và audit trong một atomic update.
- CAS miss trả 404 khi ngoài owner scope; stale status/revision trả 409 với
  `errorCode` ổn định; input revision sai trả 400.
- `markAsViewed` trở thành atomic `sent → viewed`, idempotent khi replay và không
  được hồi sinh trạng thái sau cancel/expire/sign.
- UI giữ nội dung chưa lưu khi 409, refetch snapshot mới và không tự merge/retry.
  Send phải dùng revision từ save response vừa thành công.

### REQ-003 — Fenced contract signing recovery

- `AC-005`: Fault/restart tại reserve, upload, finalize và unknown commit không
  double-transition, double-consent hoặc xóa PDF đã commit.
- `AC-006`: GridFS restore verifier phân biệt tracked attempt với orphan thật và
  vẫn fail closed khi binding/hash/chunks không hợp lệ.

- Reserve ký tạo `ContractSigningAttempt` và chuyển Contract
  `viewed → signing` trong cùng transaction.
- Candidate GridFS `_id` được tạo và lưu trước upload. GridFS metadata chỉ chứa
  internal contract/attempt binding và content type, không chứa chữ ký/PII.
- Finalize transaction phải fence đúng active attempt, ghi Contract `signed`,
  PDF/hash/audit và notification consent đúng một lần, rồi mark attempt committed.
- Exception hoặc unknown commit không được reset/delete ngay. Service read-back:
  nếu Contract đã reference candidate thì trả final server state; nếu DB chưa xác
  định thì giữ state/file và trả pending để client refetch.
- Recovery worker claim lease bằng DB CAS. Attempt bị abort chỉ được cleanup khi
  đã fence, không Contract nào reference candidate và file thuộc đúng attempt.
- Giữ tombstone để bắt late upload từ worker cũ; lease hết hạn không tự chứng minh
  uploader đã dừng.
- Cancel/expire/finalize cạnh tranh bằng atomic predicates; chỉ một terminal
  outcome hợp lệ. Legacy `signing` thiếu attempt không được auto-delete/repair.

### REQ-004 — Mongo durability contract và backup boundary

- `AC-007`: Production resolver thực sự truyền primary/majority/journal/retry
  options và readiness reject mọi explicit downgrade; dev/test tương thích.
- `AC-008`: Backup audit tiếp tục phản ánh evidence thật; implementation không
  làm mới manifest, bật PITR hoặc biến stale backup thành ready.

- Có resolver connection options dùng chung cho runtime và production-capable
  scripts/migrations.
- Production pin `readPreference=primary`, `readConcern=majority`,
  `writeConcern={w:majority,journal:true}`, `retryReads=true`,
  `retryWrites=true`, `autoIndex=false`.
- Readiness reject explicit downgrade như `w=1`, `journal=false`, secondary read,
  local read concern hoặc retry writes off; không echo URI/credentials.
- Dev/test giữ behavior tương thích; production options có test replica-set riêng.
- Không thay readiness JSON bằng giả định. Fresh backup/off-device drill/PITR chỉ
  cập nhật evidence sau thao tác thật theo runbook và authority riêng.

### REQ-005 — Snapshot wallet reconciliation và HT Fitness+

- `AC-009`: Một run dùng consistent snapshot; concurrent writer ngoài snapshot
  không tạo false issue và truncated scope không thể báo clean.
- `AC-010`: Fitness+ self-purchase hợp lệ có đúng ledger; thiếu/sai amount, user,
  idempotency hoặc orphan reference sinh issue ổn định.

- Mọi query/aggregate trong một reconciliation run dùng cùng Mongo session với
  `readConcern=snapshot`, primary read và majority commit.
- Scan sort ổn định, lấy `limit + 1`; nếu vượt limit trả
  `coverageComplete=false` và `RECONCILIATION_SCOPE_TRUNCATED`.
- CLI exit 0 chỉ khi snapshot hoàn chỉnh và không có issue; exit 2 khi mismatch
  hoặc truncated; exit 1 khi config/connection/runtime failure.
- Giữ `checkedSubscriptions` tương thích, thêm trainer/Fitness+ counts và
  consistency/coverage metadata không chứa dữ liệu nhạy cảm.
- Với Fitness+ `self_purchase`, yêu cầu đúng một successful purchase ledger:
  reference đúng subscription, amount âm bằng stored purchase snapshot, user
  khớp và idempotency key đúng namespace. Không so với catalog hiện tại.
- Phát hiện ledger Fitness+ tham chiếu subscription không tồn tại.

## Data model và compatibility

### IncomingBankTransaction

- Chỉ thêm non-unique compound index phục vụ peer lookup.
- Không unique fingerprint, không merge record, không data backfill.

### Contract

- Thêm `revision` default 0 và internal `signingAttemptId`.
- Legacy document thiếu revision được CAS lần đầu bằng predicate missing-or-zero;
  null/sai type/âm không được coi là zero.
- Attempt internals bị loại khỏi API projections.

### ContractSigningAttempt

- Collection mới, bounded-purpose: contract/client/candidate file IDs, state,
  fence/lease, timestamps và cleanup evidence tối thiểu.
- Index claim theo state/lease, history theo contract, unique candidate file ID.
- Không TTL ở release đầu; không lưu pending signature image.

### Rollout compatibility

- Client cũ thiếu `expectedRevision` fail 400; frontend/backend phải promote cùng
  release. Không fallback silent write.
- Drain old Contract writers trước cutover. Không rollback sang binary cũ khi có
  signing attempts mới đang active.
- Indexes/migrations là additive nhưng production apply cần target lock, fresh
  backup evidence và approval riêng.
- Không tự reverse alleged historical double credits hoặc delete legacy orphan.

## Expected file surface

### Backend

- SePay ingestion/settlement model, index migration và focused tests.
- Contract model/service/controller/validation, signing attempt model/recovery,
  Contract cron và GridFS restore verifier.
- Mongo connection/readiness resolver và all production-capable connection seams.
- Wallet reconciliation service/CLI/consumers và Fitness+ reconciliation tests.

### Frontend

- Contract service and edit/sign screens for revision conflict and pending
  signing refetch. Không sửa auth/CSRF interceptor.

### Docs/operations

- SePay runbook, backup/restore runbook, guarded migration notes and this spec.

## Testing strategy — RED trước GREEN

1. SePay: hai incoming khác source/cùng fingerprint settle đồng thời → đúng một
   credit; replay/reversal/two-real-transfer cases không regression.
2. Contract CAS: delayed edit versus send, two editors, stale send và delayed view
   versus terminal transition.
3. Signing: failures/crash sau reserve/upload/finalize, unknown commit, two
   recovery workers, late uploader, cancel/expire race và restart without catch.
4. Durability: readiness reject từng downgrade; production options thực sự được
   truyền vào Mongoose; dev/test compatibility.
5. Reconciliation: snapshot isolation under concurrent write, valid/invalid
   Fitness+ ledgers, orphan reference và truncated coverage.
6. Sau focused GREEN: full server unit/integration, focused client tests, client
   lint/build, security scans, data-boundary scan và `git diff --check`.

## Boundaries

- Always: fail closed cho financial ambiguity; ownership/CSRF/role checks; safe
  logging; server-authoritative amount/state; no destructive recovery.
- Ask first: production index apply, backup/restore, deployment, historical data
  correction, paid Atlas tier/PITR hoặc thay retention/privacy policy.
- Never: unique ambiguous fingerprint; auto-finalize chữ ký chưa commit; delete
  file khi commit outcome chưa chắc; edit readiness evidence để giả pass; expose
  URI/token/account/content/signature/attempt internals.

## Success criteria

### REQ-006 — Integrated verification and delivery boundary

- `AC-011`: Full proportional QA, secret/data-boundary gates và diff hygiene
  pass; mọi blocker thật được ghi lại, không hạ gate hoặc sửa evidence để xanh.

- Năm regression families RED trên code cũ và GREEN sau patch.
- SePay concurrency tạo tối đa một automatic credit mà không gộp hai giao dịch
  thật theo fingerprint.
- Published Contract snapshot immutable; every writer respects lifecycle CAS.
- Signed Contract không thể reference file bị cleanup; stuck attempts recoverable.
- Production durability downgrade bị startup/readiness gate chặn.
- Reconciliation không báo sạch khi snapshot/coverage không đầy đủ và cover
  Fitness+ self-purchase.
- Không thay đổi production, không apply migration và không làm mất user data
  trong implementation local.

## Owner decisions

1. Contract recovery: nếu finalize chưa commit thì khách ký lại; hệ thống không
   auto-finalize thay khách.
2. Recovery objective: giữ Atlas Free + verified logical backup với RPO tối đa
   khoảng 24 giờ. Paid PITR/RPO khoảng 5 phút nằm ngoài implementation này.
