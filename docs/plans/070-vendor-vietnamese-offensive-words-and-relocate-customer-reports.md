# Plan 070: Ghim kho từ ngữ không phù hợp và chuyển báo cáo sang khu vực hỗ trợ

> **Hướng dẫn thực thi**: Thực hiện theo từng bước, chạy verification tương ứng
> trước khi chuyển bước. Không cập nhật dependency từ GitHub lúc runtime và không
> mở rộng kho từ mới sang AI Chat trong plan này.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 067, 068, 069
- **Category**: feature
- **Planned at**: 2026-08-26
- **State**: DONE / LOCAL VERIFIED

## Why This Matters

Danh sách từ ngữ cấm ngắn đang bị sao chép giữa client và server nên bỏ sót nhiều
biến thể tiếng Việt/teencode. Kho dữ liệu upstream hữu ích nhưng không có package
hoặc release ổn định để dùng trực tiếp khi chạy. Ở workspace HLV, `Báo cáo khách
hàng` là đầu vào cho việc theo dõi và hỗ trợ nên không phù hợp khi nằm trong tab
`Tổng quan` trong khi mục tiêu và thói quen ở tab riêng.

## Current State

- `server/src/services/savedMealPlanTitlePolicy.service.js` là validation cuối cho
  tên Saved Meal Plan nhưng chỉ có một danh sách hardcode ngắn.
- `client/src/utils/savedMealPlan.js` giữ một subset tương tự để phản hồi sớm ở UI;
  backend vẫn phải là nguồn quyết định canonical.
- Upstream `blue-eyes-vn/vietnamese-offensive-words` phát hành dữ liệu dưới MIT,
  file `vn_offensive_words.txt` gồm từ có dấu, không dấu, viết tắt và teencode;
  dòng bắt đầu bằng `#` là chú thích. Snapshot được ghim tại commit
  `684b568e4d54ce47b743d7c564447e29a02cc260`.
- `TrainerCustomerReports` đang được render trong `TrainerClientOverview`; tab
  `tasks` chỉ render mục tiêu sức khỏe và quản lý thói quen.
- Thông báo nhật ký/dinh dưỡng hiện tạo anchor `#journal` hoặc
  `#nutrition-report` mà chưa chỉ định tab chứa báo cáo.

## Scope

### In scope

- Vendor snapshot upstream và license/attribution trong server; không gọi GitHub
  ở runtime và không thêm package dependency.
- Parser bỏ comment/dòng trống, normalize Unicode/whitespace và compile matcher
  một lần với Unicode token boundary để tránh chặn substring vô hại.
- Áp matcher mới cho tên Saved Meal Plan ở backend. Frontend giữ subset validation
  nhanh hiện có; response backend vẫn là nguồn cuối.
- Đổi label tab `tasks` thành `Theo dõi và hỗ trợ`, chuyển `Báo cáo khách hàng`
  vào tab này trước mục tiêu sức khỏe và thói quen.
- Deep-link nhật ký/dinh dưỡng mới thêm `tab=tasks`; client canonicalize link cũ
  đã lưu để bookmark/thông báo cũ vẫn mở đúng mục.

### Out of scope

- Không áp kho upstream vào `server/src/services/ai/contentModeration.js` vì AI
  moderation có lifecycle cảnh báo/khóa tài khoản riêng và cần false-positive
  evaluation trước khi mở rộng.
- Không thay schema, migration, seed hoặc ghi dữ liệu local/staging/production.
- Báo cáo tuần và `#weekly-report` tiếp tục nằm ở `Tổng quan`.
- Không tự động đồng bộ snapshot từ upstream; nâng commit là thay đổi được review.

## Steps

### Step 1: Ghim và áp kho từ ngữ không phù hợp cho tên thực đơn

**Behavior**: Tên có biến thể trong snapshot upstream bị backend từ chối; tên sạch
có chứa chuỗi gần giống bên trong từ khác vẫn được chấp nhận.

**Blast radius**: vendor data/license, matcher service, Saved Meal Plan title
policy và focused tests. Không đổi API/error code.

**Verify**: focused service tests và Saved Meal Plan integration test pass.

### Step 2: Chuyển báo cáo khách hàng sang tab Theo dõi và hỗ trợ

**Behavior**: `Tổng quan` không còn card báo cáo; `Theo dõi và hỗ trợ` lần lượt có
báo cáo khách hàng, mục tiêu sức khỏe và thói quen. Loading/error/empty state dùng
query hiện có và khi chuyển tab không tạo API contract mới.

**Blast radius**: workspace helpers/component, overview surface và component tests.

**Verify**: focused trainer client tests pass; UI regression gate không có lỗi high mới.

### Step 3: Giữ deep-link cũ và phát hành deep-link canonical mới

**Behavior**: thông báo nhật ký/dinh dưỡng mới mở `tab=tasks` đúng khách/ngày/anchor;
link cũ thiếu tab được client nâng cấp khi người dùng bấm. Báo cáo tuần không đổi tab.

**Blast radius**: notification service, destination adapter và notification tests.

**Verify**: focused client notification tests cùng server notification/nutrition
integration tests pass.

## Test Plan

- Matcher: parse comment/delimiter, Unicode/case, whitespace, teencode có trong
  upstream, token boundary và chuỗi sạch chứa substring gần giống.
- Saved Meal Plan API: error code `INVALID_SAVED_MEAL_PLAN_TITLE` không đổi.
- Workspace: label mới, normalization `wellness`/`habits` vẫn về `tasks`, report
  chỉ render ở đúng surface.
- Notification: journal/nutrition mới có `tab=tasks`; weekly link giữ overview;
  unsafe external link tiếp tục fail closed; legacy internal link được canonicalize.
- UI: tab hoạt động bằng keyboard, focus anchor báo cáo và loading/error/retry giữ nguyên.

## Done Criteria

- [x] Snapshot MIT được ghim commit, có attribution/license và không có runtime network.
- [x] Backend chặn biến thể upstream trong tên thực đơn mà không match substring tùy tiện.
- [x] Tab hiển thị `Theo dõi và hỗ trợ`; Báo cáo khách hàng không còn ở Tổng quan.
- [x] Notification mới/cũ đều mở đúng tab, ngày và báo cáo; weekly link không bị đổi.
- [x] Specs, focused tests, lint, UI gate, agent validation và `git diff --check` đạt.
- [x] `docs/plans/README.md` cập nhật trạng thái thực tế.

## STOP Conditions

- Dừng nếu upstream license tại commit ghim không phải MIT hoặc file dữ liệu không
  thể truy xuất đúng commit.
- Dừng nếu matcher mới cần đưa raw từ vi phạm vào log/response hoặc thay error contract.
- Dừng nếu chuyển báo cáo đòi đổi schema/API response hay ghi/backfill dữ liệu thật.
- Dừng nếu cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Muốn nâng snapshot phải đổi commit trong attribution, review diff dữ liệu và chạy
  lại false-positive tests; không theo nhánh `main` tự động.
- Frontend subset chỉ tối ưu UX. Không coi frontend là trust boundary hoặc copy toàn
  bộ snapshot sang bundle trình duyệt.
- AI Chat moderation được defer có chủ đích do tác động khóa tài khoản; cần plan/eval riêng.

## Verification Evidence

- Snapshot local khớp chính xác 455 dòng upstream tại commit đã ghim sau khi
  normalize line ending; license MIT được lưu kèm.
- Focused server cuối: 20/20 pass; nhóm notification/nutrition trước đó: 41/41 pass.
- Full client trước thay đổi helper cuối: 561/561 pass; focused client cuối: 27/27 pass.
- Client lint pass; Vite compile production pass (2.903 modules).
- UI regression gate: 0 finding mới, 0 high-confidence blocking, 10 finding cũ resolved.
- `npm run agents:validate` pass; `git diff --check` không có whitespace error.
- Full server suite được khởi chạy nhưng không kết thúc trong thời gian kiểm tra và
  đã dừng thủ công; không tuyên bố pass. E2E không chạy vì task không có dev server/
  fixture đăng nhập sẵn. Review độc lập cuối: PASS, còn gap không blocking là chưa có
  MemoryRouter component test cho thao tác replace URL legacy.
