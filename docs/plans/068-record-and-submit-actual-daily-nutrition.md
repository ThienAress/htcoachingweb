# Plan 068: Ghi và gửi dinh dưỡng thực tế trong ngày

> **Hướng dẫn thực thi**: Thực hiện theo từng behavior slice, viết test RED trước
> khi sửa runtime và chạy focused test sau mỗi slice. Không migration, seed, cleanup,
> deploy hoặc ghi local/staging/production database.
>
> **Drift check**: Working tree đang chứa thay đổi hợp lệ từ các task trước. Chỉ sửa
> file in-scope, không reset/checkout hoặc format diện rộng.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 003C, 003D, 060, 067
- **Category**: feature
- **Planned at**: 2026-08-25
- **Status**: IMPLEMENTED / LOCAL VERIFIED — PRERENDER ENV BLOCKED

## Why This Matters

Today Nutrition hiện chỉ lưu trạng thái bữa và render snapshot thực đơn gốc. Khách
không thể ghi lượng thực tế, tổng ngày cộng cả bữa chưa ăn và HLV chưa có báo cáo
dinh dưỡng bất biến để xem. `Cần chú ý` cũng đang cảnh báo mọi mức đau lớn hơn 0,
gây nhiễu cho HLV.

Khi hoàn tất, khách điều chỉnh gram từng thực phẩm, xác nhận bữa đã ăn, xem chênh
lệch so với thực đơn gốc và gửi báo cáo dinh dưỡng đúng một lần; HLV chỉ thấy snapshot
đã gửi. Cảnh báo sức khỏe chỉ xuất hiện ở mức nặng.

## Product Decisions

1. Client chỉ gửi `foodId` và `amountGrams`; backend đối chiếu Saved Meal Plan đã gắn,
   scale macro từ snapshot canonical và lưu snapshot thực tế.
2. Mỗi follow-plan entry lưu lượng kế hoạch, lượng thực tế, macro thực tế và tổng bữa.
   Document cũ thiếu field được fallback về lượng kế hoạch, không backfill.
3. `Điều chỉnh` thay cho trạng thái user-visible `Đã đổi`. Nội bộ có thể giữ status
   `changed` để tương thích; chỉ `eaten` được cộng vào tổng ngày.
4. Card tổng ngày so sánh `đã ăn / tổng thực đơn gốc` cho kcal, protein, carb và fat,
   kèm `Còn thiếu`, `Đã đạt` hoặc `Vượt`.
5. `nutrition.submittedAt` có vòng đời riêng với `DailyJournal.status`. Sau khi có giá
   trị này, mọi mutation nutrition bị backend từ chối; wellness/habit vẫn theo lifecycle
   Daily Journal hiện có.
6. Endpoint submit nutrition dùng auth, ownership, CSRF, rate limit, optimistic revision
   và request-id replay hiện có. Gửi lần hai trả conflict; replay cùng request-id an toàn.
7. HLV chỉ nhận nutrition khi `nutrition.submittedAt` tồn tại và chỉ render entry `eaten`.
   Wellness draft không được lộ khi chỉ nutrition đã gửi.
   Submit tạo thông báo tiếng Việt, không chứa số liệu nhạy cảm và deep link tới đúng
   khách hàng/ngày/card báo cáo dinh dưỡng.
8. Attention mức nặng dùng ngưỡng: stress >= 8, soreness >= 8, pain >= 7.

## Expected File Surface

- Backend Daily Journal model/revision, DTO, nutrition canonicalization, command,
  controller, routes, validation và integration tests.
- Today source/trainer overview/attention service và integration tests.
- Client Today Nutrition helper, service, card, meal editor/summary và tests.
- Trainer overview nutrition report, copy cleanup và tests.
- Specs/plan index.

## Tasks và Verification Gates

### 1. Contract và canonical nutrition snapshot

- RED: 250g đổi thành 150g được scale đúng; macro client gửi lên bị từ chối; tổng DTO
  chỉ cộng entry `eaten`.
- GREEN: schema additive/default, allowlist adjustment input, canonical snapshot và DTO.
- Verify: Daily Journal Nutrition integration tests.

### 2. Nutrition submit một lần

- RED: submit thành công, replay idempotent, lần gửi mới bị từ chối và mọi nutrition
  mutation sau gửi bị khóa.
- GREEN: route/controller/service dùng transaction, revision và CSRF/rate limit hiện có.
- Verify: route integration tests và security contract.

### 3. Today Nutrition UI

- RED: editor gram, tổng chỉ bữa đã ăn, so sánh mục tiêu, cảnh báo gửi một lần và
  trạng thái locked.
- GREEN: inline editor accessible, CTA gửi rõ ràng và loading/error/disabled states.
- Verify: focused component/helper tests, lint và UI regression gate.

### 4. HLV report và attention

- RED: trainer chỉ đọc nutrition đã gửi, không thấy wellness draft; IDOR giữ nguyên;
  attention chỉ có stress/soreness/pain vượt ngưỡng.
- GREEN: card báo cáo dinh dưỡng snapshot và copy/heading theo yêu cầu.
- Verify: trainer overview integration/component tests.

### 5. Integrated QA và cleanup

- Chạy focused tests trước, sau đó client/server unit tương xứng.
- Chạy client lint/build, UI regression gate, secret/data-boundary scan,
  `npm run agents:validate` và `git diff --check`.
- Review Standards, Spec/Contract và Security/Operations; không để import/debug code thừa.

## Compatibility and Data Safety

- Field mới additive và có fallback; không migration/backfill.
- Không tin totals, label hoặc macro từ client.
- Trainer read tiếp tục re-check quan hệ coaching hiện tại; snapshot trainer chỉ đọc.
- Export/delete/retention vẫn đi cùng Daily Journal hiện có, không tạo collection mới.
- Không ghi database thật; integration tests chỉ dùng MongoDB Memory Server.

## Success Criteria

- Khách sửa gram từng món và server tính đúng macro thực tế.
- Tổng ngày chỉ cộng bữa `Đã ăn`, so sánh rõ với thực đơn gốc.
- Báo cáo dinh dưỡng gửi đúng một lần và khóa mutation ở cả UI/backend.
- HLV thấy đúng snapshot bữa đã ăn và tổng ngày, không thấy draft wellness.
- `Cần chú ý` không cảnh báo mức trung bình/hơi đau.

## Verification Evidence — 2026-08-25

- Client unit: 118 files, 551 tests pass; focused nutrition/trainer/progress tests
  tiếp tục pass sau cleanup.
- Server relevant regression: 10 files, 60 tests pass; focused nutrition,
  notification, trainer overview và timeline suites tiếp tục pass sau thay đổi cuối.
- Client lint, Vite compile, bundle budget, UI regression gate, secret scan,
  repository data-boundary scan, agent validation và `git diff --check` pass.
- Full public prerender chạy fallback nhưng render 0/38 route vì môi trường local chặn
  network/font và thiếu `VITE_API_URL`; private dashboard feature không thêm public route.
- Không chạy migration/seed, không ghi database thật và không deploy.
