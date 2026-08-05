# Plan 026A: Giới hạn chi phí Meal Scan và mặc định mock ở development

> **Hướng dẫn thực thi**: Giữ toàn bộ privacy/CSRF/upload boundary của Plan 026. Không deploy,
> không gọi Gemini live và không thay đổi wallet. AI Studio spend cap chỉ được ghi sau khi owner
> phê duyệt chính xác số tiền và đúng billing project.

## Status

- **Execution**: IMPLEMENTED / LOCAL VERIFIED — AI STUDIO CAP AMOUNT PENDING
- **Priority**: P1
- **Effort**: S
- **Risk**: HIGH (provider cost và customer image boundary)
- **Depends on**: 026
- **Category**: security / cost-control / API / tests
- **Planned at**: 2026-08-04

## Why This Matters

Quota 10 lượt/giờ cho tài khoản có thể tạo tối đa khoảng 240 provider calls/ngày/user. Development
đang nhận `AI_PROVIDER=gemini` từ runtime nên ảnh local chạm safety gate thay vì dùng mock. Contract
mới giới hạn tài khoản ở 10 lượt/24 giờ, giữ anonymous 2 lượt/24 giờ, không debit ví và mặc định
Meal Scan mock ngoài production.

## Scope

**In scope**:

- Authenticated Meal Scan: 10 lượt/24 giờ/user; anonymous giữ 2 lượt/24 giờ/IP.
- Vượt quota trả `429`, không gọi provider và không tạo `WalletTransaction`.
- Non-production Meal Scan mặc định mock; opt-in Gemini local dùng `MEAL_SCAN_PROVIDER=gemini`.
- Production luôn dùng `AI_PROVIDER=gemini` và Paid Service gate hiện có.
- Cập nhật env validation, vi/en error copy, spec, tests và cost-control runbook.

**Out of scope**:

- Trừ ví, bán lượt, subscription entitlement hoặc thay đổi Mongoose schema.
- Deploy, provider live call, migration hoặc ghi dữ liệu thật.
- Tự chọn hoặc tự ghi AI Studio spend cap khi chưa có số USD owner duyệt.

## Steps

### Step 1: Khóa contract bằng test

Thêm integration test cho 10 lượt authenticated trong 24 giờ, lượt 11 trả `429`, provider chỉ
được gọi 10 lần và wallet ledger rỗng. Thêm service test cho non-production mock mặc định dù
`AI_PROVIDER=gemini`.

### Step 2: Sửa provider selection và daily limiter

Đổi authenticated window sang 24 giờ, giữ max 10 và cập nhật error copy. Provider selection dùng
mock ngoài production trừ khi `MEAL_SCAN_PROVIDER=gemini`; production bỏ qua dev override.

### Step 3: Re-trace và verification

Chạy focused server/config tests, Meal Scan E2E, client lint/build, secret/data-boundary scan và
`git diff --check`. Cập nhật spec/operations evidence.

### Step 4: AI Studio spend cap

Sau khi owner duyệt mức USD và xác nhận đúng project/billing account, đặt project-level monthly
spend cap trong AI Studio rồi ghi evidence không chứa billing PII. Đây là external-state gate riêng.

## Done Criteria

- [x] Anonymous 2/24h và authenticated 10/24h được test bằng response headers/status.
- [x] Lượt bị `429` không gọi provider và không debit ví.
- [x] Development mặc định mock; production không thể dùng mock override.
- [x] Focused tests, E2E, lint/build và security checks pass.
- [x] Không deploy/provider live/wallet mutation.
- [x] Spend cap đã được owner duyệt và đặt đúng project, hoặc status ghi rõ pending.

## Verification Evidence

- TDD RED xác nhận ba mismatch: authenticated policy w=3600, dev gọi Gemini và production
  readiness chấp nhận limit 11.
- GREEN: focused backend/config 3 files, 25/25 tests pass.
- Authenticated test: 10 responses 200, lượt 11 trả 429, provider gọi đúng 10 lần và
  WalletTransaction count bằng 0.
- Development mock và production-ignore-dev-override đều có unit test.
- Meal Scan E2E Chromium 6/6 pass; i18n JSON và scoped ESLint pass.
- Vite production compile pass; secret scan và repository data-boundary pass.
- Không deploy, không gọi provider live và không mutation wallet/billing.
- AI Studio project spend cap chưa đặt vì owner chưa duyệt mức USD; status giữ pending rõ ràng.

## STOP Conditions

- Cần thay đổi wallet/payment/schema để giới hạn quota.
- Cần nới Paid Service/customer-image privacy gate.
- Chưa có số tiền hoặc không xác định được đúng AI Studio billing project.

## Maintenance Notes

- Memory limiter là per-process; horizontal scaling cần shared privacy-reviewed store.
- `MEAL_SCAN_PROVIDER` chỉ là dev/test override; production provider do `AI_PROVIDER` quyết định.
- Nếu sau này bán thêm lượt, cần spec thương mại, consent, balance check, idempotent ledger và refund
  contract riêng; không gắn ngầm vào quota hiện tại.
