# Phase 6 - Financial integrity, state machines và reconciliation

Ngày chốt: 2026-07-19

## Kết luận

Phase 6 đã hoàn thành phần financial integrity có thể xử lý an toàn trong
codebase. Deposit, wallet ledger, trainer subscription, order và contract không
còn dùng hard-delete hoặc read-then-write ở những transition có thể làm mất dấu
vết tài chính.

Kết quả cuối:

- Server unit/integration: 96/96 tests pass trên 19 test files.
- Client unit: 85/85 tests pass trên 5 test files.
- Client lint: 0 warning, 0 error.
- Production build, 20-route prerender và bundle budget: pass.
- Chromium E2E: 37/37 pass.
- Chromium + Firefox + WebKit: 111/111 pass.
- Migration Phase 6 chạy idempotent hai lần trên MongoMemoryReplSet và
  reconciliation đều trả 0 issue.

Migration và reconciliation chưa được chạy vào Atlas, staging hoặc production.
Không có dữ liệu thật nào bị thay đổi trong phiên local này.

## 1. Wallet ledger

WalletTransaction hiện là ledger append-only:

- Mỗi mutation tạo entry mới; reversal không sửa hoặc xóa entry gốc.
- Model chặn save trên document cũ, update, delete, replace và
  findOneAndReplace.
- Amount, balanceBefore và balanceAfter phải là safe integer VND.
- balanceAfter phải bằng balanceBefore cộng amount và không được âm.
- reversalOf có unique partial index, nên một entry chỉ được reversal một lần.
- Trainer purchase dùng referenceType trainer_subscription thay vì giả làm
  order.

walletLedger.service là write path dùng chung:

- Bắt buộc MongoDB session.
- Kiểm tra idempotency key trước khi ghi.
- Cập nhật Wallet bằng optimistic compare-and-swap trên version và balance.
- Ghi Wallet và WalletTransaction trong cùng transaction.
- Từ chối số dư âm, amount không nguyên và wallet snapshot không hợp lệ.

Wallet.balance vẫn là cache đọc nhanh; WalletTransaction là nguồn sự thật để
đối soát.

## 2. Deposit state machine

Luồng hợp lệ:

pending hoặc needs_review hoặc expired -> success -> reversed

pending hoặc needs_review hoặc expired -> rejected

Chỉ expired và rejected mới được hard-delete.

Các điểm đã sửa:

- Amount chỉ nhận safe integer từ 5.000 đến 100.000.000 VND; string và decimal
  bị từ chối.
- isOpen được derive cho pending/needs_review và có unique partial index theo
  user.
- Confirm dùng atomic findOneAndUpdate với status và expiresAt.
- Approve dùng transaction, CAS transition và idempotency key cố định theo
  deposit.
- Approve lặp trả skipped, không tăng số dư lần hai.
- Reject dùng transaction và CAS.
- Reverse yêu cầu lý do 8-500 ký tự, tạo entry âm tham chiếu entry gốc rồi mới
  đổi trạng thái deposit trong cùng transaction.
- Reverse bị chặn nếu số dư hiện tại không đủ; hệ thống không tự tạo số dư âm.
- Deposit đã success không thể xóa; admin buộc dùng Hoàn tác.
- AuditLog lưu actor, trạng thái, balance trước/sau và các transaction ID.

UI admin hiện chỉ hiển thị:

- Duyệt/Từ chối cho trạng thái mutable.
- Hoàn tác cho success.
- Xóa cho expired/rejected.

User thấy trạng thái Đã hoàn tác và lý do trong lịch sử ví.

## 3. Trainer subscription

Purchase hiện dùng UUID do client tạo và giữ nguyên qua retry:

- Idempotency key là userId + requestId, không còn phụ thuộc subscription ID vừa
  sinh.
- Giá gói vẫn được lấy từ bảng giá server-side.
- Một request lặp trả subscription và balance của lần xử lý đầu.
- Unique partial index bảo đảm tối đa một subscription isActive cho mỗi user.
- Unique userId + purchaseRequestId chặn duplicate purchase ở DB.
- Subscription và debit ledger được tạo trong cùng transaction.
- UI có nút Thử lại và giữ nguyên requestId khi kết quả mạng chưa chắc chắn.

Admin không còn xóa subscription. Endpoint mới chuyển active -> cancelled bằng
CAS, lưu reason/cancelledAt/cancelledBy và giữ nguyên ledger.

Quyết định nghiệp vụ Phase 6: cancel subscription không tự hoàn tiền. Nếu product
cần refund, phải bổ sung command refund riêng với policy về prorate, approval và
reversal ledger; không được gắn refund ngầm vào cancel.

Các entitlement query ở auth, order và MealPlan đã dùng isActive cùng endDate.
Cron expiry đồng bộ cả status và isActive.

## 4. Order và contract

Order:

- Status có enum pending, approved, completed, cancelled.
- sessions/totalSessions là safe integer có bound và sessions không thể lớn hơn
  totalSessions.
- Generic update có transition map, whitelist field và CAS bằng current status
  + updatedAt.
- ApprovedAt được set khi pending -> approved.
- Chỉ pending/cancelled không có check-in hoặc contract mới được xóa.
- Xóa order và ghi AuditLog nằm trong cùng transaction.
- Không còn xóa cascade check-in sau khi order đã bị xóa.

Contract:

- isActive false cho cancelled và expired.
- Cancel dùng atomic state transition; signed contract không thể cancel.
- Chỉ draft contract mới được hard-delete.
- Signed PDF và signed contract không còn bị xóa qua deleteContract.
- Expiry đồng bộ status, isActive và audit trail.

## 5. Reconciliation và observability

walletReconciliation.service kiểm tra:

- Tổng ledger và latest balance snapshot khớp Wallet.balance.
- Chuỗi balanceBefore/balanceAfter liên tục.
- Transaction userId khớp owner của wallet.
- Không có transaction tham chiếu wallet không tồn tại.
- Deposit success có đúng một deposit entry.
- Deposit reversed có đúng một reversal entry với amount đối ứng.
- Trainer subscription có đúng một purchase entry với amount đối ứng.

Script npm run reconcile:wallets:

- Chỉ đọc database.
- Xuất JSON không chứa email, phone hoặc nội dung nhạy cảm.
- Exit code 2 khi có mismatch.
- Có RECONCILE_WALLET_LIMIT và RECONCILE_ISSUE_LIMIT.
- Có ALLOW_LEGACY_TRAINER_REFERENCE=true cho preflight trước migration.

Metrics mới:

- financial.reversals
- financial.conflicts
- financial.idempotency_hits
- financial.reconciliation_mismatches

## 6. Migration Phase 6

File migration:

server/src/migrations/20260719-phase6-financial-integrity.js

Migration có guard CONFIRM_PHASE6_FINANCIAL_MIGRATION=yes và thực hiện:

1. Preflight duplicate open deposit, active subscription và active contract.
2. Preflight order state/session invariant.
3. Reconciliation cho phép trainer reference legacy.
4. Backfill DepositRequest.isOpen.
5. Backfill TrainerSubscription.isActive.
6. Backfill Contract.isActive.
7. Chuyển purchase referenceType legacy từ order sang trainer_subscription.
8. Drop index unique_pending_per_user cũ nếu tồn tại.
9. Tạo các unique partial index Phase 6.
10. Chạy strict reconciliation sau migration.

Migration là deterministic và đã pass khi chạy hai lần trên replica set
in-memory. Migration thật vẫn cần backup, staging và change approval.

## 7. Runbook rollout

Tại staging cô lập:

~~~powershell
$env:ALLOW_LEGACY_TRAINER_REFERENCE = "true"
$env:RECONCILE_WALLET_LIMIT = "100000"
npm run reconcile:wallets
~~~

Nếu preflight có issue, dừng và resolve dữ liệu; không chạy migration.

Sau backup và approval:

~~~powershell
$env:CONFIRM_PHASE6_FINANCIAL_MIGRATION = "yes"
npm run migrate:phase6
~~~

Sau migration:

~~~powershell
Remove-Item Env:ALLOW_LEGACY_TRAINER_REFERENCE -ErrorAction SilentlyContinue
npm run reconcile:wallets
~~~

Điều kiện deploy:

- Reconciliation strict có totalIssues = 0.
- Kiểm tra bốn index mới tồn tại.
- Deploy server trước client.
- Theo dõi financial conflicts, idempotency hits, reconciliation mismatches và
  HTTP 409 trong ít nhất 30 phút.

Rollback:

- Rollback application trước.
- Không drop index trong lúc incident.
- Các field backfill và referenceType mới tương thích ngược ở mức document.
- Chỉ restore database nếu xác nhận corruption; dùng snapshot đã ghi trong
  backup runbook.

## 8. Test coverage Phase 6

Server integration mới kiểm tra:

- Deposit amount decimal/string bị chặn.
- Approve lặp chỉ tạo một credit.
- Success deposit không thể hard-delete.
- Reverse tạo entry đối ứng, giữ entry gốc và retry idempotent.
- Reconciliation sạch và bắt được wallet bị cố ý làm lệch.
- Trainer purchase retry chỉ debit một lần.
- Cancel giữ subscription record và purchase ledger.
- WalletTransaction update bị append-only model chặn.
- Order có check-in không thể xóa.
- Signed contract không thể xóa; draft contract có thể xóa.
- Migration chạy hai lần vẫn sạch.

Browser E2E mới kiểm tra:

- Paid deposit chỉ có Hoàn tác, không có Xóa.
- Reverse bắt buộc nhập reason và gửi đúng endpoint.
- Trainer subscription dùng Hủy gói, không dùng delete.

## 9. Cảnh báo không chặn release

- Production build có lúc timeout khi lấy dynamic sitemap sources và recipes
  trả 404; fallback giữ sitemap 20 routes và build vẫn pass.
- Vite vẫn cảnh báo entry và deferred React PDF trên 500 KB; bundle budget vẫn
  pass.
- Playwright dev server có warning từ Lit/phantom-ui; không có test failure hay
  lỗi console nghiêm trọng.

## 10. File thay đổi trong Phase 6

### Server financial core

- server/src/services/walletLedger.service.js
- server/src/services/walletReconciliation.service.js
- server/src/models/Wallet.js
- server/src/models/WalletTransaction.js
- server/src/models/DepositRequest.js
- server/src/models/TrainerSubscription.js
- server/src/models/AuditLog.js
- server/src/controllers/deposit.controller.js
- server/src/controllers/adminDeposit.controller.js
- server/src/controllers/trainerSubscription.controller.js
- server/src/routes/adminDeposit.routes.js
- server/src/routes/trainerSubscription.routes.js
- server/src/routes/mealplanAccess.routes.js
- server/src/middlewares/auth.middleware.js
- server/src/services/depositCron.js
- server/src/services/subscriptionCron.js
- server/src/observability/metrics.js

### Order và contract

- server/src/models/Order.js
- server/src/models/Contract.js
- server/src/controllers/order.controller.js
- server/src/services/contract.service.js
- server/src/middlewares/validation.js

### Migration, scripts và tests

- server/src/migrations/20260719-phase6-financial-integrity.js
- server/src/scripts/reconcileWallets.js
- server/src/controllers/__tests__/deposit.integration.test.js
- server/src/controllers/__tests__/phase6.financial.integration.test.js
- server/package.json

### Client

- client/src/services/adminDeposit.service.js
- client/src/services/trainerSubscription.service.js
- client/src/pages/admin/DepositManagement.jsx
- client/src/pages/admin/TrainerSubscriberManagement.jsx
- client/src/pages/wallet/MyWallet.jsx
- client/src/pages/account/components/StatusBadges.jsx
- client/src/components/ChatWidget/cards/WalletSummaryCard.jsx
- client/src/sections/Pricing.jsx

### E2E và docs

- e2e/mock-api.cjs
- e2e/deposit-wallet.spec.js
- docs/release-checklist.md
- docs/phase-6-fix-report-2026-07-19.md

## 11. Việc còn phụ thuộc môi trường thật

1. Backup và restore drill trên staging cô lập.
2. Chạy preflight reconciliation với dữ liệu gần production.
3. Resolve mọi legacy mismatch trước migration.
4. Chạy migration có approval và ghi lại output/index list.
5. Chạy strict reconciliation sau migration.
6. Cấu hình dashboard/alert provider cho financial metrics.
7. Chốt product policy nếu cần refund subscription.
