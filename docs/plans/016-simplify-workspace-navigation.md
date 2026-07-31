# Plan 016: Rút gọn dropdown và gom nghiệp vụ vào Quản lý khách hàng

> **Hướng dẫn thực thi**: Khóa role matrix và route contract bằng helper/test trước.
> Giữ route cũ, không thay API/schema/quyền. F1 phải fail closed ở cả navigation và route.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — thay đổi điều hướng protected và presentation của page standalone
- **Depends on**: 012, 015
- **Category**: feature | navigation | UX | security | tests
- **Planned at**: 2026-07-31
- **Status**: IMPLEMENTED / LOCAL VERIFIED — VISUAL MANUAL PENDING

## Why This Matters

Dropdown tài khoản hiện vừa chứa workspace, vừa chứa toàn bộ nghiệp vụ và mục cá nhân,
dẫn tới menu dài, khó quét và khó mở rộng. Tách hai cấp điều hướng giúp dropdown đóng
vai trò launcher, còn sidebar `Quản lý khách hàng` trở thành nơi tổ chức nghiệp vụ HLV.

## Scope

**In scope**

- Helper + unit test cho workspace items, sidebar groups và active route.
- Dropdown tài khoản desktop/mobile.
- Trainer sidebar và các nested route nghiệp vụ.
- Presentation `embedded` cho Check-in, Coach Online, Lịch tập và Giáo án.
- Translation và tài liệu liên quan.

**Out of scope**

- API, schema, controller/service và ownership.
- Thay đổi entitlement F1.
- Migration, seed, Doppler, staging hoặc production.
- Redesign nội dung của từng nghiệp vụ.
- Xóa route legacy.

## Steps

### Step 1: Khóa navigation contract bằng test

Tạo config thuần cho role matrix, group visibility và active route. Viết test fail
trước implementation cho admin, HLV, user thường, F1 và detail route.

**Verify**: focused test đỏ trước helper và xanh sau helper.

### Step 2: Rút gọn account dropdown

Desktop/mobile dùng cùng workspace item source. Bỏ accordion nghiệp vụ, giữ workspace
launcher và thao tác cá nhân.

**Verify**: source test và manual inspection xác nhận role matrix không drift.

### Step 3: Mở rộng Trainer sidebar

Tạo bốn group đã duyệt, tải entitlement bằng query key hiện có và fail closed cho F1.
Active state dùng matcher tập trung.

**Verify**: test group order, F1 visibility và prefix matching pass.

### Step 4: Đưa nghiệp vụ chính vào TrainerLayout

Thêm nested route cho Check-in, Coach Online, Lịch tập, Giáo án và chi tiết giáo án.
Các page nhận `embedded` để bỏ Header/Footer trùng lặp; URL cũ giữ nguyên.

**Verify**: cả workspace URL và legacy URL đều compile; điều hướng detail giữ đúng
route family.

### Step 5: Regression và UI gate

Chạy focused/full client tests phù hợp, lint, build, UI anti-slop/accessibility scan và
`git diff --check`.

## Done Criteria

- [x] Dropdown desktop/mobile chỉ còn workspace và mục cá nhân.
- [x] Admin có hai workspace; HLV có một; user thường giữ dashboard.
- [x] Trainer sidebar có đúng nhóm và F1 theo entitlement.
- [x] Nghiệp vụ chính render trong TrainerLayout, không nhân đôi Header/Footer.
- [x] Route legacy giữ hoạt động.
- [x] Không có API/schema/Doppler/production change.
- [x] Test, lint, Vite build, source UI check và diff check có evidence thật.

## Verification Evidence

- TDD: focused test fail khi chưa có helper, sau implementation `7/7` pass.
- Client regression: `36` files, `206/206` tests pass.
- Client ESLint: pass.
- Vite production compile: pass (`2782` modules).
- Bundle budget: pass.
- Secret scan: pass.
- UI source check: không có pattern gradient text, purple/blue gradient, side stripe
  hoặc bounce/elastic mới; navigation mới có focus-visible và touch target 44px.
- `git diff --check`: pass; chỉ có cảnh báo line ending CRLF của working tree.
- Full `npm run build --prefix client` compile thành công nhưng postbuild prerender bị
  timeout do dynamic content fetch `EACCES` và các public route chờ 30 giây; đây là
  blocker môi trường hiện có, không liên quan protected Trainer routes.
- Visual browser check chưa chạy vì runtime không có browser khả dụng.

## STOP Conditions

- Cần nới quyền backend hoặc bỏ route guard để render menu.
- Nested route làm thay đổi payload/mutation của nghiệp vụ.
- Phải xóa route cũ hoặc redirect làm mất query parameter.
- Gặp diff chưa commit chồng lên đúng symbol cần sửa mà không thể merge an toàn.
