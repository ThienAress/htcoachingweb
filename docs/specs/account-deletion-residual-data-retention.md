# Policy draft: Retention và pseudonymization sau xóa tài khoản

## Trạng thái

- **Enforcement:** tắt; tài liệu này không cho phép chạy cleanup, backfill hoặc migration.
- **Owner decision:** còn thiếu phê duyệt thời hạn lưu trữ và legal hold.
- **Phạm vi:** các collection được `accountDeletion.service.js` chủ động giữ lại sau khi
  tài khoản bị xóa.
- Đây là policy kỹ thuật để giảm dữ liệu nhận dạng; không thay thế tư vấn kế toán hoặc
  pháp lý theo từng loại chứng từ thực tế của HTCOACHING.

## Mục tiêu và invariants

1. Không phá ledger, đối soát, hợp đồng đã ký, refund/reversal hoặc chuỗi audit.
2. Không giữ direct identifier chỉ vì thuận tiện cho truy vấn.
3. Legal hold luôn thắng retention deadline và phải có owner, lý do, ngày review.
4. Pseudonymization phải deterministic trong cùng policy version để điều tra chéo collection,
   nhưng không thể đảo ngược nếu không có secret tách biệt khỏi database.
5. Mọi enforcement phải dry-run, idempotent, resumable và fail closed; không dùng TTL index
   cho ledger/hợp đồng/audit append-only.

## Inventory và xử lý đề xuất

| Nhóm | Collections | Giữ nguyên trong retention window | Pseudonymize khi account deletion được commit |
| --- | --- | --- | --- |
| Financial ledger | `depositRequests`, `wallets`, `walletTransactions`, `incomingBankTransactions` | amount, currency, status, timestamps, balance snapshots, provider/reference digests, reversal graph | thay `userId` bằng subject surrogate; scrub free-form `metadata`, `reviewNote`, `rejectReason`, `reverseReason`; chỉ giữ account number đã mask |
| Commercial/legal | `orders`, `contracts` | package/session/amount/status/timestamps, contract state, signed artifact hash và evidence tối thiểu được owner duyệt | xóa `name`, `email`, `phone`, address/gym/schedule/note; tách/redact chữ ký, IP, user-agent và free-form contract content khi không còn bắt buộc giữ |
| Subscription | `fitnessSubscriptions`, `trainerSubscriptions` | plan, billing cycle, amount, lifecycle và policy snapshot | thay `userId` bằng subject surrogate; xóa `normalizedEmail`, cancel reason và free-form metadata không cần thiết |
| Operational audit | `auditLogs`, `trainerTransfers` | action/outcome, target type, timestamps, affected/retained counts, capacity/idempotency evidence | thay actor/target/client/trainer IDs bằng surrogate; xóa IP/user-agent sau investigation window; allowlist metadata và redact transfer reason |

`AccountDeletionRecord` tiếp tục lưu counts và policy version, không lưu email, tên, payload
gốc hoặc mapping từ surrogate về user.

## Retention clocks cần owner phê duyệt

| Policy key | Clock bắt đầu | Đề xuất kỹ thuật | Trạng thái |
| --- | --- | --- | --- |
| `financial_legal` | ngày giao dịch/đối soát/hợp đồng kết thúc muộn nhất | 10 năm; có thể dài hơn khi legal hold hoặc loại chứng từ yêu cầu | **PENDING OWNER/LEGAL APPROVAL** |
| `operational_audit` | `createdAt` của audit/transfer | 24 tháng; IP/user-agent tối đa 90 ngày nếu không có incident hold | **PENDING OWNER APPROVAL** |
| `account_deletion_record` | ngày hoàn tất xóa tài khoản | bằng cửa sổ dài nhất còn liên quan, sau đó chỉ giữ aggregate không nhận dạng | **PENDING OWNER APPROVAL** |

Không hardcode các số trên vào schema/job trước khi decision được ghi thành ADR hoặc policy
version canonical. Cho tới lúc đó, behavior an toàn là **retain + report deferred boundary** như
implementation hiện tại.

## Thiết kế enforcement sau khi được duyệt

1. Thêm policy version và deadline nullable; document cũ mặc định `null` để không tự xóa.
2. Dùng HMAC subject surrogate với key chuyên biệt, versioned và không dùng chung
   `LOG_HASH_SECRET`; output phải tương thích field/index được migration thiết kế rõ.
3. Tạo read-only inventory report theo collection/field/policy version, không xuất raw PII.
4. Viết migration staging có target lock, explicit confirmation, duplicate/index preflight và
   post-verify; production cần backup snapshot + approval ID riêng.
5. Pseudonymize theo transaction boundary khả dụng; ledger append-only cần migration path được
   review riêng, không gọi model update hook thông thường để lách invariant.
6. Chạy staging canary trên synthetic accounts, kiểm tra refund/reversal, contract download,
   admin audit search và trainer transfer history trước production.
7. Production rollout theo batch nhỏ, có checkpoint và stop-on-error; không tự động xóa signed
   artifact cho tới khi legal owner xác nhận retention class của artifact đó.

## Acceptance gate

- Có owner ký duyệt ba retention clocks và legal-hold process.
- Có field-level allowlist cho mọi `Mixed`/free-form field.
- Có tests chứng minh không còn direct identifier sau pseudonymization và ledger vẫn cân bằng.
- Có backup/restore evidence, dry-run counts, staging canary và rollback/runbook.
- `ACCOUNT_DELETION_DEFERRED_BOUNDARIES` chỉ được gỡ khi migration production đã verify;
  không gỡ chỉ vì code đã merge.
