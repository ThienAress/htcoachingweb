# Plan 075: Rà soát catalog, chuẩn hóa phản hồi submit và gom Mục tiêu sức khỏe

> Không commit/push/deploy, không chạy migration hoặc ghi dữ liệu môi trường. Giữ nguyên
> năm file hotfix observability/monitoring đang khóa và reconcile working tree trước khi sửa.

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: MED
- **Depends on**: 039, 047, 060, 062, 067, 068, 069, 071A, 074
- **Category**: catalog | ui | feedback | tests | rules
- **Planned at**: 2026-08-29
- **Execution**: COMPLETE / LOCAL VERIFIED

## Current state

- Catalog canonical dùng version `2026-08-12.1` và chưa phản ánh các plan sau 047.
- Client có 39 module production chứa form và 63 module dùng `useMutation`; feedback
  hiện pha trộn toast, inline-only và phản hồi trực tiếp trên surface.
- `PracticeCenter` có gọi `toast.success`, nhưng ứng dụng đang render thêm container trong
  Admin layout và test chưa chứng minh callback success thật sự phát notification.
- Trainer render Wellness và Habit thành hai section; customer `TodayJournal` cũng render
  hai card ngang hàng.

## Steps

### Step 1: Khóa contract và inventory

- Tạo focused tests cho catalog version/history, Practice Center success/error toast,
  banner và grouping sức khỏe hai vai trò.
- Phân loại mutation: submit cần toast, inline bổ trợ, hoặc exemption có chủ đích.

### Step 2: Làm mới catalog Admin

- Cập nhật version, lịch sử đã triển khai/kiểm thử và `currentImprovement` có căn cứ.
- Giữ report serializer/PDF tương thích; cập nhật expected version, date range, feature
  order và delivery history trong tests.

### Step 3: Chuẩn hóa feedback thao tác

- Dùng một ToastContainer global, tăng khả năng nhận biết và bỏ container trùng.
- Bổ sung toast success/error cho Practice Center và các submit/mutation chủ động còn
  inline-only; không thêm vào autosave/background/optimistic toggle.
- Giữ disabled/loading, inline validation, retry và conflict behavior hiện có.

### Step 4: Gom Mục tiêu sức khỏe

- Tạo section cha ở Trainer và Customer, đổi nhãn Habit thành `Thói quen khách hàng`.
- Đổi heading metric con cho đúng hierarchy; không đổi service, payload, schema hay query key.
- Cập nhật banner và component/accessibility tests.

### Step 5: Rule, QA và cleanup

- Bổ sung canonical frontend rule về submit/mutation feedback.
- Chạy focused tests, client lint/compile, UI regression, agent validator và diff check.
- Review không còn import/debug/code thừa; cập nhật plan thành kết quả thật.

## Verification

| Mục tiêu | Kiểm tra |
|---|---|
| Catalog/report | Focused server service/route tests |
| Toast + grouping | Focused client component tests |
| Client contract | Client lint và Vite compile |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` |
| Rules | `npm run agents:validate` |
| Hygiene | `git diff --check` và review diff có phạm vi |

## STOP conditions

- Cần đổi schema/API, chạy migration hoặc ghi staging/production để tiếp tục.
- Cần sửa auth/CSRF/payment/wallet hoặc `client/src/utils/api.js`.
- Cần chạm một trong năm file hotfix bị khóa.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Kết quả thực thi

- Catalog Admin đã được nâng lên version `2026-08-29.1`, phản ánh 12 tính năng, 16 mốc
  cải tiến và các hướng phát triển tiếp theo có evidence tương ứng trong code/tests.
- Toàn bộ production client đã được rà soát cho form/mutation chủ động; các luồng cần
  phản hồi đã có success/error toast, exemption được ghi tại
  `docs/audits/2026-08-29-submit-feedback-audit.md`, và ứng dụng chỉ còn một
  `ToastContainer` global.
- HLV và khách hàng cùng dùng section cha `Mục tiêu sức khỏe`, với hai phần con chỉ số
  sức khỏe và `Thói quen khách hàng`; API, schema và query key không đổi.
- Banner HLV đã nhấn mạnh báo cáo khách hàng là thông tin quan trọng cần kiểm tra mỗi ngày.
- Rule canonical về phản hồi submit/mutation đã được bổ sung vào
  `.agents/rules/code/tech_patterns.md`.

## Evidence hoàn tất

- Focused client: 4 test files, 29 tests pass; test riêng ExercisesPage: 6/6 pass.
- Full client: 133 test files, 599 tests pass; ESLint 0 error, 1 warning
  `react-hooks/incompatible-library` tại form chuyển HLV.
- Focused server catalog/report/PDF: 3 test files, 22 tests pass; PDF hợp lệ 2 trang.
- Vite compile: pass với 2.932 modules.
- UI regression gate: 0 finding mới, 12 finding được giải quyết.
- `npm run agents:validate`, `npm run security:secrets`,
  `npm run security:data-boundaries` và `git diff --check`: pass.
- Năm file hotfix observability/monitoring bị khóa không có diff từ task này.
