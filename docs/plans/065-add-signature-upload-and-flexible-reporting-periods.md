# Plan 065: Thêm ảnh chữ ký Bên A và kỳ báo cáo tuần linh hoạt

> **Hướng dẫn thực thi**: Thực hiện theo từng behavior slice; chạy focused test
> trước khi chuyển bước. Drift check: đối chiếu các symbol trong Current State
> với branch `staging`; dừng nếu cần migration hoặc data write thật.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — dữ liệu sức khỏe quá khứ và chữ ký hợp đồng
- **Depends on**: 023, 060, 062
- **Category**: feature / ux / data-contract
- **Planned at**: 2026-08-24
- **Status**: IMPLEMENTED / LOCAL VERIFIED — FULL SERVER SUITE BLOCKED

## Why This Matters

HLV cần chữ ký rõ nét khi phát hành hợp đồng, còn khách hàng cần bổ sung số đo
đã quên trong ba tháng gần nhất. Kỳ báo cáo lẻ một vài ngày làm số liệu khó
đánh giá, và cấu trúc Nhật ký hiện tại không còn đủ rõ để mở rộng.

## Current State

- `client/src/components/SignatureCanvas.jsx` chỉ hỗ trợ vẽ và trả PNG data URL.
- `client/src/pages/admin/ContractEditModal.jsx` dùng `SignatureCanvas` cho Bên A
  và gửi `trainerSignature` qua API update hiện có.
- `client/src/utils/vietnamDate.js` và `server/src/utils/dateKey.js` chia phần lẻ
  đầu/cuối tháng thành báo cáo riêng.
- `server/src/services/weeklyCheckinAccess.service.js` chỉ cho ghi kỳ hiện tại
  hoặc liền trước; correction chưa phân biệt kỳ lịch sử.
- `client/src/pages/progress/WeeklyCheckinCard.jsx` chỉ render tháng của `dateKey`
  và hiển thị dòng header `Tuần N: d/m - d/m`.
- `client/src/pages/today-dashboard/TodayJournal.jsx` render nối tiếp báo cáo ngày,
  tuần và hoạt động trong cùng một cột.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Client focused tests | `npm run test:unit:client -- --run <files>` | exit 0 |
| Server focused tests | `npm run test:unit:server -- <files>` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client release build | `npm run build --prefix client` | exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | no new high |
| Security | `npm run security:secrets` và `npm run security:data-boundaries` | exit 0 |

## Scope

**In scope**:

- `client/src/components/SignatureCanvas.jsx`
- `client/src/components/signatureImage.js` và focused tests
- `client/src/pages/admin/ContractEditModal.jsx`
- `client/src/utils/vietnamDate.js` và tests
- `server/src/utils/dateKey.js` và tests
- `server/src/services/weeklyCheckinAccess.service.js`
- `server/src/services/weeklyCheckin.service.js`
- `server/src/controllers/__tests__/weeklyCheckin.integration.test.js`
- `client/src/pages/progress/WeeklyCheckinCard.jsx`
- `client/src/pages/progress/__tests__/progress.test.js`
- `client/src/pages/today-dashboard/TodayJournal.jsx`
- focused E2E/component tests, spec/plan/index liên quan

**Out of scope**: Mongoose schema, migration/backfill, chữ ký số/OTP, lưu chữ ký
dùng chung theo tài khoản, thay đổi PDF/backend signature contract, staging hoặc
production write, và phân tích DevOps/video ở yêu cầu số 6.

## Steps

### Step 1: Gộp kỳ lẻ và mở cửa sổ lịch sử server-authoritative

Thêm `rangeStartDateKey` vào period presentation trong hai date utility, giữ
`startDateKey` là storage key của tuần đầy đủ. Mở write window cho current month
và ba tháng trước; chỉ current period được correction.

**Behavior**: tháng 8/2026 có bốn period đúng spec; historical draft submit được
một lần, correction bị 409; future/too-old bị 422.

**Verify**: date utility tests và weekly integration tests pass.

### Step 2: Cho khách chọn bốn tháng và cảnh báo kỳ quá khứ

Thêm month selector, period selector dùng range trình bày, inline warning yêu cầu
xác nhận trước khi mở form lịch sử và khóa báo cáo lịch sử đã gửi. Xóa header
`Tuần N:` và đổi heading card thành `Kết quả tuần`.

**Behavior**: UI chọn đúng bốn tháng; past empty report chỉ editable sau warning;
past submitted read-only; current giữ correction hiện có.

**Verify**: focused form/presentation tests và E2E mock journey pass.

### Step 3: Tách Nhật ký báo cáo ngày và tuần

Thêm tablist product-style trong `TodayJournal`; daily chứa Wellness/Habit/Activity,
weekly chứa WeeklyCheckin. Deep-link `#weekly-report` chọn tab tuần trước khi scroll.

**Behavior**: chỉ panel được chọn hiển thị; điều hướng bàn phím/focus và anchor
notification hoạt động.

**Verify**: component/E2E selectors xác nhận cả hai tab và nội dung đúng nhóm.

### Step 4: Tải và chuẩn hóa ảnh chữ ký Bên A

Thêm utility validate/normalize ảnh nguồn, UI upload phía trên canvas và preview
phía dưới. Chỉ `ContractEditModal` bật upload; output tiếp tục đi qua
`trainerSignature` cũ.

**Behavior**: PNG/JPEG/WebP hợp lệ tạo PNG bounded, preview được render và thay
thế khi vẽ/xóa; invalid source hiển thị lỗi mà không đổi signature hiện tại.

**Verify**: utility/component tests, existing contract service/integration tests
và client build pass.

### Step 5: Re-trace và chạy release gates

Trace lại period producer/consumer, signature validation/payload và deep-link.
Chạy focused/full QA tương xứng, lint, build, UI regression, secrets/boundaries,
`git diff --check` và cleanup.

**Behavior**: không consumer nào còn giả định period lẻ cũ; không có schema,
route hoặc security regression.

**Verify**: mọi gate đã nêu exit 0 hoặc blocker môi trường được ghi chính xác.

## Test Plan

- Date utilities: tháng có phần lẻ hai đầu, tháng bắt đầu Thứ Hai/kết thúc Chủ
  Nhật và previous-period qua ranh giới tháng.
- Weekly API: current correction, historical first submit, historical correction
  denied, future denied, fourth previous month denied, invalid period key denied.
- Weekly UI: month list bốn phần tử, warning/acknowledge, historical locked và
  không còn header `Tuần N:`.
- Signature: accept types, reject type/size, bounded data URL và upload UI opt-in.
- Journal: tab grouping và `#weekly-report` mở đúng panel.

## Done Criteria

- [x] Mọi success criterion trong spec đạt.
- [x] Không có migration/data write hoặc schema/route mới.
- [x] Client build, focused client/server tests và security gates pass.
- [x] Không còn temp/debug code hay file ngoài scope do thay đổi này tạo ra.
- [x] Row Plan 065 được cập nhật trạng thái/evidence thật.

## Verification Evidence

- Focused client: `5` test files, `33/33` tests pass.
- Full client unit suite: `534/534` tests pass.
- Focused server date/weekly/contract: `3` test files, `20/20` tests pass.
- Affected server consumers: `27/27` tests pass.
- Focused E2E: `2/2` journeys pass với exit `0` (khóa thao tác khi xử lý ảnh
  chữ ký và deep-link Nhật ký mở đúng kỳ báo cáo).
- Client lint, compile và release build: exit `0`; bundle budget pass.
- UI regression gate: `0` lỗi mới, `0` lỗi blocking độ tin cậy cao.
- Secret scan, repository data-boundary scan và agent instructions: exit `0`.
- Independent code review sau khi sửa race xử lý ảnh: `PASS`, không còn finding
  mức BLOCK/HIGH/MED.
- `git diff --check`: pass.
- Postbuild prerender tạo `0/38` trang trong sandbox vì network/Google Fonts bị
  chặn và thiếu `VITE_API_URL`; release command vẫn exit `0`, compile/bundle
  không lỗi.
- Full server suite đã thử nhưng treo nhiều phút mà không in assertion nên đã
  dừng; không được tính là PASS. Các suite trực tiếp và consumer bị ảnh hưởng ở
  trên đều pass.

## STOP Conditions

- Cần gộp/xóa/backfill WeeklyCheckin đã tồn tại để hiển thị đúng.
- Cần lưu file chữ ký nguồn hoặc nới giới hạn backend 512 KB.
- Phải đổi ownership/CSRF/idempotency để hoàn thành.
- Cùng focused verification thất bại ba vòng sau sửa có căn cứ.

## Maintenance Notes

- `startDateKey` là storage key; UI phải dùng `rangeStartDateKey` khi hiển thị đầu
  khoảng. Không đổi hai nghĩa này nếu chưa có migration plan.
- Chữ ký upload không phải chữ ký số được chứng thực và không được quảng bá như
  chứng thư số.
- Yêu cầu DevOps/video số 6 được defer tới sau khi Plan 065 hoàn tất.
