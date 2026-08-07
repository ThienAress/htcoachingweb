# Plan 032: Mở quản trị riêng theo từng huấn luyện viên

> **Hướng dẫn thực thi**: Hoàn tất lần lượt từng behavior slice và chạy focused verification trước khi
> chuyển bước. Không nới ownership dựa trên frontend; mọi query/mutation phải fail closed ở backend.
>
> **Drift check**: Working tree đang có nhiều thay đổi song song. Chỉ sửa đúng các symbol được liệt kê;
> bảo toàn conversion-origin changes đang có trong Order và các thay đổi AI/SEO khác.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 016, 019, 023, 031
- **Category**: security | feature | dx | documentation
- **Planned at**: 2026-08-07
- **Execution**: COMPLETE / LOCAL VERIFIED

## Why This Matters

Trainer có subscription hiện chỉ vào được quản lý khách hàng, trong khi nghiệp vụ Order/Contract nằm ở admin.
Mở ba màn hình mà không thêm ownership server-side sẽ gây IDOR và lộ dữ liệu khách giữa các HLV. Plan này
thêm trainer-scoped administration, cấm trainer xóa Order, đồng thời có local dev path không phụ thuộc Doppler
và lập bảng access/quota canonical để quyết định product tiếp theo.

## Current State

- PowerShell chọn `npm.ps1` và bị execution policy chặn; `npm.cmd` chạy được nhưng `dev` hiện yêu cầu Doppler token.
- `GET /api/orders` và Check-in đã scope bằng `trainerId`; Order create/update vẫn admin-only.
- Contract list/create/update/send/cancel hiện admin-only và service mutations chưa nhận owner filter.
- `/trainer/checkin-history` đã tồn tại nhưng chưa có entry trong navigation registry.
- Spec cũ cố ý không có nhóm quản trị cho HLV và được cập nhật trong task này.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Local client dev trên Windows | `npm.cmd run dev:local --prefix client -- --host 127.0.0.1` | Vite starts without Doppler |
| Focused client | `npx.cmd vitest run <files>` trong `client/` | exit 0 |
| Focused server | `npx.cmd vitest run <files>` trong `server/` | exit 0 |
| Client lint | `npm.cmd run lint --prefix client -- --quiet` | exit 0 |
| Compile-only | `npx.cmd vite build` trong `client/` | exit 0 |

## Scope

**In scope**:

- Client dev scripts, trainer navigation/routes và reuse bounded của Orders/Contract pages.
- Order/Contract route-controller-service authorization và regression tests.
- Workspace spec/plan và báo cáo service access/quota.

**Out of scope**:

- Migration/schema change, deploy, production data mutation hoặc đổi JWT/CSRF core.
- Đổi quyền admin hiện có, xóa lịch sử hoặc tự động merge dữ liệu giữa trainers.
- Thay đổi quota thương mại; mục 4 chỉ thống kê contract hiện tại và nêu drift/đề xuất riêng.

## Steps

### Step 1: Khôi phục local dev không phụ thuộc Doppler

Giữ script Doppler dưới tên riêng và thêm Vite local script. Không thay execution policy máy; PowerShell dùng
`npm.cmd` hoặc `cmd /c npm` để tránh `npm.ps1`.

**Verify**: local dev command khởi động Vite trước timeout.

### Step 2: Thêm ba entry quản trị vào trainer workspace

Thêm nhóm `Quản trị` vào registry với `/trainer/orders`, `/trainer/contracts`, `/trainer/checkin-history`;
đăng ký lazy routes và icon theo UI hiện có.

**Verify**: navigation unit tests xác nhận đúng nhóm/active state; client compile pass.

### Step 3: Cho trainer tạo/sửa Order của chính mình nhưng không xóa

Trainer create luôn lấy owner từ `req.user.id`; list/update dùng owner filter ở backend; trainer không đổi
`trainerId`, status hoặc gọi DELETE. UI ẩn delete và trainer assignment nhưng vẫn có create/edit.

**Verify**: integration tests cho own/other trainer, subscribed user, delete 403 và admin compatibility.

### Step 4: Mở Contract workflow theo ownership trainer

List/approved orders/create/update/send/cancel đều nhận owner filter server-authoritative. Delete contract giữ
admin-only; client ẩn action không được phép cho trainer.

**Verify**: integration tests trainer A/B isolation và existing signing tests.

### Step 5: Thống kê access/quota và bàn giao

Trace route, limiter, entitlement và client preview để tạo bảng cho Public Visitor, Customer User, Coaching
Customer và Trainer. Phân biệt hard quota, session preview, free/unlimited và chưa có quota canonical.

**Verify**: report có evidence file:line, review diff ba axis, QA quick, security scans và `git diff --check`.

## Done Criteria

- [x] `npm.cmd run dev:local` khởi động Vite mà không cần Doppler.
- [x] Trainer sidebar có đúng ba mục quản trị mới.
- [x] Trainer A không thấy/thao tác Order, Contract, Check-in của trainer B.
- [x] Trainer tạo/sửa được Order của mình; không có delete UI và DELETE trả 403.
- [x] Focused client/server tests, lint, compile và security gates pass.
- [x] Báo cáo service access/quota được lưu trong `docs/reports/` và link từ `docs/README.md`.

## STOP Conditions

- Cần migration/backfill hoặc sửa dữ liệu production.
- Ownership hiện tại không thể xác định từ `Order.trainerId`/`Contract.trainerId`.
- Cần mở mutation tài chính hoặc quyền admin ngoài yêu cầu.
- Cùng verification fail ba vòng sau các sửa có căn cứ.
