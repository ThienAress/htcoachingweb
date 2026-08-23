# Plan 063: Xây biểu đồ Tiến trình cơ thể rõ xu hướng

> **Hướng dẫn thực thi**: Thực hiện từng behavior slice và chạy verification tương ứng. Nếu cần
> schema/migration, nguồn mục tiêu mới hoặc dependency chart mới thì dừng và xin quyết định.
>
> **Drift check**: Đối chiếu `BodyProgressReport`, `progressCharts`, `ProgressSummary`, hai consumer
> khách/HLV, validation và progress read model với branch `staging`; giữ nguyên mọi thay đổi Plan 062
> đang có trong working tree.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — health read model, shared customer/trainer UI và responsive SVG
- **Depends on**: 047, 062
- **Category**: feature / ux / data-contract
- **Planned at**: 2026-08-23
- **Status**: IMPLEMENTED / LOCAL VERIFIED — POSTBUILD + MANUAL AUTH BLOCKED

## Why This Matters

Bốn chart nhỏ hiện buộc người dùng đọc từng card và không thể xem chi tiết theo thời điểm. Một biểu đồ
lớn theo chỉ số giúp thấy xu hướng, nhận ra kỳ thiếu dữ liệu và so sánh đầu–cuối mà vẫn giữ đúng nguồn
báo cáo tuần. Khoảng 6 tháng cần được hỗ trợ xuyên API mà không làm mất lựa chọn 7 ngày của các section khác.

## Current State

- `client/src/pages/progress/BodyProgressReport.jsx` render bốn `BodyMetric`, mỗi metric tự chứa một SVG nhỏ.
- `client/src/pages/progress/progressCharts.js` dùng viewBox cố định, loại missing point rồi nối các điểm còn lại.
- `client/src/pages/progress/ProgressSummary.jsx` đặt range controls chung trong section toolbar.
- `client/src/pages/progress/ProgressPage.jsx` và `TrainerClientOverview.jsx` chỉ có `[7, 30, 90]`.
- `server/src/services/progressReadModel.service.js` và validation chỉ allow `7/30/90`.
- `server/src/services/progressSources.service.js` giới hạn 20 báo cáo, không đủ chắc chắn cho 180 ngày.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused client | `npm run test:unit:client -- --run src/pages/progress/__tests__/progressCharts.test.js src/pages/progress/__tests__/BodyProgressReport.test.jsx src/pages/progress/__tests__/ProgressSummary.test.jsx` | exit 0 |
| Focused server | `npm run test:unit:server -- --run src/services/__tests__/progressReadModel.test.js src/controllers/__tests__/progress.integration.test.js src/controllers/__tests__/trainerClientOverview.integration.test.js` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Compile build | `npx vite build` trong `client/` | exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | 0 new high |

## Scope

**In scope**:

- Progress chart UI/helper/tests trong `client/src/pages/progress/`.
- Range state của `ProgressPage.jsx` và `TrainerClientOverview.jsx`.
- Allowlist/error contract 180 ngày, source query limit và progress tests phía server.
- Spec/plan/index tương ứng.

**Out of scope**:

- Mongoose schema, migration/backfill/seed.
- Goal line, target progress, rolling average và đánh giá tốt/xấu.
- Các chart Bước chân, Giấc ngủ, Nước uống, wellness hoặc compliance.
- Deploy và mọi ghi dữ liệu local/staging/production.

## Steps

### Step 1: Mở range 180 ngày xuyên khách và HLV

Viết RED test cho `createProgressRange(180)`, API progress và Trainer Overview. Mở allowlist/server error,
tăng bounded query limit đủ cho 6 tháng, rồi thêm range mapping phía hai consumer mà vẫn giữ `7/30/90`
cho section không phải body.

**Behavior**: khách/HLV xem body 180 ngày; chuyển section không gửi range không hợp lệ.

**Verify**: focused server progress/overview tests và client source/component tests pass.

### Step 2: Thay bốn chart nhỏ bằng selector và một chart lớn

Viết RED tests cho một chart duy nhất, active metric, responsive model, single point và path ngắt ở kỳ
missing. Tách chart tương tác thành component có pointer/focus/touch detail và SVG axes rõ unit.

**Behavior**: chọn một số đo cập nhật chart; summary bốn số đo vẫn nhìn thấy và missing không bị nối xuyên.

**Verify**: focused `progressCharts`, `BodyProgressReport`, `ProgressSummary` tests pass.

### Step 3: Tích hợp, review và kiểm tra giao diện

Chạy full client, focused server, lint, compile build, UI regression và `git diff --check`. Kiểm desktop/mobile,
keyboard focus, tooltip/detail, empty và single-point nếu local browser có session phù hợp.

**Behavior**: customer/trainer dùng chung component mà không regress section navigation.

**Verify**: tất cả gate đã liệt kê exit 0 hoặc blocker môi trường được ghi chính xác.

## Test Plan

- Server: allow 180, reject ngoài allowlist, range start/end đúng, authorized trainer overview không bị cắt source.
- Chart helper: scale theo metric, single point, inferred monthly-period gap, responsive width và path không nối qua null.
- Component SSR: đúng bốn tabs, chỉ một SVG/chart, empty state, unit `%` không có khoảng trắng sai.
- Manual: 1024/736/360px, pointer, keyboard, touch, no horizontal overflow.

## Done Criteria

- [x] Spec success criteria đạt đủ.
- [x] Không thêm chart dependency hoặc schema/migration.
- [x] Existing Plan 062 changes được bảo toàn.
- [x] Không debug log, commented code hoặc unused import do task tạo ra.
- [x] `docs/plans/README.md` phản ánh trạng thái thực tế.

## Verification Evidence

- Focused client: 5 files / 32 tests pass; chart-focused subset: 3 files / 14 tests pass.
- Focused server: 3 files / 18 tests pass.
- Full client: 112 files / 521 tests pass.
- Full server tuần tự: 182 files / 954 tests pass, exit 0.
- Client ESLint, UI regression (`0` finding mới mức cao, `10` resolved), secret scan,
  repository data-boundary scan và `git diff --check`: pass.
- Vite production compile: 2.892 modules, pass. Full `npm run build --prefix client` exit 1 ở
  postbuild: prerender thiếu `VITE_API_URL` và bị sandbox chặn mạng (`0/38` route), đồng thời bundle
  `f1-workflow` của working tree vượt budget (`264,7/73,9 kB` so với `240/70 kB`). Hai blocker này
  nằm ngoài phạm vi biểu đồ Plan 063.
- Render/manual trên trang thật chưa xác nhận vì in-app Browser không có authenticated session;
  không dùng login hoặc ghi dữ liệu để vượt qua blocker này.

## STOP Conditions

- Cần nguồn mục tiêu số đo mới hoặc thay đổi `WeeklyCheckin` schema.
- Cần nối draft/private health data vào chart.
- Range 180 gây query không thể giữ bounded mà không đổi kiến trúc pagination.
- Cùng verification fail ba vòng sau sửa có căn cứ.

## Maintenance Notes

- Range của body và range của section khác có chủ ý khác nhau; không gom lại một constant global duy nhất.
- Nếu thêm goal line sau này, phải xác định source/owner/effective date cho từng metric bằng spec riêng.
- `weekStartDateKey` là period start trong tháng; chart gap phải theo period catalog, không giả định mọi điểm cách đúng 7 ngày.
