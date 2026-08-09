# Plan 021: Harden mobile AI chat and trainer Free eligibility

> Viết regression test trước thay đổi hành vi; không commit, push hoặc deploy nếu user chưa yêu
> cầu riêng. Drift check các file in-scope trước khi sửa.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 001, 002, 018
- **Category**: bug
- **Planned at**: 2026-08-02
- **Execution**: DONE / LOCAL VERIFIED — MANUAL IOS KEYBOARD PENDING

## Why This Matters

iOS Safari dùng visual viewport riêng khi bàn phím mở nên panel `fixed inset-0` có thể bị lệch và
lộ trang phía sau. AI Chat đang mặc định dark vì preference cũ. Backend mới chống dùng Free hai
lần nhưng chưa chặn học viên đã có Order.

## Current State

- `ChatPanel.jsx`: fallback dark, chưa theo `window.visualViewport`, body chỉ khóa overflow.
- Trainer subscription lifecycle chỉ kiểm tra `TrainerTrialClaim`.
- `Order.userId` optional cho dữ liệu cũ; create flow chuẩn hóa email lowercase.
- Pricing chưa biết trạng thái Free bị chặn vì Order.

## Scope

**In scope**: ChatPanel runtime/tests; trainer lifecycle service/controller/tests; Pricing trainer
Free; locale `vi/en`; plan/index.

**Out of scope**: dead `ChatWidget.jsx`; schema/migration/seed/data write; paid eligibility;
`.vscode/`; commit/push/deploy.

## Steps

### 1. Tạo regression tests

- Theme mặc định light, giữ preference v2 hợp lệ, fallback khi storage lỗi.
- Visual viewport bounds và fallback layout viewport.
- Order theo userId hoặc normalized email chặn Free và không tạo subscription/claim.
- `/my` công bố ineligible; paid purchase vẫn hoạt động.

### 2. Sửa mobile viewport và theme

- Theo dõi `visualViewport.resize/scroll`; mobile dùng `top` + `height`.
- Khóa body bằng `position: fixed`, giữ/khôi phục scroll và inline styles cũ.
- Dùng `ht_chat_theme_v2`, fallback light và chỉ persist giá trị hợp lệ.

### 3. Chặn Free khi đã có Order

- Query theo userId hoặc normalized email; mọi status đều chặn.
- Check trong transaction, trả `409 TRAINER_FREE_ORDER_EXISTS`.
- `/my` trả `{ status: "ineligible", reason: "existing_order" }`.
- Pricing giải thích lý do và không mở Free checkout.

### 4. Verification và cleanup

- Chạy targeted/full unit, lint/build, AI/UI, commercial/security/agent gates.
- Review diff, `git diff --check`, không chạm `.vscode/`, cập nhật evidence.

## Done Criteria

- [x] Chat phủ kín mobile visual viewport và mặc định light.
- [x] Backend/UI chặn Free khi user từng có bất kỳ Order nào.
- [x] Paid plan không bị ảnh hưởng; required gates pass.
- [x] Không data write, không sửa `.vscode/`, không commit/push/deploy.
- [x] Manual iOS keyboard được ghi rõ nếu chưa chạy trên thiết bị thật.

## Verification Evidence

- Targeted client: 2 files, 6 tests passed.
- Targeted server sau guard relocation: 2 files, 15 tests passed.
- Full client: 41 files, 228 tests passed.
- Full server: 85 files, 384 tests passed; targeted suite đã chạy lại sau thay đổi cuối.
- Client lint: 0 errors; còn 1 warning cũ tại `Pricing.jsx:48` ngoài diff.
- Release build: Vite pass, prerender 784/784, bundle budget pass.
- AI tool validator: 11/11; commercial contract, secret scan, data-boundary và agent validation pass.
- Local viewport 390x844 load thành công; ChatPanel cần auth nên iOS keyboard thật vẫn là manual check sau deploy.

## STOP Conditions

- Order không đại diện học viên hoặc có status cần miễn theo business contract.
- Fix mobile yêu cầu đổi global app shell, migration hoặc dữ liệu thật.
- Test fail ba vòng sau khi xác định root cause.

## Maintenance Notes

- Entry point tự đăng ký Free mới phải tái sử dụng eligibility guard; admin grant là override tin cậy.
- Nếu đổi Order semantics, cập nhật purchase guard, `/my` và Pricing.
- Không quay lại `ht_chat_theme`; v2 cố ý reset default cũ một lần.
