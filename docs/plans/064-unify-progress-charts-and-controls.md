# Plan 064: Thống nhất biểu đồ và điều khiển Tiến trình

> **Hướng dẫn thực thi**: Thực hiện theo từng behavior slice và chạy focused test sau mỗi slice.
> Nếu cần đổi progress API/read model, thêm dependency hoặc schema thì dừng và xin quyết định.
>
> **Drift check**: Bảo toàn toàn bộ thay đổi Plan 062–063 đang có trong working tree. Đối chiếu
> `ProgressSummary`, ba progress report, `ProgressPage`, `TrainerClientOverview` và `WellnessFields`
> trước mỗi edit; không restore hoặc format file ngoài phạm vi.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — shared customer/trainer UI, responsive/accessible charts
- **Depends on**: 062, 063
- **Category**: feature / ux / tests
- **Planned at**: 2026-08-23
- **Status**: IMPLEMENTED / LOCAL VERIFIED — MANUAL AUTH BLOCKED

## Why This Matters

Progress hiện lặp toolbar và report card, đồng thời đặt cùng hành động làm mới ở nhiều ngữ cảnh.
Compliance chưa có một trục so sánh chung; wellness chỉ hiển thị snapshot/thanh trung bình dù API đã
có daily series. Plan này biến hai section thành biểu đồ phù hợp với contract thật và giảm chrome lặp.

## Current State

- `ProgressSummary.jsx` render `SectionToolbar` thành card riêng trước report card.
- `ProgressPage.jsx` truyền cùng `RefreshButton` vào landing và `rangeControls`.
- `ProgressWellnessOverview.jsx` có mode ngày/tổng quan, title động chứa ngày và các progress bar.
- `progress.compliance` chỉ có `{ numerator, denominator, percent }` aggregate.
- `progress.wellness.daily` đã có tám field nullable theo `dateKey`, đủ cho client trend chart.
- `WellnessFields.jsx` lặp cùng helper dưới năm select và dùng placeholder `Chưa ghi`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused progress | `npm run test:unit:client -- --run src/pages/progress/__tests__/progressCharts.test.js src/pages/progress/__tests__/ProgressSummary.test.jsx` | exit 0 |
| Focused wellness form | `npm run test:unit:client -- --run src/pages/today-dashboard/__tests__/WellnessFields.test.jsx` | exit 0 |
| Client tests | `npm run test:unit:client` | exit 0 |
| Lint | `npm run lint --prefix client` | exit 0 |
| Compile | `npx vite build` trong `client/` | exit 0 |
| UI regression | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` | 0 new high |

## Scope

**In scope**:

- Progress reports/charts/presentation và focused tests trong `client/src/pages/progress/`.
- Vị trí refresh/range ở `ProgressPage.jsx` và `TrainerClientOverview.jsx`.
- Placeholder/helper trong `WellnessFields.jsx` và component test.
- Spec/plan/index/evidence tương ứng.

**Out of scope**:

- Backend progress read model, schema, migration, seed hoặc data write.
- Compliance trend theo tuần/ngày; cần API contract riêng nếu làm sau.
- Goal line, đánh giá tốt/xấu hoặc khuyến nghị y khoa.
- Deploy, commit, push và mọi thao tác production.

## Steps

### Step 1: Hợp nhất header, refresh và section card

Viết RED component tests cho header luôn hiện, section title không lặp và refresh chỉ có một vị trí.
Tách header chung khỏi landing; tích hợp back/range vào từng report card, giữ focus return hiện có.

**Behavior**: landing và section dùng cùng header; mỗi section chỉ có một card nội dung.

**Verify**: focused `ProgressSummary` tests pass.

### Step 2: Trực quan hóa compliance và wellness theo đúng contract

Viết RED tests cho common-axis compliance bars và daily wellness model. Render một wellness metric tại
một thời điểm, average reference, gap, empty/single point và score domain `0–10`.

**Behavior**: khách/HLV so sánh mức thực hiện và đọc xu hướng sức khỏe không bị sai unit/missing.

**Verify**: focused progress/chart tests pass.

### Step 3: Tinh gọn form cảm nhận và hoàn tất QA

Viết RED test cho năm `Chưa chọn` cùng một helper; sửa component, rồi chạy full client QA, lint,
compile, UI regression, review ba trục và cleanup.

**Behavior**: form không lặp hướng dẫn và vẫn giữ validation/disabled/error state.

**Verify**: focused WellnessFields, full client, lint, compile và UI regression pass hoặc blocker môi
trường được ghi chính xác.

## Test Plan

- Chart helper: sort/filter, daily gap, average, score fixed domain, responsive coordinates.
- Component: header/action count, landing/section structure, compliance missing vs 0%, wellness title/selectors.
- Form: placeholder count, helper count, errors/disabled không regress.
- Manual nếu có authenticated session: 1024/736/360px, pointer, keyboard, touch và no horizontal page scroll.

## Done Criteria

- [x] Spec success criteria đạt đủ.
- [x] Không đổi backend/API/schema và không thêm dependency.
- [x] Plan 062–063 changes được bảo toàn.
- [x] Không debug log, commented code hoặc unused import mới.
- [x] `docs/plans/README.md` và evidence phản ánh kết quả thật.

## Verification Evidence

- RED: focused suite fail đúng vì thiếu wellness chart model, section/header/card contract mới và form
  vẫn lặp helper/placeholder cũ.
- Focused integration sau GREEN: 8 files / 46 tests pass.
- Full client cuối: 113 files / 526 tests pass, exit 0.
- Vite production compile cuối: 2.896 modules, pass.
- Full client ESLint, UI regression (`0` finding mới mức cao, `10` resolved), secret scan,
  repository data-boundary scan và `git diff --check`: pass.
- Review ba trục Standards / Spec-Contract / Security-Operations: không còn finding; regression
  ngoài miền `0–10` được thêm RED test và sửa fail-closed trước review cuối.
- Manual authenticated render: blocked. In-app Browser chuyển tới `/login`; Chrome connector không
  available. Không đăng nhập, submit form hoặc ghi dữ liệu để vượt blocker.
- E2E: skip vì thiếu authenticated browser/session phù hợp. Release lifecycle build không chạy vì
  task không deploy; QA dùng compile-only đúng mode client.

## STOP Conditions

- Compliance chart yêu cầu time series thay vì aggregate đã duyệt.
- Wellness daily không giữ được missing/null semantics từ response hiện tại.
- Cần sửa component ngoài dependency map hoặc verification fail ba vòng sau sửa có căn cứ.

## Maintenance Notes

- Không dùng line chart cho compliance cho tới khi server có canonical period series.
- Wellness metric khác unit phải dùng selector/một chart, không đặt chung một Y axis.
- `Cập nhật dữ liệu` thuộc page/query owner; report child không tự gọi service hoặc `refetch`.
