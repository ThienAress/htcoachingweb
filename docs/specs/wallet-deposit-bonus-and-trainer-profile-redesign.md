# Spec: Thưởng nạp ví theo bậc và thiết kế lại Profile HLV

## Objective

Thiết kế lại trang Ví theo tone sáng, hiển thị ba bậc thưởng TPBank và modal QR rõ
ràng sau khi tạo hóa đơn. Tỷ lệ thưởng phải do backend quyết định, Admin có thể sửa
ba tỷ lệ từ trang Quản lý nạp tiền, còn mỗi hóa đơn giữ snapshot để thay đổi chính
sách sau này không làm đổi quyền lợi đã hiển thị cho khách.

Thiết kế lại trang Profile HLV dựa trên ngôn ngữ hình ảnh của `mau4-final.html`
(mẫu 3) và cách kể chuyện kết quả khách hàng của `mau1-final.html` (mẫu 1). Toàn bộ
nội dung, dữ liệu, hành vi, bản dịch, SEO và liên kết hiện có được giữ nguyên; file
mẫu chỉ là tham khảo UI và không được đưa vào runtime.

## Assumptions đã được duyệt

1. Ba thẻ nạp tiền là ba bậc của cùng tài khoản TPBank, không phải ba ngân hàng.
2. Backend tự chọn bậc cao nhất mà số tiền đủ điều kiện; khách không chọn thủ công.
3. Mốc bậc cố định là 10.000đ, 100.000đ và 200.000đ; số tiền tối đa là
   1.000.000.000đ. Admin chỉ sửa tỷ lệ thưởng, mặc định lần lượt 10%, 15%, 20%.
4. Ba tỷ lệ Admin lưu phải là số nguyên từ 0–100 và không giảm theo bậc tiền.
5. `DepositRequest.amount` tiếp tục là số tiền khách phải chuyển. Hóa đơn mới lưu
   `bonusRate`, `bonusAmount`, `creditedAmount`, `bonusTierKey` và `policyVersion`
   dưới dạng snapshot server-authoritative.
6. Chỉ giao dịch khớp chính xác số tiền hóa đơn nhận snapshot thưởng. Incoming bank
   transaction sai số tiền vẫn đi qua review hiện có và khi Admin duyệt chỉ cộng số
   tiền thực nhận, không cộng thưởng.
7. Deposit cũ thiếu snapshot được đọc tương thích như 0% thưởng và
   `creditedAmount === amount`; không backfill và không cần chạy migration.
   Validator lưu document lịch sử không được phụ thuộc min tạo hóa đơn mới, để một
   deposit 5.000đ cũ vẫn có thể chuyển trạng thái mà không fail validation.
8. Profile HLV dùng một layout HT Signature thống nhất trong đợt này; không thêm
   upload HTML, JavaScript hoặc `.fig`, không thêm page builder và không đổi schema
   Trainer.
9. Không deploy, restart hoặc ghi dữ liệu staging/production trong implementation.

## Tech Stack liên quan

- React 19, Vite 8, Tailwind CSS 4, TanStack Query 5 và React i18next.
- Express 5, Mongoose 9 và MongoDB transactions cho Wallet ledger.
- SePay incoming transaction, append-only `WalletTransaction` và audit log hiện có.
- Vitest, Supertest và MongoDB Memory Server cho contract tài chính.

## Contract nạp ví

Public policy response giữ envelope hiện tại và mở rộng dữ liệu:

```json
{
  "success": true,
  "data": {
    "currency": "VND",
    "minAmount": 10000,
    "maxAmount": 1000000000,
    "policyVersion": 1,
    "tiers": [
      { "key": "starter", "minAmount": 10000, "bonusRate": 10 },
      { "key": "growth", "minAmount": 100000, "bonusRate": 15 },
      { "key": "premium", "minAmount": 200000, "bonusRate": 20 }
    ]
  }
}
```

Worked examples dùng số nguyên VND:

- 10.000đ → thưởng 1.000đ → cộng ví 11.000đ.
- 100.000đ → thưởng 15.000đ → cộng ví 115.000đ.
- 200.000đ → thưởng 40.000đ → cộng ví 240.000đ.
- 1.000.000.000đ → thưởng theo bậc cao nhất đang có hiệu lực.

Nếu phép tính phần trăm không ra số nguyên, bonus làm tròn xuống bằng `Math.floor`;
ví dụ 99.999đ ở mức 10% nhận 9.999đ và tổng cộng ví là 109.998đ. Frontend và
backend phải dùng cùng quy tắc nhưng backend vẫn là nguồn sự thật.

Admin cập nhật đồng thời ba tỷ lệ trong một mutating request có `protect`, role
`admin`, CSRF và financial rate limit. Policy version tăng khi dữ liệu thực sự đổi;
mọi hóa đơn đã tạo tiếp tục dùng snapshot cũ.

Manual approve theo `DepositRequest` và auto settlement đúng amount cộng
`creditedAmount`. Reversal phải đảo đúng ledger amount đã cộng, không suy lại từ
policy hiện tại. Incoming mismatch được duyệt thủ công tiếp tục cộng actual bank
amount theo contract SePay hiện hữu và không có bonus.

Incoming đúng amount nhưng bị đưa vào review vì lý do khác như ngoài cửa sổ tự động
vẫn nhận snapshot thưởng khi Admin liên kết/duyệt đúng DepositRequest. Điều kiện
no-bonus chỉ phụ thuộc amount mismatch, không phụ thuộc việc auto hay manual settle.

Một `DepositRequest` có thể nhận nhiều giao dịch ngân hàng thật như contract SePay
hiện tại. Mỗi incoming transaction khớp chính xác amount nhận cùng snapshot bonus;
reversal một giao dịch chỉ đảo ledger của giao dịch đó, và deposit chỉ chuyển
`reversed` khi không còn credit nào hoạt động.

## Contract UI Ví và Admin

- Trang Ví dùng nền sáng, một luồng tạo hóa đơn trực tiếp thay vì modal nhập tiền tối.
- Ba thẻ TPBank hiển thị mốc tối thiểu, tối đa, tỷ lệ và ví dụ quyền lợi; thẻ phù hợp
  nhất với amount đang nhập được highlight tự động.
- Form hiển thị preview số tiền chuyển, tiền thưởng và tổng cộng ví trước khi submit.
- Sau submit mở modal QR gồm trạng thái, countdown, QR, ngân hàng, chủ tài khoản, số
  tài khoản, nội dung, số tiền yêu cầu, tiền thưởng và thực nhận; các nút copy có
  accessible label và feedback.
- Lịch sử nạp hiển thị amount, bonus và credited amount từ snapshot/read model.
- Admin có ba card tỷ lệ ở đầu trang Quản lý nạp tiền, validation inline, trạng thái
  loading/error/disabled/success và cảnh báo chính sách chỉ áp dụng hóa đơn mới.

## Contract UI Profile HLV

- Hero lấy bố cục card profile hai cột của mẫu 3 nhưng dùng dữ liệu thật hiện có.
- Kết quả khách hàng lấy cách kể chuyện nổi bật của mẫu 1, render từ customer stories
  đã gắn Trainer; mobile chuyển sang danh sách một cột không cần marquee/glitch.
- Giữ gallery, title/headline, motto, training style, stats, achievements,
  specialties, certifications, social links, video, methodologies, customer stories,
  FAQ, CTA, internal links, i18n và structured data hiện có.
- Không tự thêm rating, số lượt đánh giá, verified badge, thời gian phản hồi, tình
  trạng nhận học viên hoặc cam kết kết quả khi model không có dữ liệu.
- Section không có dữ liệu tiếp tục ẩn; preview Admin tiếp tục render từ form chưa lưu.
- Icon mới dùng Lucide, có focus state, semantic heading, contrast phù hợp và tôn
  trọng `prefers-reduced-motion`.

## Cấu trúc file bị ảnh hưởng

- Wallet policy/model/service/controller/routes, DepositRequest snapshots, settlement,
  incoming approval/reversal, reconciliation và audit log phía server.
- Wallet/Admin services, policy normalizer/query, `MyWallet`, `DepositManagement`,
  i18n và targeted tests phía client.
- `TrainerProfile.jsx` cùng các component section được tách nhỏ và test presentation.
- Không đổi public route, sitemap, prerender entry, Trainer schema hoặc auth contract.

## Testing Strategy

- Pure policy tests cho boundary, chọn bậc cao nhất, bonus integer và policy update.
- Integration tests cho public/admin policy auth+CSRF, snapshot lúc tạo deposit,
  auto/manual credit, mismatch không bonus, idempotency và reversal đúng credited amount.
- Regression tests cho legacy DepositRequest không có snapshot.
- Client tests cho policy response, preview bonus và selection bậc.
- Client lint/build, UI audit regression gate, financial boundary scan, secret scan,
  agent validation và `git diff --check`.

## Boundaries

### Always

- Backend và append-only ledger là nguồn sự thật; frontend chỉ preview.
- Mọi amount/rate/bonus là safe integer; không dùng float cho giá trị VND.
- Giữ ownership, Admin role, CSRF, rate limit, transaction và idempotency hiện có.
- Snapshot hóa đơn và reversal dựa trên ledger gốc.
- Giữ nguyên nội dung HLV hiện có và SEO structured data.

### Ask first

- Đổi mốc tiền, cho phép tỷ lệ giảm theo bậc hoặc cho Admin sửa min/max.
- Backfill deposit cũ, migration/index trên staging/production hoặc bật policy live.
- Cho upload/running HTML, CSS, JavaScript, `.fig` hoặc thêm page builder.
- Deploy/restart production.

### Never

- Tin bonus do frontend gửi hoặc tính lại hóa đơn cũ bằng policy mới.
- Cộng bonus cho incoming transaction sai số tiền hóa đơn.
- Sửa/xóa ledger entry đã ghi hoặc làm mất audit trail.
- Copy tên, mã khách hàng, rating, claim hoặc nội dung từ file mẫu.
- Hardcode credential hoặc log dữ liệu ngân hàng/PII thô.

## Requirements và Success Criteria

### REQ-001 — Chính sách thưởng nạp tiền server-authoritative

- AC-001: Ba mốc cố định 10.000/100.000/200.000đ có tỷ lệ mặc định
  10/15/20%; backend luôn chọn bậc cao nhất đủ điều kiện và từ chối amount ngoài
  10.000đ–1 tỷ đồng.
- AC-002: Admin chỉ cập nhật đồng thời ba tỷ lệ số nguyên 0–100, không giảm theo
  bậc; thay đổi thật tăng version và tạo audit, no-op không tăng version/audit.

### REQ-002 — Snapshot hóa đơn và tương thích dữ liệu cũ

- AC-003: Hóa đơn mới lưu `bonusRate`, `bonusAmount`, `creditedAmount`,
  `bonusTierKey`, `policyVersion`; đổi policy sau đó không thay đổi hóa đơn cũ.
- AC-004: Deposit legacy thiếu snapshot vẫn đọc, lưu và settlement được với 0%
  bonus, không cần migration/backfill và không nhận thưởng hồi tố.

### REQ-003 — Settlement, reversal và reconciliation đúng số tiền

- AC-005: Exact auto/manual settlement cộng đúng frozen `creditedAmount` một
  lần; amount mismatch chỉ cộng tiền thực nhận và không thưởng.
- AC-006: Reversal đảo đúng original ledger amount, fail closed khi ledger sai,
  và deposit hybrid/multiple incoming chỉ thành `reversed` sau khi mọi credit đã đảo.
- AC-007: Read model và reconciliation phân biệt transfer, bonus và credited
  amount, đồng thời giữ contract legacy.

### REQ-004 — Trải nghiệm Ví và Admin

- AC-008: UI Ví tone sáng, responsive, tự highlight bậc phù hợp và preview tiền
  chuyển/thưởng/tổng cộng trước khi tạo hóa đơn.
- AC-009: Modal QR hiển thị snapshot server, copy/status controls và đủ keyboard,
  focus, loading/error/disabled states; lịch sử hiển thị breakdown bonus.
- AC-010: Admin có ba card tỷ lệ với validation inline, atomic save và cảnh báo
  thay đổi chỉ áp dụng cho hóa đơn mới.

### REQ-005 — Profile HLV theo thiết kế đã duyệt

- AC-011: Profile dùng presentation mẫu 3 và cách kể customer result mẫu 1,
  giữ dữ liệu thật, i18n, preview, SEO, CTA, internal links và conditional sections.
- AC-012: Không copy nội dung mẫu hoặc tạo rating/badge/claim giả; UI responsive,
  accessible và tôn trọng reduced motion.

### REQ-006 — Verification và rollout boundary

- AC-013: Focused/full tests, client lint/build, UI, security, agent và diff gates
  có kết quả được ghi nhận; E2E được chạy khi đủ môi trường hoặc ghi rõ lý do skip.
- AC-014: Không deploy, restart, migration, backfill hoặc ghi staging/production
  trong implementation này; rollout giữ `NOT STARTED`.

## Open Questions

Không còn. User đã duyệt triển khai và xác nhận nguyên tắc chỉ lấy UI mẫu ngày
2026-09-05.
