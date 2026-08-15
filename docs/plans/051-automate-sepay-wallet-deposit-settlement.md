# Plan 051: Tự động đối soát SePay và cộng ví an toàn

> Plan dài hơn 300 dòng có chủ đích: mỗi trust boundary và financial invariant
> cần một verification/STOP condition tự chứa để người thực thi không phải suy
> diễn từ conversation hoặc ghép nhiều tài liệu rời.

> **Hướng dẫn thực thi**: Thực hiện theo thứ tự, viết test trước behavior và chạy
> verification của từng step. Gặp STOP condition thì dừng, không tự nới matching,
> security hoặc data scope.
>
> **Drift check**: Chạy `git status --short` và `git diff -- <in-scope files>`.
> Working tree hiện có nhiều thay đổi UI ngoài Payment/Wallet; chỉ tiếp tục khi
> các file tài chính trong Current State chưa bị sửa chồng lấn.

## Status

- **Priority**: P0
- **Effort**: L (nhiều ngày)
- **Risk**: HIGH — public webhook, payment/wallet, schema và external provider
- **Depends on**: Plan 018; spec `automatic-wallet-deposit-settlement.md`
- **Category**: security / migration / feature
- **Planned at**: 2026-08-15
- **Plan status**: IMPLEMENTED LOCALLY — chờ Sandbox credentials/index activation

## Why This Matters

Hiện khách phải bấm xác nhận và admin duyệt tay trước khi ví được cộng. Plan này
nhận giao dịch TPBank qua SePay, tự cộng đúng mã + đúng tiền, giữ mismatch cho
admin và dùng API v2 bổ sung webhook bị mất. Financial invariant là một giao
dịch thật tạo tối đa một credit, nhưng hai giao dịch thật phải tạo hai credits.

## Decisions Locked by Spec

- Provider đầu tiên: SePay; tài khoản nhận: TPBank cá nhân.
- QR 15 phút; auto-settlement grace 24 giờ theo bank `transactionDate`.
- Đúng code + đúng amount mới auto-credit; mọi uncertainty vào manual review.
- Admin approve amount mismatch bằng actual bank amount.
- Không backfill; chỉ deposit và transaction sau explicit cutover được tự cộng.
- Live yêu cầu HMAC Webhook + API v2 token; frontend không optimistic balance.
- Gói FREE hiện công bố 0đ/tháng và 50 incoming transactions/tháng; usage/cost là
  operational gate, không được hardcode thành entitlement của ứng dụng.

## Current State

- `server/server.js:155` gắn global `express.json()` trước routes; raw webhook
  phải mount trước dòng này. Deposit/admin routes ở `server.js:211,231`.
- `server/src/controllers/deposit.controller.js:24-27` sinh code
  `HTC-XXXX-XXXX`; `:101` đặt expiry 15 phút; `:250` hiện cho user confirm.
- `server/src/models/DepositRequest.js:97-112` có unique code và một open intent
  mỗi user; status hiện không biểu diễn nhiều bank transactions.
- `server/src/models/WalletTransaction.js:56-106` là append-only ledger, unique
  `idempotencyKey`; reference type chưa có incoming bank transaction.
- `server/src/services/walletLedger.service.js:37-132` là writer duy nhất cần tái
  sử dụng, dùng Mongo transaction và optimistic wallet version.
- `server/src/controllers/adminDeposit.controller.js` đang approve/reverse theo
  một deposit → một ledger key `deposit:<id>`; flow legacy phải còn hoạt động.
- `server/src/services/walletReconciliation.service.js:143-199` đang assert đúng
  một ledger entry mỗi successful deposit; cần hiểu legacy và incoming entries.
- `server/src/config/db.js:7` tắt `autoIndex` ở production, nên index mới cần
  preflight/apply script riêng.
- `client/src/pages/wallet/MyWallet.jsx:123-201,364-368` gọi mutation “Tôi đã
  thanh toán”; polling deposit 15 giây đã nằm trong query options.
- `client/src/pages/admin/DepositManagement.jsx` và
  `client/src/services/adminDeposit.service.js` chỉ quản lý `DepositRequest`.
- `server/src/config/stagingSafety.js` cấm background jobs ở staging; Sandbox
  reconciliation phải có script/manual verification, không bật cron staging.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Targeted server | `cd server && npx vitest run <test-files>` | exit 0 |
| Full server | `npm run test:unit:server` | exit 0 |
| Full client | `npm run test:unit:client` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | no new high |
| Data boundary | `npm run security:data-boundaries` | exit 0 |
| Secret scan | `npm run security:secrets` | exit 0 |
| Agent rules | `npm run agents:validate` | exit 0 |
| Diff hygiene | `git diff --check` | no errors |

Không chạy Live API, staging index apply hoặc giao dịch thật trong implementation
mặc định.

## Scope

### Backend new

- `server/src/models/IncomingBankTransaction.js`
- `server/src/models/ProviderSyncCursor.js`
- `server/src/config/sepay.js`
- `server/src/services/sepayBankTransaction.provider.js`
- `server/src/services/bankTransactionIngestion.service.js`
- `server/src/services/bankTransactionSettlement.service.js`
- `server/src/services/sepayReconciliation.service.js`
- `server/src/controllers/sepayWebhook.controller.js`
- `server/src/routes/sepayWebhook.routes.js`
- `server/src/migrations/20260815-sepay-wallet-deposit-indexes.js`
- `server/src/scripts/reconcileSePayTransactions.js`
- Targeted tests under existing `__tests__` conventions.

### Backend update

- `server/server.js`
- `server/package.json`
- `server/src/models/WalletTransaction.js`
- `server/src/models/AuditLog.js`
- `server/src/controllers/deposit.controller.js`
- `server/src/controllers/adminDeposit.controller.js`
- `server/src/routes/adminDeposit.routes.js`
- `server/src/services/walletReconciliation.service.js`
- `server/src/middlewares/rateLimit.js`
- `server/src/observability/metrics.js`
- `server/src/config/productionReadiness.js` và tests
- `server/src/config/stagingSafety.js` và tests
- `server/.env.production.example`; chỉ thêm key names/placeholder, không secret
  thật.

### Frontend update

- `client/src/pages/wallet/MyWallet.jsx`
- `client/src/services/wallet.service.js`
- `client/src/queries/walletAccount.queries.js` nếu DTO/polling cần đổi
- `client/src/pages/admin/DepositManagement.jsx`
- `client/src/services/adminDeposit.service.js`
- `client/src/i18n/locales/vi/account.json`
- `client/src/i18n/locales/en/account.json`
- Targeted page/service tests.

### Docs/operations update

- `docs/specs/automatic-wallet-deposit-settlement.md`
- `docs/plans/051-automate-sepay-wallet-deposit-settlement.md`
- `docs/plans/README.md`
- `docs/operations/runbooks/sepay-wallet-deposit-settlement.md`

### Out of scope

- Đổi ngân hàng, tạo Virtual Account, dùng SePay Payment Gateway/Bank Hub.
- Backfill giao dịch/deposit trước cutover.
- Tự động refund/chuyển tiền ra ngân hàng.
- Sửa auth cookie, CSRF interceptor hoặc toàn bộ Wallet/Admin layout.
- Bật Live, nhập secret, apply index staging/production hoặc chuyển tiền thật.

## Steps

### Step 1: Nhận và lưu webhook đã xác thực mà chưa tác động số dư

Tạo config fail-closed, provider normalizer và `IncomingBankTransaction`. Mount
`POST /api/webhooks/sepay` sau telemetry/security headers nhưng trước global JSON
parser, dùng raw JSON giới hạn nhỏ, HMAC-SHA256 `{timestamp}.{raw_body}`, replay
window ±5 phút và dedicated limiter. Lưu field tối thiểu/masked/digest; reject
wrong signature/schema, ack duplicate durable và không log raw financial data.

**Behavior**: signed Sandbox-shaped incoming payload được lưu một lần ở
`received/needs_review`; replay không tạo record thứ hai và chưa đổi balance.

**Acceptance**: raw body được verify trước parse; wrong/stale signature 401;
malformed signed payload 400; missing config 503; duplicate trả success.

**Files**: SePay config/provider, incoming model, webhook controller/route,
rateLimit, `server.js`, production/staging safety, metrics và integration tests.

**Depends on**: none.

**Verify**: targeted provider + webhook tests, `npm run security:data-boundaries`.

### Step 2: Auto-settle exact match và giữ mọi mismatch cho review

Tạo shared ingestion/settlement service. Normalize TPBank account, code exact
`HTC-[A-F0-9]{4}-[A-F0-9]{4}`, safe integer amount, Asia/Ho_Chi_Minh timestamp,
cutover và grace. Trong một Mongo transaction, link deposit/user, gọi
`applyWalletEntry`, ghi incoming status/link và chuyển intent success. Extend
ledger reference type; dùng `bank-credit:sepay:<incomingId>`.

**Behavior**: đúng code + amount tự cộng; webhook retry chỉ một credit; hai bank
transactions thật cùng code/amount tạo hai credits; mismatch không đổi balance.

**Acceptance**: tests cover wrong account/direction, code/amount mismatch,
pre-cutover, within/after 24h, duplicate, two transfers và concurrent workers.

**Files**: ingestion/settlement services, `WalletTransaction`, deposit model chỉ
khi thật sự cần, webhook controller, ledger reconciliation và financial tests.

**Depends on**: Step 1.

**Verify**: targeted settlement/integration tests + existing deposit and phase6
financial integration tests.

### Step 3: Cho admin xử lý từng giao dịch lệch và reversal an toàn

Thêm admin list/detail pagination và mutations approve/ignore/reverse theo
incoming transaction. Approve nhận `depositRequestId` + reason, server tự lấy
user và actual bank amount; reverse tạo append-only entry đối ứng. Tất cả route
dùng protect/admin/CSRF/financial limiter, expected status và `AuditLog`. Mở tab
“Giao dịch ngân hàng cần xử lý” trong trang admin với masked data, confirm,
loading/error/empty/disabled states.

**Behavior**: admin có thể xử lý tiền thật không auto-match mà không duyệt lại
cùng giao dịch; legacy deposit approve/reverse vẫn hoạt động.

**Acceptance**: unauthorized/CSRF fail, idempotent replay pass, actual amount
được credit, reversal đúng một lần, DTO không lộ raw content/account/provider ID.

**Files**: incoming/admin controllers/routes/services, AuditLog enum,
`adminDeposit.service.js`, `DepositManagement.jsx` và tests.

**Depends on**: Step 2.

**Verify**: targeted admin integration/client render tests + full server unit.

### Step 4: Thay customer confirmation bằng server-authoritative status

Bỏ client mutation/nút “Tôi đã thanh toán”, thêm “Kiểm tra trạng thái” chỉ
refetch. Endpoint confirm cũ trở thành no-op acknowledgement tương thích, không
đổi deposit/ledger. Deposit DTO bổ sung additive settlement count/total/last time
bằng aggregation; UI giải thích QR expired vẫn đối soát thêm 24 giờ và hiển thị
hai credits khi khách chuyển hai lần.

**Behavior**: khách không thể tự đẩy deposit sang review; số dư/status chỉ đổi
khi backend settlement hoàn tất.

**Acceptance**: no optimistic balance, polling/refetch đúng, legacy confirm no-op,
multiple settlement summary và accessibility status có test.

**Files**: deposit controller/tests, wallet service/query/page, vi/en account
translations và frontend tests.

**Depends on**: Step 2.

**Verify**: targeted client tests, `npm run test:unit:client`, client lint/build,
UI regression gate.

### Step 5: Bổ sung webhook bị mất bằng API v2 mà không double-credit

Tạo SePay API v2 fetch adapter bằng Node `fetch`, allowlisted Sandbox/Live hosts,
Bearer token, timeout/size cap, `transfer_type=in`, `webhook_success=0`, race
delay, `since_id`, page size 100 và Retry-After/3 req/s. Persist cursor chỉ sau
durable page. Correlate webhook/API bằng hashed bank reference khi có; trường hợp
không chứng minh được đưa `POSSIBLE_CROSS_CHANNEL_DUPLICATE` vào review. Production
job chỉ chạy khi both background jobs và reconciliation enabled; staging dùng
manual Sandbox script do staging policy cấm cron.

**Behavior**: transaction bị mất webhook được import/settle; cùng transaction đã
qua webhook không tạo credit thứ hai.

**Acceptance**: cursor resume, pagination, 429, network failure, cross-channel
duplicate, ambiguous no-reference và restart đều có deterministic tests.

**Files**: cursor model, SePay provider/reconciliation service, script,
`server.js`, package scripts, config safety, metrics và tests.

**Depends on**: Steps 1–2.

**Verify**: targeted reconciliation tests + full server unit + secret/boundary
scans.

### Step 6: Khóa index, runbook và release evidence

Tạo preflight/apply index script có explicit target/confirmation; không backfill.
Runbook ghi SePay FREE/TPBank setup, HMAC/API token, webhook URL, Sandbox cases,
cutover, disable/rollback, usage >50 cảnh báo và manual review. Re-run impact map
cho deposit status, ledger references, admin routes, cleanup/reconciliation và
response contracts. Chạy QA/ship gates; chỉ đề xuất staging sau GO.

**Behavior**: code có thể deploy disabled, test Sandbox có kiểm soát và bật Live
sau cutover mà không chạm lịch sử.

**Acceptance**: local indexes/test pass; config thiếu fail closed; runbook không
chứa secret/account; staging/live writes vẫn chưa chạy.

**Files**: migration/package scripts, runbook, spec/plan status, impacted tests.

**Depends on**: Steps 1–5.

**Verify**: all commands trong Commands You Will Need; review diff và impact
matrix; Sandbox smoke chỉ khi user cung cấp/configure sandbox credentials.

## Test Plan

- Model/index: source ID unique, partial reference hash unique, cursor unique,
  append-only ledger and reversal relation.
- Security: HMAC raw bytes, constant-time comparison, stale timestamp, malformed
  JSON, wrong account, limiter, CSRF/admin role, SSRF allowlist and secret masking.
- Financial: exact match, mismatch matrix, cutover, 24h boundaries, retry,
  concurrency, two real transfers, manual actual amount, reversal and legacy.
- Provider: webhook/API normalization, UUID vs numeric IDs, pagination, timeout,
  response cap, 429 Retry-After and cross-channel ambiguous duplicate.
- UI: refetch-only customer action, polling states, multiple settlements, admin
  review states, keyboard labels and no raw provider data.
- Existing gates: deposit controller/integration, phase6 financial integration,
  wallet reconciliation and wallet query tests remain green.

## Schema Change Checklist

- New optional collections do not invalidate existing documents.
- `WalletTransaction.referenceType` only expands enum; old values remain valid.
- `AuditLog` only expands action/target enums; old logs remain valid.
- No required field is added to existing `DepositRequest` documents.
- No data backfill. Production indexes require explicit preflight/apply command.
- Rollback disables SePay ingestion/jobs; it never deletes/reverses ledger data.

## Done Criteria

- [x] Webhook/API ingestion obeys exact security and matching contract.
- [x] Retry/cross-channel duplicate ≤1 credit; two bank transfers = 2 credits.
- [x] Mismatch/out-of-window stays review-only until audited admin mutation.
- [x] Customer confirm mutation removed; backend remains authoritative.
- [x] Reconciliation recovers missed webhook and cursor resumes safely.
- [x] Legacy deposit/ledger/admin behavior remains compatible.
- [x] New indexes have local evidence; no staging/production apply was inferred.
- [x] Full server/client unit tests, lint/build, UI gate, security scans và diff
  check pass.
- [x] Runbook and plan status contain actual verification evidence.

## Verification Evidence — 2026-08-15

- Targeted SePay/admin/deposit regression sau review: 6 files, 51/51 tests pass.
- Focused admin CSRF/input boundary: 1 file, 2/2 tests pass.
- Client unit: 92 files, 453/453 tests pass.
- Server unit/integration: 155 files, 799/799 tests pass, exit 0; Vitest force-kill
  một child process không tự thoát sau khi suite đã hoàn tất.
- Client lint: exit 0. UI regression: 394 findings thuộc baseline, 0 finding mới,
  0 high-confidence blocking và 1 finding được giải quyết.
- Release build và bundle budget: exit 0. Prerender local bỏ qua 38/38 route vì
  sandbox thiếu `VITE_API_URL` và chặn network; không dùng kết quả này làm bằng
  chứng prerender staging.
- Secret scan, repository data-boundary scan, agent validation và dependency
  audit client/server: pass; không có advisory được waive.
- Codex Security dry-run đã tới preflight nhưng package download bị sandbox từ
  chối vì egress source-code risk; ghi `PREFLIGHT ONLY / PARTIAL-BLOCKED`, không
  dùng làm PASS và không thử bypass policy.
- E2E tuần tự 1 worker: 96/96 case báo `ok`; Playwright Windows không tự thoát ở
  teardown và phải Ctrl+C, nên command-level gate được ghi `BLOCKED (teardown)`.
- Không gọi SePay API thật, không gửi giao dịch thật và không apply index lên
  staging/production. Activation còn chờ Sandbox HMAC/API token, data hash
  secret, cutover timestamp và approval migration target.

## Security Coverage Ledger — 2026-08-15

- Webhook: `POST /api/webhooks/sepay` → dedicated limiter/raw body → timestamp +
  constant-time HMAC → bounded normalization/account-direction checks → durable
  incoming record → transactional settlement qua `applyWalletEntry`.
- Reconciliation: background/manual gate → allowlisted SePay host + Bearer token
  → bounded response/time/rate → shared ingestion/settlement → persisted
  cursor/lease; không log token, account hoặc raw payload.
- Admin: protected admin route → financial limiter + CSRF → ObjectId/reason/status
  validation → transactional approve/ignore/reverse → append-only ledger + audit.
- Customer: authenticated ownership-filtered deposit reads; nút trạng thái chỉ
  refetch, endpoint confirm legacy là no-op và client không gửi authoritative
  amount/balance.
- Data sinks: raw bank content/reference không được persist hoặc trả ra admin;
  account chỉ mask, identity/dedupe dùng HMAC digest server-only.
- Deferred proof: payload thực tế Sandbox, HMAC dashboard config, API v2 token,
  remote index state và staging webhook delivery chưa thể xác minh khi chưa có
  credentials/approval. Đây là activation blocker, không được hạ matching hoặc
  bật Live để thay thế.

## Cleanup Exception

Mọi production module/component mới của Plan 051 đều không quá 300 dòng. Ba file
integration test webhook/admin/reconciliation dài 323–417 dòng được giữ nguyên
như ngoại lệ có lý do: mỗi suite dùng chung database lifecycle/fixture và kiểm
chứng tuần tự cùng một financial boundary; tách cơ học sẽ nhân bản setup và làm
khó đọc invariant hơn mà không giảm rủi ro runtime.

## STOP Conditions

- SePay FREE Dashboard không cấp HMAC webhook hoặc API v2 token cho TPBank.
- Sandbox payload/reference identity khác contract và không thể dedupe an toàn.
- Auto-credit path không thể chứng minh all matching checks trước wallet mutation.
- Implement cần backfill/delete/rename existing financial data.
- Staging config trỏ Live provider/account hoặc yêu cầu bật background jobs.
- In-scope financial file có concurrent user change không thể merge an toàn.
- Targeted verification fail ba vòng sau các sửa có căn cứ.
- Cần gọi Live API, apply remote indexes hoặc thực hiện giao dịch thật chưa được
  user xác nhận riêng.

## Maintenance Notes

- Theo dõi tổng incoming TPBank trên SePay, không chỉ số lần nạp trong app; cân
  nhắc tài khoản riêng nếu giao dịch cá nhân làm vượt quota hoặc tạo review noise.
- Khi thêm provider mới, normalize về canonical incoming contract; không copy
  settlement logic.
- Không dùng fingerprint amount/content/time làm unique key vì có thể gộp hai
  giao dịch thật.
- Review kỹ raw-body mount order, transaction boundary, partial unique indexes,
  API v2/webhook identity mismatch và legacy reversal.
