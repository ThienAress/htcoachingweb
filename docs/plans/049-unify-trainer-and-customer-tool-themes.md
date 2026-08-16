# Plan 049: Đồng bộ theme HLV và các công cụ tập luyện của học viên

> **Hướng dẫn thực thi**: Giữ nguyên behavior, API, auth và dữ liệu; chỉ mở rộng presentation theme.
> Chạy từng verification gate trước khi chuyển bước. Nếu light mapping làm giảm contrast hoặc đổi
> video/overlay thành nền sáng ngoài ý muốn thì dừng và thêm ngoại lệ có phạm vi, không sửa rộng toàn site.
>
> **Drift check**: Trước mỗi batch, so `git status --short` và diff của các file in-scope. Working tree đã
> có thay đổi theme từ yêu cầu trước; không ghi đè hoặc dọn các thay đổi đó.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 006, 016
- **Category**: bug
- **Planned at**: 2026-08-14
- **State**: LOCAL VERIFIED — READY FOR STAGING

## Why This Matters

Theme sáng hiện dừng ở `/trainer`, `/trainer/health` và Customer Dashboard shell. Khi HLV mở Check-in,
Coach Online, lịch tập hoặc giáo án, UI quay lại palette tối hardcode. Tương tự, CTA “Đăng ký giờ tập” và
“Mở giáo án trực tuyến” unmount Customer Dashboard rồi mở route độc lập nền tối. Kết quả phải là preference
sáng/tối được giữ xuyên các workflow liên quan, trong khi video, overlay và CTA màu vẫn có contrast WCAG AA.

## Current State

- `client/src/layouts/TrainerLayout.jsx:33-351` sở hữu `trainerTheme`, lưu bằng
  `trainerWorkspaceTheme.js` và truyền qua Outlet context; light CSS đang bị giới hạn bởi
  `data-theme-surface="dashboard"`.
- `client/src/index.css:403-736` có mapping sáng cho Customer Dashboard và hai trainer list surfaces,
  chưa cover đầy đủ `gray-950/900/800`, gradient legacy, placeholder, modal và hover state.
- Nested `/trainer` routes dùng `Checkin`, `TrainerCoaching`, `TrainingSchedule`, `WorkoutPlan`,
  `WorkoutPlanDetail`, `TrainerClientWorkspace`, Orders/Contracts/History; nhiều component tái sử dụng
  route standalone nên theme phải dựa vào ancestor, không đổi default toàn site.
- `server/src/services/todayDashboardSources.service.js:12-18` trả deep link `/book-training` và
  `/online-coaching`; hai route độc lập hardcode dark và không đọc storage key
  `ht_customer_dashboard_theme_v1`.
- Một số nested route (`Orders`, `ContractManagement`, `TrainerCheckinHistory`) ngược lại đang light-only;
  dark theme phải có compatibility mapping riêng. Contract preview và chữ ký cần luôn giữ nền trắng.
- `OnlineCoaching.jsx`, `TrainerCoaching.jsx` và `Checkin.jsx` có ToastContainer hardcode dark; toast
  portal không kế thừa màu từ ancestor CSS, nên TrainerLayout phải bridge theme lên document và cleanup.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused theme unit | `cd client && npx vitest run src/utils/__tests__/customerDashboardTheme.test.js src/utils/__tests__/trainerWorkspaceTheme.test.js` | exit 0 |
| Focused trainer E2E | `npx playwright test e2e/authorization.spec.js e2e/accessibility.spec.js --project=chromium --workers=1` | exit 0 |
| Customer tool E2E | `npx playwright test e2e/schedule-booking.spec.js e2e/coaching.spec.js --project=chromium --workers=1` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 hoặc ghi rõ timeout, kèm focused lint pass |
| Client build | `npm run build --prefix client` | exit 0 |

## Scope

**In scope**:

- `client/src/index.css`
- `client/src/layouts/TrainerLayout.jsx`
- `client/src/pages/admin/Checkin.jsx`
- `client/src/pages/trainer/TrainerCoaching.jsx`
- `client/src/pages/customer/BookTraining.jsx`
- `client/src/pages/customer/OnlineCoaching.jsx`
- `client/src/pages/admin/ContractEditModal.jsx`
- `client/src/components/SignatureCanvas.jsx`
- `e2e/authorization.spec.js`, `e2e/schedule-booking.spec.js`, `e2e/coaching.spec.js`, accessibility E2E khi cần
- Plan này và `docs/plans/README.md`

**Out of scope**:

- API/deep links, auth, CSRF, role/ownership, schema và dữ liệu booking/coaching.
- Refactor các file lớn `TrainerCoaching.jsx`/`OnlineCoaching.jsx` ngoài wrapper và toast theme cần thiết.
- Đổi theme cho public Header/Footer/ChatIcons hoặc các tool public vốn đã có visual identity riêng.
- Commit, push, deploy staging trước khi user xác nhận local.

## Steps

### Step 1: Mở light mapping cho toàn Trainer workspace

Gỡ giới hạn `data-theme-surface="dashboard"`, áp mapping hai chiều dưới `.trainer-workspace[data-theme]` cho mọi
nested route: dark-only surfaces nhận light mapping; light-only Orders/Hợp đồng/Lịch sử nhận dark mapping. Bổ sung
gray/slate surfaces, legacy gradients, input/select/placeholder, divider/hover và ngoại lệ giữ chữ trắng trên CTA
màu/video. TrainerLayout bridge theme lên document cho Toastify portal và cleanup khi unmount. Đánh dấu contract
preview cùng SignatureCanvas là `theme-always-light`.

**Behavior**: chọn light ở `/trainer`, rồi đi qua sidebar tới Check-in, Coach Online, lịch tập và giáo án vẫn sáng;
chọn dark thì Orders/Hợp đồng/Lịch sử cũng tối; preview hợp đồng và chữ ký vẫn trắng; route standalone/admin dùng
chung component không bị đổi.

**Blast radius**: TrainerLayout, CSS trung tâm, document theme bridge và hai always-light legal/signature surfaces.

**Verify**: focused theme unit + trainer theme E2E + accessibility mobile.

### Step 2: Giữ customer theme trên đăng ký lịch và huấn luyện trong ngày

`BookTraining` và `OnlineCoaching` đọc `resolveInitialCustomerDashboardTheme()` khi mount, bọc riêng product
surface/modal/fixed control bằng `.customer-tool-surface[data-theme]`; Header/Footer/ChatIcons nằm ngoài scope.
OnlineCoaching dùng customer theme cho ToastContainer và giữ video/iframe trên nền tối bằng ngoại lệ rõ ràng.

**Behavior**: từ Dashboard light bấm “Đăng ký giờ tập” hoặc “Mở giáo án trực tuyến” thì destination và modal
vẫn sáng; chọn dark rồi reload/direct URL vẫn tối.

**Blast radius**: hai customer pages + CSS mapping dùng chung; không đổi routes hoặc server response.

**Verify**: schedule-booking + coaching E2E ở light/dark, desktop và mobile visual check.

### Step 3: Re-trace, review và QA tích hợp

Đi lại mọi nested trainer route và hai customer destination; kiểm loading/error/empty/modal, focus, native input,
mobile overflow và console. Review độc lập phải xác nhận không có chữ tối trên nền tối và không làm sáng video.

**Behavior**: toàn bộ workflow được yêu cầu giữ một preference theme, không regression auth/data/navigation.

**Verify**: client unit, current compile/release build, focused E2E, targeted/full lint, `git diff --check`.

## Test Plan

- Sửa E2E theme trainer để đi ít nhất Check-in, Coach Online, lịch tập và giáo án ở light; kiểm Orders/Hợp đồng/
  Lịch sử ở dark, dark persistence và always-light contract/signature surfaces.
- Mở rộng `schedule-booking.spec.js` cho light boundary, modal và dark reload.
- Mở rộng `coaching.spec.js` cho light boundary, toast theme marker và video dark exception.
- Tái sử dụng mock API/role headers hiện có; không gọi API thật hoặc production data.

## Done Criteria

- [x] Mọi nested route dưới `/trainer` đọc cùng `trainerTheme`; dark-only và light-only surfaces đều đổi đúng chiều.
- [x] `/book-training` và `/online-coaching` giữ customer theme từ Dashboard qua direct navigation/reload.
- [x] Video/iframe/overlay và CTA màu giữ dark/white contrast có chủ đích.
- [x] Desktop và 390px không tràn ngang; icon/theme control và focus states không regression.
- [x] Focused E2E, accessibility, client unit và build pass; lint có evidence thật.
- [x] Không đổi API/auth/schema, không còn debug log/import thừa do thay đổi tạo ra.
- [x] `docs/plans/README.md` cập nhật trạng thái plan.

## Verification Outcome — 2026-08-14

- Client lint: PASS.
- Release build: PASS (exit 0); local prerender skipped 38/38 public routes vì môi trường không có
  `VITE_API_URL` production và chặn Google Fonts. Compile, bundle và budget check hoàn tất.
- Client unit: PASS — 90 files, 449 tests.
- Server unit: PASS — 147 files, 754 tests.
- Full Playwright E2E: PASS — 81 tests, gồm theme route matrix và accessibility ở mobile.
- Visual local: PASS ở desktop và 390px cho Trainer Check-in light, Trainer Orders dark, Book Training light
  và Online Coaching light với media giữ dark.
- Secret scan và repository data-boundary: PASS.
- Dependency audit client/server: PASS sau khi staging branch cập nhật lockfile remediation.
- Ship decision: GO WITH ENVIRONMENT NOTE — local prerender không có `VITE_API_URL` nên không dùng
  làm SEO evidence; staging phải cung cấp API URL như cấu hình deploy hiện có.

## STOP Conditions

- Cần đổi deep link/API/auth để truyền theme.
- Cần refactor business logic trong file lớn thay vì wrapper/CSS scoped.
- Light mapping làm thay đổi Header/Footer/public tool ngoài hai destination được yêu cầu.
- Cùng một verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Theme preference tiếp tục dùng hai storage key riêng cho HLV và học viên.
- Component chạy cả embedded và standalone phải lấy theme từ ancestor/context, không hardcode default mới toàn site.
- Khi thêm legacy page vào `/trainer`, kiểm tra class gray/gradient mới và E2E theme trước deploy.
