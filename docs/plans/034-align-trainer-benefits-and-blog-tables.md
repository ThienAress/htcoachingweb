# Plan 034: Đồng bộ quyền lợi gói HLV và mở soạn thảo bảng trong Blog

> **Hướng dẫn thực thi**: Giữ catalog backend là nguồn quyền lợi HLV canonical, dùng cùng dữ liệu cho Pricing
> và Admin. Tiptap dùng extension chính thức cùng major/minor hiện hữu; không tự tạo schema table riêng.
>
> **Drift check**: Working tree đang chứa Plan 033 và nhiều thay đổi của user. Chỉ sửa đúng các symbol liệt kê
> trong Scope, không hoàn tác hoặc format lại phần ngoài yêu cầu.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 033
- **Category**: feature
- **Planned at**: 2026-08-07
- **State**: COMPLETE / LOCAL VERIFIED

## Why This Matters

Trang Admin hiện chỉ cho đối chiếu quota công cụ, còn bốn gói HLV chỉ được mô tả bằng cấu trúc lặp trong
`Pricing.jsx`. Việc chỉnh quyền lợi sau này dễ làm Pricing, catalog và Admin lệch nhau. Blog editor cũng đã parse
được bảng Markdown nhưng chưa đăng ký Tiptap table schema nên người soạn không thể chèn/chỉnh bảng trực tiếp.

## Current State

- `server/src/constants/trainerPlans.js` là nguồn canonical cho bốn gói, giá, số khách và entitlement F1.
- `client/src/sections/Pricing.jsx:357` tự dựng lại nhóm quyền lợi theo từng gói.
- `server/src/services/serviceAccessPolicy.service.js` chỉ trả ma trận quota Guest/User/gói-HLV.
- `client/src/pages/admin/ServiceAccessPoliciesPage.jsx` chỉ render một bảng không thu gọn.
- `client/src/components/TipTapEditor.jsx` chưa đăng ký TableKit và toolbar chưa có thao tác bảng.
- Tiptap đang ở dòng `3.27.x`; extension chính thức là `@tiptap/extension-table` và cung cấp `TableKit`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused client tests | `npm run test --prefix client -- --run <test files>` | exit 0 |
| Focused server tests | `npm run test --prefix server -- --run <test files>` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0, không có error mới |
| Client compile | `npx vite build --config client/vite.config.js` | exit 0 |
| Patch hygiene | `git diff --check` | không có whitespace error |

## Scope

**In scope**:

- Catalog/quyền lợi HLV và tests liên quan trong `server/src/constants/`, `server/src/services/`, controller catalog.
- Admin policy response, presentation helper/page và focused tests.
- `Pricing.jsx` cùng helper catalog client để đọc quyền lợi canonical.
- `TipTapEditor.jsx`, dependency Tiptap table và focused structural test.
- Spec/plan/index và skill `service-access-policy` nếu contract vận hành cần cập nhật.

**Out of scope**:

- Mutation chỉnh quyền lợi trực tiếp từ Admin, schema/migration MongoDB và dữ liệu production.
- Refactor toàn bộ `Pricing.jsx` hoặc thiết kế lại Blog management.
- Thay đổi giá/quota/quyền lợi kinh doanh hiện tại.

## Steps

### Step 1: Xuất ma trận bốn gói từ catalog canonical

Định nghĩa metadata quyền lợi một lần cạnh trainer plan catalog, đưa nó vào fingerprint/catalog response và xây
read model Admin. Refactor Pricing chỉ ở vùng dựng `trainerPlans` để nhóm feature từ catalog này.

**Behavior**: Thay đổi một quyền lợi canonical sẽ phản ánh ở cả Pricing và bảng Admin.

**Verify**: focused server catalog/API tests và client catalog/presentation tests đều pass.

### Step 2: Tổ chức trang Quyền & hạn mức thành hai khu vực thu gọn

Render “Hạn mức công cụ” và “Quyền lợi gói HLV” với header rõ ràng, bảng ngang responsive, loading/error/empty
state hiện hữu và nút chevron có nhãn truy cập được.

**Behavior**: Admin đóng/mở từng bảng độc lập; bốn cột gói và toàn bộ quyền lợi khớp Pricing.

**Verify**: client tests, lint và Vite compile pass; kiểm tra UI code theo `ui-check`.

### Step 3: Mở soạn thảo bảng trong Tiptap

Cài `@tiptap/extension-table` cùng version Tiptap hiện hữu, đăng ký `TableKit`, thêm nút chèn bảng 3x3 có hàng
tiêu đề và các thao tác thêm/xóa hàng/cột, xóa bảng khi con trỏ nằm trong bảng. Bổ sung style editor để bảng dễ
đọc và cuộn ngang trên màn hình hẹp.

**Behavior**: Người soạn chèn và chỉnh cấu trúc bảng trực tiếp; HTML table được giữ trong nội dung Blog.

**Verify**: structural extension test, client lint và Vite compile pass.

## Test Plan

- Server: catalog chứa đúng benefit registry, fingerprint đổi khi benefit đổi, Admin API trả đúng 4 cột.
- Client: normalizer fail closed nếu thiếu benefit contract; helper nhóm feature đúng từng plan; presentation định
  dạng số học viên/có-không; editor extensions có TableKit.
- Regression: focused tests Plan 033, catalog lifecycle, lint và Vite compile.

## Done Criteria

- [x] Hai bảng Admin có tên, mở mặc định và thu gọn độc lập bằng control accessible.
- [x] Bảng quyền lợi có đúng bốn gói và cùng nguồn dữ liệu với Pricing.
- [x] Tiptap chèn bảng 3x3 có header và có thao tác chỉnh hàng/cột/xóa bảng.
- [x] Không có mutation Admin, migration, secret hoặc refactor ngoài scope.
- [x] Focused tests, lint, Vite compile và `git diff --check` đạt.
- [x] `docs/plans/README.md` phản ánh trạng thái thực tế.

## Verification Evidence

- Server focused: 3 files / 17 tests pass (catalog, lifecycle API, Admin policy API).
- Client focused: 4 files / 9 tests pass; sau cleanup 3 files / 5 tests pass.
- Client full unit: 65 files / 307 tests pass.
- Client lint: exit 0, không có error; còn 2 warning React hooks đã có ngoài phạm vi.
- Vite compile: 2.835 modules transformed, exit 0; còn bundle-size warning đã có.
- Agent validator: 27 skills, 0 warning.
- `git diff --check`: không có whitespace error.

## STOP Conditions

- Cần thay đổi semantics giá/quyền lợi hiện tại thay vì chỉ chuẩn hóa nguồn dữ liệu.
- Tiptap table extension không tương thích dòng `3.27.x` đang khóa trong project.
- Verification fail ba vòng sau khi đã sửa root cause.

## Maintenance Notes

- Khi thêm/bớt quyền lợi gói HLV, cập nhật registry canonical và test ma trận; không thêm mảng feature riêng trong
  Pricing hoặc trang Admin.
- Chỉnh gói trực tiếp từ Admin được defer vì cần mutation contract, validation, audit log và quyền bảo mật riêng.
- Deploy backend trước frontend: client mới yêu cầu trường `benefits` trong public trainer catalog, còn client cũ
  vẫn tương thích với response backend mới có trường bổ sung.
