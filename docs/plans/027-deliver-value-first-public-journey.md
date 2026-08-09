# Plan 027: Hoàn thiện hành trình public ưu tiên giá trị

> **Hướng dẫn thực thi**: khóa regression bằng test trước, chỉ sửa các vùng Pricing/Meal Plan/TDEE
> liên quan và không deploy, commit hoặc push nếu chưa có yêu cầu riêng.
>
> **Drift check**: Hero CTA vẫn là “Nhận tư vấn miễn phí”; Meal Plan vẫn sinh phía client từ Food
> DB public; quota user vẫn do `useMealPlanAccess`/server sở hữu; trainer catalog vẫn là nguồn giá HLV.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM
- **Depends on**: 003C, 004, 018
- **Category**: feature
- **Planned at**: 2026-08-05
- **State**: IMPLEMENTED / LOCAL VERIFIED — LIVE FOOD PREVIEW + PRERENDER PENDING

## Why This Matters

Homepage đang ngắt mạch khách vãng lai bằng persona modal, coaching cards không giải thích vì sao
không có giá, Meal Plan yêu cầu login trước khi chứng minh giá trị, và TDEE bắt người dùng tự chọn
công thức kỹ thuật. Ba điểm này làm tăng ma sát trước khi khách hiểu lợi ích thật của sản phẩm.

## Impact Map

| Producer/change | Direct consumers | Contract cần giữ |
|---|---|---|
| Pricing view mode | Pricing title, customer/trainer cards, Today prompt | Chỉ `customer`/`trainer`; trainer checkout không đổi |
| Customer price copy | Pricing cards, Register OrderSummary | Không thêm giá giả hoặc thay payload Order |
| Guest preview flag | MealPlan generate button/LoginModal | Session-only; không gọi protected quota API |
| TDEE default form | persisted form, reset, validation, Macro/Meal Plan | Chỉ default formula; goal/activity vẫn explicit |

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Focused client tests | `cd client && npx vitest run src/utils/__tests__/publicJourney.test.js src/pages/TdeeCalculator/__tests__/tdee.helpers.test.js` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0, warning cũ được ghi rõ nếu có |
| Client build | `npm run build --prefix client` | exit 0 gồm sitemap/prerender/bundle budget |
| Governance | `npm run agents:validate` | exit 0 |

## Steps

### Step 1: Khóa behavior bằng test đỏ

- Normalize Pricing mode về customer và từ chối storage value không hợp lệ.
- Guest preview chỉ được consume một lần trên cùng session storage và fail-safe khi storage lỗi.
- TDEE form mới/reset/legacy-empty dùng Mifflin; Katch đã lưu không bị ghi đè.

### Step 2: Sửa Pricing và registration copy

- Xóa state/effect/modal persona; thêm selector inline accessible.
- Gắn Today prompt với authenticated customer.
- Thêm lời giải thích chi phí sau đánh giá và CTA đánh giá miễn phí ở customer cards.
- Đồng bộ OrderSummary; không chạm Hero và trainer checkout.

### Step 3: Mở Meal Plan preview cho guest

- Validate macro trước, consume preview ngay trước generate thành công.
- Sau preview hiển thị invitation rõ; tạo lại/lựa chọn yêu thích mở Login Modal.
- Giữ authenticated quota và Saved Meal Plans nguyên contract.

### Step 4: Thêm TDEE safe default

- Dùng một default form canonical cho load/reset.
- Normalize legacy storage và thêm helper text cho công thức.
- Không default activity, goal hay calorie adjustment.

### Step 5: Verify và cleanup

- Chạy focused tests, lint, build và agent validation.
- Smoke homepage Pricing, guest Meal Plan và TDEE ở desktop/mobile.
- Re-trace impact, kiểm tra diff, debug logs/import thừa và cập nhật evidence.

## Done Criteria

- [ ] Tất cả acceptance criteria trong spec pass; còn live Food preview và full prerender.
- [x] Không đổi Hero CTA, auth/CSRF, schema, API hoặc trainer commercial contract.
- [x] Focused/full client tests, lint, Vite compile và bundle budget pass.
- [x] Manual smoke không có modal persona và không tạo popup thay thế cho guest.
- [x] Không có debug code, secret, migration, commit, push hoặc deploy ngoài yêu cầu.

## Verification Evidence — 2026-08-05

- Focused regression: `2 files / 7 tests` pass.
- Full client unit: `52 files / 257 tests` pass.
- Client lint exit `0`; agent validation pass `22 skills / 0 warnings`.
- Vite compile exit `0`, `2.808 modules` transformed; bundle budget pass. `Home` khoảng
  `73,0 kB` raw và `MealPlan` khoảng `63,7 kB` raw.
- Browser smoke desktop: homepage không có persona modal; selector đổi Customer/Trainer;
  customer cards hiển thị cost-after-assessment; TDEE có Mifflin selected, activity/goal blank;
  guest favorites mở Login Modal.
- Browser smoke mobile 390 × 844: selector, cost callout, TDEE helper và Login Modal không tràn;
  CTA/focus/touch targets mới đạt tối thiểu 44 px.
- Full `npm run build --prefix client` compile thành công nhưng postbuild bị sandbox trả `EACCES`
  cho dynamic sources; prerender đợi 30 giây/route và command hết timeout ở cả mốc 120 giây và
  300 giây. Không tuyên bố full build pass.
- Local Food API không khởi động được trong môi trường hiện tại, nên browser chưa sinh được preview
  thật; nhánh thiếu Food fail-safe và không consume session preview.

## STOP Conditions

- Cần đổi API protected, schema hoặc dữ liệu thật mới cho guest preview hoạt động.
- Trainer price/checkout bị ảnh hưởng ngoài presentation selector.
- QA fail ba vòng cùng một root cause hoặc dev environment không thể chạy build.
