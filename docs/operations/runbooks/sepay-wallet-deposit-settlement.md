# SePay Wallet Deposit Settlement Runbook

## Phạm vi

Runbook này vận hành luồng tự động ghi nhận tiền vào TPBank qua SePay, khớp
`DepositRequest` và tạo bút toán ví. Tiền vẫn đi thẳng vào tài khoản ngân hàng;
SePay chỉ cung cấp webhook và API đối soát.

Nguồn chính thức cần kiểm tra lại trước mỗi lần thay đổi gói hoặc API:

- [Bảng giá SePay](https://sepay.vn/bang-gia.html)
- [SePay API v2 — danh sách giao dịch](https://developer.sepay.vn/vi/sepay-api/v2/giao-dich/danh-sach)
- [Xác thực webhook HMAC-SHA256](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc)
- [SePay Test mode](https://developer.sepay.vn/vi/tien-ich-khac/test-mode/han-muc)

Tại ngày 2026-08-15, trang giá công khai ghi gói FREE là 0đ/tháng, gồm 50 giao
dịch/tháng, Webhook và API; vượt hạn mức có thể bị tính phí. Đây là thông tin
ngoài hệ thống, phải kiểm tra lại trên Dashboard/bảng giá trước khi bật Live.

## Trạng thái triển khai an toàn

Code có thể deploy khi `SEPAY_ENABLED=false`. Ở trạng thái này:

- webhook trả fail-closed và không ghi giao dịch;
- reconciliation job không gọi API;
- flow duyệt nạp tiền legacy vẫn hoạt động;
- không cần khai báo secret SePay.

Không bật automation trước khi index migration, Sandbox acceptance và cutover đã
được duyệt.

## Cấu hình server-only

Không commit, log hoặc gửi các giá trị sau qua frontend:

| Biến | Mục đích |
|---|---|
| `SEPAY_ENABLED` | Kill switch chung |
| `SEPAY_MODE` | `sandbox` ở staging, `live` ở production |
| `SEPAY_WEBHOOK_SECRET` | Secret HMAC của webhook, tối thiểu 32 ký tự |
| `SEPAY_DATA_HASH_SECRET` | HMAC key nội bộ để hash account/reference |
| `SEPAY_API_TOKEN` | Bearer token API v2, chỉ cần khi reconciliation bật |
| `SEPAY_AUTOMATION_CUTOVER_AT` | ISO timestamp; không auto-credit lịch sử cũ |
| `SEPAY_RECONCILIATION_ENABLED` | Bật/tắt API fallback độc lập |
| `SEPAY_RECONCILIATION_INTERVAL_MS` | Chu kỳ production, mặc định 5 phút |
| `BANK_ACCOUNT` | Tài khoản TPBank đích dùng exact match |

Production readiness chỉ yêu cầu các secret khi `SEPAY_ENABLED=true`. Staging
từ chối `SEPAY_MODE=live` và tiếp tục bắt buộc `BACKGROUND_JOBS_ENABLED=false`.

Không rotate `SEPAY_DATA_HASH_SECRET` khi automation đang bật nếu chưa có kế
hoạch migration/dual-read được duyệt. Secret này tạo identity hash cho account,
bank reference và cursor; đổi trực tiếp có thể làm mất liên kết dedupe giữa dữ
liệu cũ và giao dịch mới. Có thể rotate `SEPAY_WEBHOOK_SECRET`/`SEPAY_API_TOKEN`
theo quy trình của provider, nhưng phải kiểm tra webhook/reconciliation ngay sau
khi đổi và không ghi giá trị secret vào log hoặc ticket.

## Cấu hình webhook trên SePay

1. Tạo webhook JSON cho giao dịch tiền vào của đúng tài khoản TPBank.
2. URL: `<PUBLIC_API_ORIGIN>/api/webhooks/sepay`.
3. Chọn HMAC-SHA256 và lưu secret ngay khi tạo.
4. Bật retry khi endpoint trả lỗi.
5. Không bật “bỏ qua giao dịch không có mã”: tiền sai/thiếu mã phải vào hàng chờ
   admin thay vì biến mất khỏi hệ thống.
6. Không dùng webhook không xác thực hoặc API Key thay cho HMAC trong Live.

Endpoint xác minh raw body, `X-SePay-Signature`, `X-SePay-Timestamp` ±5 phút,
account, direction, amount và mã nạp trước khi tác động ví.

## Index preflight và apply

Các lệnh chỉ chạy khi target/database lock và confirmation hợp lệ. Không chạy
trên staging/production nếu chưa có phê duyệt riêng.

```text
npm run preflight:sepay-wallet-indexes:staging --prefix server
npm run migrate:sepay-wallet-indexes:staging --prefix server
npm run preflight:sepay-wallet-indexes --prefix server
npm run migrate:sepay-wallet-indexes --prefix server
```

Apply cần `MIGRATION_TARGET_DATABASE`, confirmation migration, và production còn
cần backup snapshot/approval theo `migrationSafety.js`. Migration chỉ tạo index,
không backfill hoặc sửa số dư.

## Sandbox acceptance

Staging giữ background jobs tắt. Sau khi cấu hình Sandbox và xác nhận target,
chạy reconciliation thủ công:

```text
npm run reconcile:sepay:staging --prefix server
```

Script yêu cầu `APP_ENV=staging`, database staging, `SEPAY_MODE=sandbox`,
`BACKGROUND_JOBS_ENABLED=false` và
`CONFIRM_SEPAY_SANDBOX_RECONCILIATION=yes`.

Test tối thiểu trước Live:

1. Đúng mã + đúng tiền: cộng đúng một lần.
2. Gửi lại cùng webhook: không cộng thêm.
3. Hai giao dịch mô phỏng khác ID, cùng mã/số tiền: cộng hai lần.
4. Đúng mã + sai tiền: `needs_review`, ví không đổi.
5. Sai/thiếu mã: `needs_review`, ví không đổi.
6. Webhook lỗi rồi API v2 thấy giao dịch: reconciliation chỉ cộng một lần.
7. Giao dịch trước cutover hoặc deposit tạo trước cutover: chỉ review.
8. Giao dịch sau `expiresAt + 24h`: chỉ review.
9. Admin approve cộng số tiền ngân hàng thực nhận; replay không cộng lại.
10. Admin reverse tạo ledger đối ứng cho đúng incoming transaction.

Không dùng chuyển khoản thật để smoke test Sandbox.

## Bật Live

1. Deploy code với `SEPAY_ENABLED=false`.
2. Hoàn tất production index preflight/apply theo approval riêng.
3. Xác minh webhook HTTPS, HMAC, TPBank account và API token.
4. Chọn `SEPAY_AUTOMATION_CUTOVER_AT` ngay trước thời điểm bật.
5. Đặt `SEPAY_MODE=live`, `SEPAY_ENABLED=true`; chỉ đặt
   `SEPAY_RECONCILIATION_ENABLED=true` khi API token đã được kiểm tra.
6. Production phải có `BACKGROUND_JOBS_ENABLED=true` để reconciliation chạy.
7. Theo dõi sát webhook/admin queue/ledger trong 30 phút đầu.

Không backfill. Deposit và giao dịch trước cutover vẫn do admin xử lý thủ công.

## Theo dõi và cảnh báo

Theo dõi các counter:

- `financial.sepay_webhook_received`
- `financial.sepay_webhook_auth_failed`
- `financial.sepay_webhook_duplicates`
- `financial.sepay_auto_settled`
- `financial.sepay_needs_review`
- `financial.sepay_reconciliation_imported`
- `financial.sepay_reconciliation_failures`
- `financial.reconciliation_mismatches`

Kiểm tra SePay Dashboard hàng tuần khi gần 50 giao dịch/tháng. TPBank cá nhân có
thể nhận khoản tiền ngoài HTCOACHING; các giao dịch này vẫn tiêu thụ quota và có
thể xuất hiện trong hàng review.

## Xử lý sự cố

### Khách bị trừ tiền nhưng ví chưa cộng

1. Không yêu cầu khách chuyển lại ngay.
2. Kiểm tra hàng “Giao dịch ngân hàng” theo thời gian/số tiền/mã đã mask.
3. Kiểm tra reconciliation failure và cursor; không chỉnh cursor trực tiếp.
4. Nếu giao dịch đúng nhưng mismatch, admin link deposit rồi approve số tiền
   thực nhận.
5. Chỉ sửa số dư qua flow approve/reversal; không update `Wallet.balance` tay.

### Webhook trả 401

Kiểm tra HMAC method, raw JSON body, secret và đồng hồ/NTP. Không nới cửa sổ
replay hoặc tắt signature để chữa tạm.

### API trả 429 hoặc lỗi mạng

Worker tôn trọng `Retry-After`, gọi tuần tự không quá 3 request/giây và giữ cursor
ở giao dịch durable cuối. Không tạo nhiều worker thủ công song song.

### Nghi cộng trùng

Chạy wallet reconciliation read-only, kiểm tra source aliases, canonical hash và
ledger idempotency key. Nếu cần hoàn tác, reverse đúng incoming transaction;
không xóa ledger hoặc incoming record.

## Rollback

1. Đặt `SEPAY_ENABLED=false` để dừng webhook ingestion và reconciliation.
2. Giữ nguyên collections, indexes, cursor và ledger để điều tra.
3. Tiếp tục duyệt legacy/manual nếu cần.
4. Không tự reverse các khoản đã cộng hợp lệ chỉ vì tắt integration.
5. Nếu rollback do sai settlement, dùng transaction-specific admin reversal có
   lý do audit.

## Dữ liệu không được xuất hiện trong log/ticket

- API token, webhook/data-hash secret;
- raw account number, raw reference/content, raw webhook body;
- cookie/JWT/CSRF token;
- ảnh hoặc dữ liệu định danh khách hàng không cần thiết.
