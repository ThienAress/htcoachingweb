# Spec: Tự động đối soát chuyển khoản và cộng ví qua SePay

**Status:** IMPLEMENTED LOCALLY ngày 2026-08-15 — chưa bật Sandbox/Live.

> Tài liệu dài hơn 300 dòng có chủ đích vì đây là contract tài chính xuyên
> webhook, ledger, admin, reconciliation và cutover; giữ một spec canonical giúp
> tránh tách rời các invariant chống cộng trùng.

## Assumptions

1. Provider đầu tiên là SePay Webhooks + SePay API v2; tích hợp nằm sau một
   adapter nội bộ để có thể thay provider mà không đổi nghiệp vụ Wallet.
2. Tiền tiếp tục chuyển thẳng vào tài khoản TPBank cá nhân đang cấu hình qua
   `BANK_NAME`, `BANK_CODE`, `BANK_ACCOUNT` và `BANK_HOLDER`; HTCOACHING không
   giữ tiền trung gian.
3. Một giao dịch ngân hàng thật được cộng đúng một lần. Hai giao dịch ngân hàng
   thật, kể cả cùng mã và cùng số tiền, được cộng hai lần.
4. Chỉ tự động cộng khi mã nạp và số tiền đều khớp chính xác. Mọi sai lệch được
   lưu ở hàng chờ để admin quyết định.
5. QR hết hạn sau 15 phút như hiện tại. Giao dịch có thời gian ngân hàng nằm
   trong 24 giờ sau `expiresAt` vẫn được tự động cộng; sau mốc này phải duyệt
   tay. Thời điểm dùng để xét là `transactionDate`, không phải lúc webhook tới.
6. Nút “Tôi đã chuyển khoản” không còn làm thay đổi trạng thái. UI thay bằng
   “Kiểm tra trạng thái”, chỉ refetch dữ liệu server và không tác động số dư.
7. Cutover đã được duyệt: không backfill/tự cộng các giao dịch trước thời điểm
   bật tính năng; các yêu cầu nạp cũ tiếp tục được admin xử lý.
8. Khi admin duyệt giao dịch sai số tiền, số tiền cộng là số tiền thực tế ngân
   hàng đã nhận (`transferAmount`), không phải số tiền khách đã nhập trên form.

Nếu một assumption cần đổi, phải cập nhật spec trước khi implement.

## Objective

Tự động ghi nhận tiền vào tài khoản ngân hàng, khớp với yêu cầu nạp tiền và cộng
ví khách hàng mà không cần admin online. Hệ thống phải chịu được webhook retry,
webhook bị mất, mạng chậm, hai request xử lý đồng thời và khách chuyển hai lần.

Success là giao dịch đúng mã + đúng tiền được cộng tự động trong vài giây khi
webhook hoạt động; giao dịch thiếu webhook được bổ sung bởi reconciliation;
giao dịch sai lệch không tự động tác động số dư nhưng xuất hiện rõ trong màn
hình admin để xử lý.

## Tech Stack liên quan

- Express 5; route webhook server-to-server dùng raw JSON body.
- Mongoose 9 và MongoDB transaction cho incoming transaction + ledger + wallet.
- `WalletTransaction` append-only và `walletLedger.service.js` là nguồn ghi ví.
- React 19 + TanStack Query 5 cho Wallet và trang quản lý admin.
- SePay Webhooks HMAC-SHA256 và SePay API v2 Bearer token.
- Vitest + Supertest + MongoDB Memory Server; SePay Test mode cho smoke test.

## Commands

- Server tests: `npm run test:unit:server`
- Client tests: `npm run test:unit:client`
- Client lint: `npm run lint --prefix client`
- Client build: `npm run build --prefix client`
- Financial boundary scan: `npm run security:data-boundaries`
- Secret scan: `npm run security:secrets`
- Diff hygiene: `git diff --check`

Không chạy giao dịch thật, seed/migration staging hoặc production nếu chưa xác
nhận target.

## Vocabulary và invariants

### Ba khái niệm tách biệt

- `DepositRequest`: ý định nạp tiền do khách tạo; chứa số tiền mong muốn, mã nạp
  và thời gian QR.
- `IncomingBankTransaction`: một giao dịch tiền vào thực tế do provider báo;
  chứa dữ liệu tối thiểu phục vụ dedupe, matching, review và audit.
- `WalletTransaction`: bút toán append-only làm thay đổi số dư ví.

### Invariants bắt buộc

1. Mỗi `IncomingBankTransaction` tạo tối đa một `WalletTransaction` loại
   `deposit` chưa bị reversal.
2. Một `DepositRequest` có thể liên kết nhiều `IncomingBankTransaction`.
3. Retry/replay của cùng một giao dịch không tạo thêm incoming record hoặc
   ledger effect.
4. Hai giao dịch thật khác nhau không bị gộp chỉ vì cùng amount/content/time.
5. Balance chỉ thay đổi trong MongoDB transaction qua `applyWalletEntry`.
6. Frontend không optimistic credit và không gửi số tiền authoritative.
7. Reversal là ledger entry đối ứng của một incoming transaction cụ thể; không
   xóa/sửa bút toán gốc.

## User journeys

### Giao dịch khớp hoàn toàn

1. Khách tạo `DepositRequest`, nhận QR có mã `HTC-XXXX-XXXX`.
2. Ngân hàng ghi nhận tiền vào và SePay gọi webhook.
3. Server xác thực chữ ký, chuẩn hóa payload, lưu/dedupe giao dịch.
4. Nếu account, direction, code, amount và time window đều hợp lệ, service tạo
   ledger entry và cập nhật `DepositRequest` thành `success` trong cùng
   transaction.
5. Polling/refetch hiện có lấy trạng thái và số dư mới từ backend.

### Khách chuyển hai lần

Mỗi giao dịch có danh tính provider/bank riêng và tạo một incoming record cùng
một ledger entry. `DepositRequest` vẫn là một intent nhưng lịch sử ví hiển thị
hai lần cộng; DTO deposit trả thêm tổng số giao dịch đã cộng và tổng tiền đã
cộng để UI không gây hiểu nhầm.

### Webhook retry hoặc hai worker xử lý đồng thời

Unique indexes chặn trùng ở database. Nếu ledger đã tồn tại, handler trả success
mà không cộng lại. Duplicate key/concurrent wallet version conflict được đọc lại
theo state server; lỗi transient retry tối đa ba vòng rồi trả 5xx để SePay retry.

### Webhook bị mất

Background reconciliation gọi SePay API v2 theo cursor, chỉ lấy tiền vào của tài
khoản cấu hình và đưa qua cùng normalization/settlement service. Job chạy sau
một khoảng trễ an toàn để tránh đua với webhook, lưu cursor bền vững và tôn
trọng rate limit của provider.

### Sai mã hoặc sai tiền

Không tự cộng. Incoming transaction ở `needs_review` với reason code rõ ràng:

- `CODE_NOT_FOUND`: không trích được mã nạp.
- `DEPOSIT_NOT_FOUND`: mã không thuộc deposit nào.
- `AMOUNT_MISMATCH`: mã đúng nhưng tiền khác.
- `CODE_MISMATCH_OR_AMBIGUOUS`: tiền có thể khớp nhưng mã sai/không đủ duy nhất.
- `OUTSIDE_AUTO_SETTLEMENT_WINDOW`: quá 24 giờ sau khi QR hết hạn.
- `POSSIBLE_CROSS_CHANNEL_DUPLICATE`: không đủ dữ liệu chứng minh webhook và API
  là cùng hay khác giao dịch.
- `POSSIBLE_LEGACY_MANUAL_CREDIT`: yêu cầu nạp đã có credit do admin duyệt theo
  flow cũ; chưa đủ bằng chứng để xác định incoming là khoản đã cộng hay lần
  chuyển tiền thứ hai.
- `PRE_CUTOVER_TRANSACTION`: giao dịch trước thời điểm bật automation.
- `PRE_CUTOVER_DEPOSIT`: yêu cầu nạp được tạo trước thời điểm bật automation.

Admin có thể link đúng user/deposit rồi duyệt số tiền thực nhận, hoặc đánh dấu
không cộng. Mọi quyết định có audit log; cùng một incoming transaction không thể
được duyệt hai lần.

### Khách đã bị trừ tiền nhưng ví chưa cộng

UI tiếp tục polling khi deposit còn mở. “Kiểm tra trạng thái” chỉ refetch ngay.
Reconciliation bổ sung webhook bị mất. Nếu vẫn chưa khớp, admin thấy giao dịch ở
hàng review và có thể đối chiếu bằng mã tham chiếu đã mask/hash; khách không cần
chuyển lại chỉ vì UI chưa đổi.

### Tiền tới sau khi QR hết hạn

“QR hết hạn” chỉ nghĩa là mã QR/intent không còn mở để chờ trên UI, không có
nghĩa giao dịch ngân hàng bị hủy. Nếu `transactionDate <= expiresAt + 24h` và
mọi điều kiện khác khớp, hệ thống vẫn tự cộng. Sau mốc đó, giao dịch vẫn được lưu
nhưng chuyển sang review.

## Matching rules

Thứ tự fail-closed:

1. Webhook đã qua HMAC hoặc record đến từ API reconciliation đã xác thực Bearer.
2. `transferType === "in"` và amount là số nguyên VND dương.
3. `accountNumber` khớp chính xác `BANK_ACCOUNT` sau normalization.
4. Transaction không trước cutover.
5. Code được normalize uppercase, ưu tiên field `code`, sau đó mới tìm exact
   pattern canonical `HTC-[A-F0-9]{4}-[A-F0-9]{4}` hoặc compact
   `HTC[A-F0-9]{8}` trong content. TPBank có thể bỏ dấu `-`; dạng compact chỉ
   được chấp nhận khi có đúng 8 ký tự hex và phải canonicalize về dạng có dấu
   gạch trước ambiguity check. Không fuzzy match.
6. Tìm `DepositRequest` bằng unique `depositCode`, không yêu cầu deposit vẫn
   `pending`; deposit `expired` hoặc `success` vẫn có thể nhận thêm giao dịch
   thật trong grace window.
7. Nếu deposit đã có credit legacy `referenceType=deposit_request` chưa reversal,
   incoming được giữ ở review vì chưa thể chứng minh đó là cùng khoản admin đã
   cộng hay một lần chuyển thật thứ hai.
8. `transferAmount === DepositRequest.amount`.
9. `transactionDate` nằm từ lúc tạo intent (cho phép clock skew nhỏ) đến
   `expiresAt + 24h`.

Chỉ khi toàn bộ điều kiện đúng mới auto-settle.

## Idempotency và cross-channel dedupe

SePay webhook hiện dùng `id` dạng số, trong khi API v2 dùng UUID. Vì vậy không
được giả định hai kênh luôn có cùng `id`.

- Unique source key: `{ provider, source, providerTransactionId }`.
- Khi `referenceCode/reference_number` có giá trị, tạo canonical reference hash
  từ bank + account + reference; partial unique index dùng hash này để nối hai
  kênh mà không lưu raw reference làm khóa công khai.
- Khi reference trống, lưu payload digest/fingerprint để phát hiện nghi trùng
  nhưng không dùng fingerprint làm unique key, vì hai giao dịch thật có thể cùng
  amount/content/time.
- Reconciliation ưu tiên `transfer_type=in`, `webhook_success=0`, chỉ xử lý giao
  dịch đã cũ hơn webhook race delay và dùng `since_id`, `per_page <= 100`.
- Nếu không thể chứng minh hai record là cùng giao dịch, không auto-credit bản
  thứ hai; đưa vào `POSSIBLE_CROSS_CHANNEL_DUPLICATE` để admin quyết định.
- Ledger idempotency key dùng incoming identity, ví dụ
  `bank-credit:sepay:<incomingId>`; reversal dùng
  `bank-reversal:sepay:<incomingId>`.

Cách này bảo vệ cả hai yêu cầu: một callback retry không cộng hai lần, nhưng hai
giao dịch ngân hàng thật vẫn có thể được cộng hai lần.

## Security và privacy

### Webhook boundary

- Route dự kiến: `POST /api/webhooks/sepay`.
- Route được mount sau telemetry/security headers nhưng trước `express.json()`;
  chỉ route này dùng `express.raw({ type: "application/json", limit: ... })`.
- Xác thực `X-SePay-Signature: sha256=<hex>` trên chuỗi
  `{timestamp}.{raw_body}` và `X-SePay-Timestamp` trong cửa sổ ±5 phút.
- So sánh signature constant-time và reject khi secret thiếu/sai.
- Webhook không dùng cookie/JWT/CSRF vì là server-to-server; thay bằng HMAC,
  timestamp, validation, expected account và dedicated rate limiter.
- Không ack trước khi incoming record/settlement đã durable. Duplicate đã xử lý
  trả `200 {"success":true}`; lỗi transient trả 5xx để provider retry.

### Secrets và config

- `SEPAY_WEBHOOK_SECRET`: bắt buộc cho webhook.
- `SEPAY_API_TOKEN`: server-only, bắt buộc để reconciliation hoạt động.
- `SEPAY_MODE`: `sandbox` hoặc `live`; map sang allowlisted base URL, không nhận
  arbitrary URL từ request.
- `SEPAY_AUTOMATION_CUTOVER_AT`: ISO UTC, chặn backfill ngoài ý muốn.
- `BANK_ACCOUNT`: dùng verify tài khoản đích; không log raw.

Secret chỉ nằm trong local/Render environment. Không trả về frontend, không ghi
log, không commit và không đưa vào audit metadata.

### Data minimization

Không lưu raw webhook body, `description`, tên người chuyển, số dư tích lũy hoặc
toàn bộ nội dung ngân hàng nếu không cần. Incoming record chỉ giữ:

- provider/source IDs và hash/digest phục vụ dedupe;
- gateway, masked account, amount, direction, transaction time;
- normalized deposit code, link deposit/user khi khớp;
- status/reason, source, timestamps và actor review;
- link tới wallet transaction/reversal.

`safeLog` chỉ ghi event code, internal IDs, reason và count; không ghi account,
content, raw payload, token hay signature.

## Data model

### New: `IncomingBankTransaction`

Các field dự kiến:

- `provider`, `source`, `providerTransactionId`.
- `canonicalReferenceHash` (nullable), `payloadDigest`, `fingerprintDigest`.
- `gateway`, `maskedAccountNumber`, `transferType`, `amount`, `transactionAt`.
- `depositCode` (nullable), `depositRequestId` (nullable), `userId` (nullable).
- `status`: `received`, `settled`, `needs_review`, `ignored`, `reversed`.
- `reviewReason`, `walletTransactionId`, `reversalTransactionId`.
- `reviewedBy`, `reviewedAt`, `reviewNote`, timestamps.

Indexes:

- unique `{ provider, source, providerTransactionId }`;
- partial unique `{ provider, canonicalReferenceHash }` khi hash tồn tại;
- `{ status, createdAt }` cho admin queue;
- `{ depositRequestId, transactionAt }` và `{ userId, transactionAt }`.

### New: `ProviderSyncCursor`

Lưu `provider`, account identity đã hash, `lastTransactionId`, `lastRunAt` và
trạng thái lỗi tối thiểu. Unique theo provider + account. Cursor chỉ tiến sau khi
toàn bộ page đã được ingest durable.

### Update: `WalletTransaction`

Thêm `incoming_bank_transaction` vào `referenceType`. Ledger mới reference trực
tiếp incoming transaction; incoming transaction reference ngược tới deposit.
Các entry legacy `referenceType: deposit_request` vẫn hợp lệ.

### `DepositRequest`

Giữ các status hiện có để backward compatible. Với automation:

- lần settlement đầu tiên chuyển intent sang `success`;
- settlement thứ hai không tạo intent mới và không đổi lại balance cũ;
- reversal thao tác trên incoming transaction cụ thể;
- status `reversed` cấp deposit chỉ còn áp dụng cho flow legacy hoặc khi mọi
  settlement liên quan đã được hoàn tác theo rule được test.

Không xóa/mutate ledger hoặc dữ liệu deposit cũ.

## API contracts

### Provider webhook

`POST /api/webhooks/sepay`

- `200 { "success": true }`: accepted durable, settled/reviewed/ignored, hoặc
  duplicate đã xử lý.
- `400`: signed payload không đúng schema.
- `401`: thiếu/sai HMAC hoặc timestamp ngoài replay window.
- `429`: vượt dedicated limiter.
- `500/503`: lỗi transient/config làm request chưa được ingest; cho phép retry.

Không trả match reason, user ID, balance hoặc thông tin account cho provider.

### Customer

Giữ `GET /api/deposits`, `GET /api/deposits/:id` và `GET /api/me/wallet`.
Deposit DTO có thể bổ sung field additive:

- `settledTransactionCount`;
- `settledAmountTotal`;
- `lastSettlementAt`.

Giữ `POST /api/deposits/:id/confirm` tạm thời cho client cũ nhưng biến thành
safe status acknowledgement/refetch hint, tuyệt đối không chuyển deposit sang
`needs_review` và không tác động ledger. Sau một release tương thích mới xóa.

### Admin

Bổ sung nhóm endpoint admin có `protect`, role `admin`, CSRF và
`financialCommandLimiter`:

- list/filter incoming transactions;
- xem chi tiết đã mask;
- link user/deposit và approve actual amount;
- ignore/reject với reason;
- reverse một settled incoming transaction bằng ledger đối ứng.

Mutation dùng expected current status để tránh lost update, idempotent khi replay
và ghi `AuditLog` trong cùng transaction.

## Admin UX

Trang quản lý nạp tiền có hai nhóm rõ ràng:

1. “Yêu cầu nạp”: intent do khách tạo, giữ flow legacy.
2. “Giao dịch ngân hàng cần xử lý”: tiền thực đã đến nhưng chưa auto-settle.

Mỗi row hiển thị amount, masked account, bank, transaction time, detected code,
reason và linked customer. Không hiển thị raw token/signature/body hoặc toàn bộ
bank description. Approve phải có confirmation và ghi rõ “cộng số tiền thực
nhận”; reverse bắt buộc nhập lý do.

## Customer UX

- Bỏ nút “Tôi đã thanh toán”.
- Thêm “Kiểm tra trạng thái” gọi refetch query; disable trong lúc fetching.
- Giữ polling 15 giây khi có deposit `pending/needs_review`; với intent vừa hết
  hạn, UI cho biết hệ thống vẫn đối soát giao dịch đến muộn trong 24 giờ.
- Khi balance/status thay đổi, chỉ hiển thị dữ liệu server trả về.
- Nếu có hai settlement, lịch sử ví hiển thị hai ledger entries và deposit card
  hiển thị count/total tương ứng.
- Error/loading/empty/disabled state và `aria-live` phải rõ ràng.

## Reconciliation và operations

- Job chạy lúc server khởi động và theo interval cấu hình an toàn; không gọi API
  nếu mode/token/account/cutover thiếu.
- Dùng API base URL đúng `sandbox/live`, Bearer token server-only,
  `since_id`, `per_page=100`, `transfer_type=in` và backoff theo `Retry-After` khi
  429; không vượt 3 request/giây.
- Cursor không tiến qua page lỗi. Mọi record đi qua cùng settlement service như
  webhook.
- Metrics tối thiểu: webhook received/auth failed/duplicate, auto-settled,
  needs-review theo reason, reconciliation imported/failed, ledger conflicts.
- Ops health chỉ báo configured/degraded và last reconciliation time; không lộ
  secret hoặc account.
- Alert/log không chứa PII. Admin queue là nguồn vận hành cho mismatch.

## Cutover và backward compatibility

Đề xuất an toàn cho lần đầu bật:

1. Deploy schema/code ở trạng thái automation disabled.
2. Cấu hình SePay Sandbox + HMAC + API token, chạy test mode.
3. Chọn `SEPAY_AUTOMATION_CUTOVER_AT` ngay trước khi bật Live.
4. Chỉ transaction có `transactionAt >= cutover` và deposit được tạo sau cutover
   mới được auto-settle.
5. Không import/cộng lại lịch sử vì các deposit cũ có thể đã được admin duyệt mà
   chưa có mapping tới SePay ID.
6. Existing pending/needs_review/expired trước cutover vẫn ở flow admin manual.
7. Rollback chỉ tắt ingestion/automation; không reverse ledger đã ghi. Nếu cần
   sửa tiền dùng transaction-specific reversal có audit.

Không cần data migration phá hủy. Mongoose tạo collection/index mới; trước Live
cần kiểm tra index build và duplicate conditions trên staging.

## Cấu trúc file dự kiến

### New backend

- `server/src/models/IncomingBankTransaction.js`
- `server/src/models/ProviderSyncCursor.js`
- `server/src/services/sepayBankTransaction.provider.js`
- `server/src/services/bankTransactionIngestion.service.js`
- `server/src/services/bankTransactionSettlement.service.js`
- `server/src/services/sepayReconciliation.service.js`
- `server/src/controllers/sepayWebhook.controller.js`
- `server/src/routes/sepayWebhook.routes.js`
- Targeted unit/integration tests cạnh các layer trên.

### Update backend

- `server/server.js`: mount raw webhook trước global JSON parser; start job.
- `server/src/models/WalletTransaction.js`: reference type mới.
- `server/src/models/DepositRequest.js`: chỉ thêm field/index nếu plan chứng minh
  cần; giữ compatibility.
- `server/src/controllers/adminDeposit.controller.js`
- `server/src/routes/adminDeposit.routes.js`
- `server/src/controllers/deposit.controller.js`
- `server/src/services/walletReconciliation.service.js`
- `server/src/services/depositCron.js`
- `server/src/middlewares/rateLimit.js`
- Env/config validation và `.env.example` phù hợp, không chứa giá trị thật.

### Update frontend

- `client/src/pages/wallet/MyWallet.jsx`
- `client/src/services/wallet.service.js`
- `client/src/queries/walletAccount.queries.js` nếu response/invalidation cần đổi.
- `client/src/pages/admin/DepositManagement.jsx`
- Admin service tương ứng theo convention hiện có.
- `client/src/i18n/locales/vi/account.json`
- `client/src/i18n/locales/en/account.json`
- Targeted query/component tests.

Danh sách cuối được khóa ở implementation plan sau impact trace; không refactor
các file lớn ngoài khu vực cần thiết.

## Code Style

- Route → controller → service → model; provider payload chỉ được hiểu trong
  adapter/normalizer.
- Client component gọi service/TanStack Query, không gọi `api` trực tiếp.
- Money là safe integer VND; không dùng float.
- Transaction/status transition dùng explicit filter và idempotency key.
- Dùng `safeLog`, reason code ổn định và response envelope hiện có.
- Icon mới dùng Lucide; UI theo theme hiện tại và không sửa layout ngoài scope.

## Testing Strategy

### Unit

1. HMAC raw body đúng/sai, timestamp replay, constant-time safe length handling.
2. Normalize payload webhook và API v2 về cùng canonical shape.
3. Parse timezone Việt Nam và exact deposit code.
4. Matching matrix cho account/direction/code/amount/cutover/grace window.
5. Cross-channel reference hash và ambiguous no-reference behavior.

### Backend integration

1. Happy path tạo đúng incoming + một ledger + đúng balance.
2. Cùng webhook gọi nhiều lần chỉ cộng một lần.
3. Webhook và reconciliation cùng giao dịch chỉ cộng một lần.
4. Hai provider transactions thật cùng code/amount cộng hai lần.
5. Đúng code sai amount; đúng amount sai code; thiếu code; quá grace đều review.
6. Transaction trong 24 giờ sau expiry tự cộng; ngoài 24 giờ không cộng.
7. Admin approve mismatch cộng actual amount đúng một lần.
8. Admin/webhook concurrency không tạo double ledger/lost update.
9. Reversal theo incoming transaction tạo đúng một entry đối ứng.
10. Existing manual deposit approval/reversal vẫn backward compatible.
11. Wallet reconciliation hiểu cả legacy deposit entry và incoming-bank entry.
12. Ownership/admin role/CSRF/rate-limit và payload projection không rò PII.

### Frontend

1. Không còn mutation “Tôi đã chuyển khoản”.
2. “Kiểm tra trạng thái” chỉ refetch, không optimistic balance.
3. Polling bật/tắt đúng state; expired grace copy đúng.
4. Multiple settlements hiển thị count/total và hai ledger entries.
5. Admin filter/review/approve/reverse có loading/error/disabled/confirm states.

### Staging/Sandbox smoke

1. SePay Test mode gửi signed webhook tới staging.
2. Simulate đúng code/amount → một credit.
3. Replay delivery → không thêm credit.
4. Simulate hai transactions → hai credits.
5. Disable webhook delivery, chạy reconciliation → credit bị thiếu được bổ sung.
6. Mismatch vào admin queue; approve/reverse được audit.

Không dùng tiền thật trong test. Live enable là bước vận hành riêng sau GO.

## Boundaries

### Always

- Backend/ledger là nguồn sự thật.
- HMAC raw body, expected account, amount/code/time validation.
- Database unique constraints và transaction-safe ledger.
- Manual review cho mọi trường hợp không chắc chắn.
- Test sandbox trước staging/live cutover.
- Audit admin mutation và mask dữ liệu ngân hàng.

### Ask first

- Bật automation Live hoặc gọi API bằng token Live.
- Backfill giao dịch trước cutover.
- Thay 24-hour grace, matching rule hoặc actual-amount approval rule.
- Chạy migration/index build trên staging/production.
- Thêm dependency/queue trả phí hoặc đổi provider.

### Never

- Tin payload không xác thực hoặc dùng parsed/re-serialized body để verify HMAC.
- Dựa vào nút frontend để cộng tiền.
- Credit theo amount do frontend gửi.
- Fuzzy-match code rồi auto-credit.
- Log/commit token, signature, raw account/content/payload.
- Xóa/sửa ledger entry đã thành công.
- Tự động backfill lịch sử khi chưa map được manual approvals cũ.

## Success Criteria

- Đúng mã + đúng tiền trong window tự cộng mà không cần admin.
- Retry/replay/cross-channel duplicate tạo tối đa một credit.
- Hai giao dịch thật tạo hai credits.
- Mismatch/out-of-window không đổi balance và xuất hiện trong admin review.
- Giao dịch bị mất webhook được reconciliation bổ sung an toàn.
- Customer UI không còn nút tự xác nhận, không optimistic balance.
- Admin có thể approve actual amount và reverse từng giao dịch với audit.
- Legacy deposit/ledger vẫn đọc và xử lý được.
- Targeted tests, client lint/build, financial boundary scan, secret scan và
  `git diff --check` pass.
- SePay Sandbox smoke pass trước khi đề xuất bật Live.

## Quyết định đã duyệt ngày 2026-08-15

1. Chọn SePay làm provider đầu tiên và TPBank cá nhân là tài khoản nhận.
2. Không backfill: deposit/giao dịch trước cutover vẫn duyệt tay.
3. Admin duyệt sai số tiền sẽ cộng đúng số tiền thực ngân hàng nhận.
4. Target gói SePay FREE có HMAC Webhook và API v2. Bảng giá SePay tại ngày duyệt
   công bố 0đ/tháng, 50 giao dịch tiền vào/tháng, hỗ trợ Webhook/API và TPBank.
5. Nếu vượt 50 giao dịch tiền vào, provider có thể tính phí vượt mức. Vì tài
   khoản cá nhân có thể nhận tiền ngoài HTCOACHING, owner phải kiểm tra usage và
   đơn giá thực tế trên SePay Dashboard trước khi bật Live.
6. Dùng API v2 làm reconciliation bắt buộc cho Live; nếu Dashboard không cấp
   token thì rollout dừng ở Sandbox/degraded, không âm thầm chạy webhook-only.

## Provider references

- HMAC/raw body/replay window:
  <https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc>
- Webhook payload/response/idempotency:
  <https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook>
- Reconciliation strategy/rate limit:
  <https://developer.sepay.vn/vi/sepay-webhooks/doi-soat-giao-dich>
- SePay API v2 transaction list:
  <https://developer.sepay.vn/vi/sepay-api/v2/giao-dich/danh-sach>
- SePay Test mode:
  <https://developer.sepay.vn/vi/sepay-webhooks/test-mode/bat-dau-nhanh>
