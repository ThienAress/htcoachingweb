# Plan 004: Mở Today Dashboard từ trang chủ mà không cạnh tranh popup

> **Hướng dẫn thực thi**: Thực hiện theo từng bước và chạy verification trước khi chuyển bước.
> Nếu gặp STOP condition, dừng và báo cáo thay vì tự mở rộng phạm vi.
>
> **Drift check**: Trước khi sửa, xác nhận `Pricing.jsx` vẫn quản lý `pricingViewMode`, popup
> "Bạn là ai?" và route `/today` vẫn dùng `AuthenticatedRoute`. Nếu một trong các contract này
> đã đổi, cập nhật lại plan trước khi implement.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 003H
- **Category**: feature | ui | navigation
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Why This Matters

Today Dashboard đã có route và entry trong account dropdown nhưng khách ở trang chủ chưa được
nhắc rõ về giá trị hằng ngày của nó. Trang chủ đồng thời đã có popup bắt buộc chọn persona để xem
bảng giá; thêm một modal thứ hai sẽ tranh focus và tạo cảm giác quảng cáo. Cần dùng một flow chung:
CTA nằm ngay trong popup hiện tại cho khách mới, còn khách đã chọn persona "Khách hàng" nhận một
thẻ nhắc non-modal, có thể đóng, tối đa một lần mỗi browser session.

## Current State

- `client/src/sections/Pricing.jsx:20-35` lưu persona trong `localStorage.pricingViewMode` và mở
  `showModeModal` sau khi hero animation hoàn tất.
- `client/src/sections/Pricing.jsx:1240-1272` render popup "Bạn là ai?" với hai lựa chọn
  "Khách hàng" và "Huấn luyện viên".
- `client/src/App.jsx:166-180` khai báo `/today` và `/today/:dateKey` qua `AuthenticatedRoute`.
- `client/src/routes/AuthenticatedRoute.jsx:19-28` chuyển anonymous user tới `/login` và giữ
  destination trong `location.state.from`; CTA có thể điều hướng thẳng tới `/today`.
- `client/src/sections/Header/Header.jsx:258` đã có entry Today Dashboard trong dropdown của user;
  thay đổi này bổ sung discovery trên homepage, không thay thế navigation hiện tại.
- `client/src/components/ChatIcons.jsx` và ChatWidget đã chiếm vùng dưới màn hình; thẻ mới phải
  nằm dưới header ở phía trên, không dùng vùng bottom-right/bottom-center.
- Copy homepage được quản lý trong `client/src/i18n/locales/{vi,en}/home.json`.

## Product and UX Decisions

- Tên CTA canonical: **Mở kế hoạch hôm nay**. Tên này bao quát lịch tập, dinh dưỡng, habit và
  tiến độ tốt hơn "gọt body" hoặc chỉ "xem tiến độ".
- Không tạo modal mới.
- Khi popup persona đang mở, chỉ hiển thị một action phụ "Dành cho học viên" ngay trong popup;
  thẻ nhắc nổi phải ẩn hoàn toàn.
- Khi `pricingViewMode === "customer"` từ lần truy cập trước, hiển thị một thẻ non-modal sau khi
  hero animation xong. Cho phép đóng bằng nút có accessible name.
- Chọn một persona trong popup được tính là đã thấy lời nhắc trong session hiện tại, tránh đóng
  popup xong lại thấy ngay một thẻ thứ hai.
- Đóng hoặc mở Today Dashboard lưu cờ trong `sessionStorage`, vì vậy prompt có thể xuất hiện lại ở
  browser session mới nhưng không lặp lại khi refresh/navigate trong cùng session.
- `pricingViewMode === "trainer"` không nhận thẻ nổi. Action trong popup vẫn dùng được cho học viên
  chưa đăng nhập; `AuthenticatedRoute` chịu trách nhiệm redirect và giữ destination.
- Không gọi API mới, không suy diễn entitlement và không thay đổi auth/backend contract.

## Scope

**In scope**:

- `.agents/skills/plan-template/SKILL.md`
- `docs/plans/004-homepage-progress-entry.md`
- `docs/plans/README.md`
- `client/src/components/TodayProgressPrompt.jsx`
- `client/src/sections/Pricing.jsx`
- `client/src/i18n/locales/vi/home.json`
- `client/src/i18n/locales/en/home.json`
- `e2e/home-progress-entry.spec.js`

**Out of scope**:

- Today Dashboard API/schema/data retention.
- Thay đổi auth, login hoặc `AuthenticatedRoute`.
- Refactor toàn bộ `Pricing.jsx` dù file đang lớn.
- Thay đổi popup persona thành auth-role selector; nó vẫn chỉ điều khiển catalog bảng giá.
- Deploy hoặc kiểm thử ghi dữ liệu production.

## Steps

### Step 1: Bắt buộc persistence và taxonomy cho mọi implementation plan

Cập nhật `plan-template/SKILL.md`: khi user yêu cầu kế hoạch hoặc Codex quyết định lập plan nhiều
bước, phải đọc `docs/README.md`, tạo/cập nhật Markdown canonical trong đúng category, không đặt file
mới ở root `docs/`, và cập nhật `docs/plans/README.md`.

**Verify**: chạy `quick_validate.py .agents/skills/plan-template` nếu Python khả dụng; nếu runtime
thiếu, kiểm tra thủ công frontmatter chỉ có `name`/`description`, tên hyphen-case và description
dưới 1024 ký tự, đồng thời ghi rõ limitation khi bàn giao.

### Step 2: Tạo thẻ nhắc Today Dashboard non-modal

Tạo `TodayProgressPrompt.jsx` với hierarchy rõ, Lucide icons, CTA và nút đóng. Dùng vị trí fixed
dưới header, touch target tối thiểu 44px, focus-visible ring và không chiếm vùng chat controls.
Copy lấy từ namespace `home` ở cả tiếng Việt và tiếng Anh.

**Verify**: `npm run lint --prefix client` → exit 0.

### Step 3: Tích hợp vào popup persona và điều hướng canonical

Trong `Pricing.jsx`, thêm action phụ vào popup hiện hữu và render thẻ nổi chỉ khi hero đã xong,
persona là customer, popup đóng và session chưa dismiss. Cả hai CTA đều `navigate("/today")`;
action trong popup đồng thời persist persona customer. Không thêm API call hoặc modal state khác.

**Verify**: `npm run build --prefix client` → build, prerender và bundle budget exit 0.

### Step 4: Khóa regression bằng browser tests

Thêm E2E cho các trạng thái:

1. First visit: popup persona và embedded CTA hiện; thẻ nổi không tồn tại.
2. Returning customer: không có popup persona; thẻ nổi hiện và CTA đi `/today` hoặc login đúng
   theo auth state.
3. Dismiss: refresh trong cùng session không hiện lại.
4. Trainer persona: không hiện thẻ customer.
5. Mobile: prompt có CTA/nút đóng truy cập được và không tạo horizontal overflow.

**Verify**: `npx playwright test e2e/home-progress-entry.spec.js --project=chromium` → all pass.

## Test Plan

- E2E là regression chính vì feature phụ thuộc React Router, local/session storage, hero completion
  và auth redirect; unit test thuần không chứng minh được interaction giữa các lớp này.
- Chạy lại client unit suite để bảo đảm component/import/i18n không làm vỡ bundle test.
- Kiểm tra accessibility bằng role/name cho dialog, CTA và dismiss button; không auto-focus vào
  thẻ non-modal.

## Done Criteria

- [x] First-time visitor không bao giờ thấy hai modal cạnh tranh.
- [x] Popup persona chứa action "Mở kế hoạch hôm nay".
- [x] Returning customer thấy thẻ nhắc tối đa một lần mỗi session và có thể đóng.
- [x] Trainer persona không thấy thẻ customer.
- [x] Anonymous click được chuyển qua login với destination `/today`; authenticated user mở được
      Today Dashboard canonical.
- [x] Copy Việt/Anh đầy đủ; CTA và nút đóng dùng keyboard được.
- [x] Client lint, unit, build và focused E2E pass.
- [x] `docs/plans/README.md` phản ánh đúng trạng thái thực thi.

## Verification Results

- `npm run lint --prefix client` → PASS.
- `npm run test:unit:client` → PASS, 27 files / 160 tests.
- `npm run build --prefix client` → PASS, 87/87 prerender routes và bundle budget PASS.
- `npx playwright test e2e/home-progress-entry.spec.js --project=chromium` → PASS, 4/4.
- `npm run test:e2e` → PASS, 57/57 sau khi xử lý Plan 005.
- `npm run security:secrets` và `npm run security:data-boundaries` → PASS.
- `git diff --check` → PASS.
- `quick_validate.py` không chạy được vì environment chỉ có Windows Store Python alias; kiểm tra
  tương đương bằng PowerShell xác nhận frontmatter chỉ có `name`/`description`, tên hyphen-case,
  description 274 ký tự và không có angle brackets → PASS.

## STOP Conditions

- `/today` không còn giữ destination qua login.
- Persona popup thực tế đại diện auth role/entitlement thay vì chỉ chọn catalog.
- Cần API/schema/auth change để xác định customer.
- UI chỉ có thể đặt ở vùng đang bị ChatWidget/ChatIcons che trên mobile.
- Verification fail ba vòng với cùng root cause.

## Maintenance Notes

- Storage keys cho prompt phải có prefix dự án và chỉ chứa UI preference, không chứa PII.
- Nếu sau này popup persona bị xóa, giữ thẻ non-modal và chuyển CTA customer vào hero/header thay vì
  tạo modal mới.
- Nếu `/today` đổi route, cập nhật đồng thời Header, notification deep links và CTA này.
