# Báo cáo audit contract FE/BE ngày 28/07/2026

## Phạm vi và mốc tham chiếu

- Mốc lịch sử: `docs/conversation-handoff-2026-07-28.md`; snapshot ổn định cũ là commit `4059cfe` ngày 25/07/2026.
- Phạm vi quét: client services ↔ Express routes, request/response shape, enum/status, pagination, money, quota, duration, entitlement và các nguồn dữ liệu lặp giữa FE/BE.
- Feature Free và cấp gói HLV theo email là thay đổi đang phát triển sau snapshot, nên được audit cùng code hiện tại chứ không so ngược về hành vi cũ.
- Không chạy migration, seed hoặc thao tác ghi dữ liệu staging trong giai đoạn audit.

## Kết luận ngắn

Audit mở rộng xác nhận 10 contract drift/guard failure, gồm checkout giá cũ, route HLV không tồn tại, phân trang mất dữ liệu, quota Meal Plan, status UI, policy nạp ví, lỗi phân quyền khi API tạm lỗi và JSON-LD prerender thiếu giá. Tất cả findings đã được sửa theo hướng backend-authoritative, fail-closed và có regression/CI guard; không còn nguồn giá HLV runtime thứ hai ở frontend.

## Findings và kết quả xử lý

### CT-01 — HIGH — Checkout có thể xác nhận một giá nhưng backend trừ giá khác

- Catalog chuẩn hiện ở `server/src/services/trainerPlanCatalog.service.js:1`.
- FE vẫn fallback số tiền tại `client/src/sections/Pricing.jsx:344`, `:345`, `:371`, `:372`, `:409`, `:410`.
- Request tại `client/src/services/trainerSubscription.service.js:6` chưa gửi `expectedAmount`, catalog fingerprint và protocol version.
- Backend controller cũ giữ catalog thứ hai tại `server/src/controllers/trainerSubscription.controller.js:16` và purchase handler legacy từ `:68`.
- SEO lặp giá tại `client/src/pages/Home.jsx:77-107`.

Tác động: FE cũ hoặc cache cũ có thể hiển thị giá A trong khi ledger dùng giá B. Backend vẫn chống việc client tự sửa số tiền, nhưng chưa chống việc user xác nhận trên catalog đã cũ.

Hướng sửa: fingerprint catalog deterministic; client gửi amount/fingerprint/version; backend fail `409 CATALOG_CHANGED` trước mọi write; bỏ fallback và handler/catalog legacy.

### CT-02 — HIGH — Dropdown gán HLV gọi endpoint không tồn tại

- `client/src/pages/admin/Orders.jsx:37` import `getTrainers` từ user service và gọi tại `:82`.
- `client/src/services/user.service.js:9` gọi `GET /user/trainers`.
- `server/src/routes/user.routes.js` không khai báo route này.
- Không thể thay bằng public Trainer profile service vì `Order.trainerId` tham chiếu `User`, còn `_id` của `Trainer` là document hồ sơ khác.

Tác động: admin không tải được danh sách tài khoản HLV để tạo/gán đơn.

Hướng sửa: endpoint admin “trainer assignment candidates”, lấy `User.role=trainer` hoặc user có `TrainerSubscription` active, dedupe, search và paginate.

### CT-03 — HIGH — FE gửi `limit=0` để lấy tất cả nhưng BE chỉ trả 5

- `client/src/pages/trainer/Dashboard.jsx:27` và `client/src/pages/admin/CustomerStoryManagement.jsx:243` gọi `getOrders(1, 0)`.
- `server/src/controllers/order.controller.js:105-109` biến `0` thành default `5`.

Tác động: dashboard HLV và dropdown chọn khách của Customer Story âm thầm thiếu mọi đơn sau 5 bản ghi.

Hướng sửa: không dùng sentinel `0`; thêm client service paginate qua API với limit hợp lệ và gom đủ các trang.

### CT-04 — HIGH — Meal Plan FE mặc định 3 lượt, BE chỉ cấp 1 lượt

- FE khởi tạo `maxGenerations=3` tại `client/src/hooks/useMealPlanAccess.js:9`.
- Khi API lỗi FE chuyển sang `trial` tại `client/src/hooks/useMealPlanAccess.js:26`, vẫn giữ quota 3.
- BE dùng `MAX_FREE_GENERATIONS=1` tại `server/src/routes/mealplanAccess.routes.js:11`.

Tác động: trạng thái loading/error/guest có thể cho phép UI tạo thực đơn vượt policy, sau đó record mới thất bại; trải nghiệm và entitlement không nhất quán.

Hướng sửa: fail closed cho đến khi server trả policy; không giữ quota số ở FE; chặn cả generator và custom builder khi access chưa xác minh.

### CT-05 — MEDIUM — UI đơn hàng gộp `completed`/`cancelled` thành “Chờ xác nhận”

- Backend enum đủ bốn trạng thái tại `server/src/models/Order.js:34`.
- Card chỉ phân biệt `approved` và nhánh còn lại tại `client/src/pages/admin/Orders.jsx:310-331`.
- Modal detail lặp cùng logic tại `client/src/pages/admin/Orders.jsx:528-533`.

Tác động: admin đọc sai trạng thái nghiệp vụ, đặc biệt đơn đã hoàn thành hoặc đã hủy.

Hướng sửa: status contract dùng chung phía client với label/style/icon cho đủ bốn trạng thái.

### CT-06 — MEDIUM — UI hợp đồng thiếu trạng thái transaction `signing`

- Backend state machine và enum có `signing` tại `server/src/models/Contract.js:76-79`.
- Backend thực sự ghi trạng thái này tại `server/src/services/contract.service.js:385`.
- `STATUS_MAP` và filter FE thiếu `signing` tại `client/src/pages/admin/ContractManagement.jsx:16-23` và `:109`.

Tác động: nếu trạng thái transaction xuất hiện trong list, UI fallback thành “Nháp”, gây hiểu sai và có thể hiển thị hành động không phù hợp.

Hướng sửa: thêm “Đang ký”, filter tương ứng và giữ action read-only trong trạng thái này.

### CT-07 — MEDIUM — F1 detail dùng status cũ và bỏ `program_started`

- Backend enum có `program_started` tại `server/src/models/F1Customer.js:66`.
- Detail UI vẫn dùng `testing_completed` không có trong model tại `client/src/components/F1/F1CustomerDetail.jsx:65`, `:184`, `:190`, `:200`, `:205`.
- Detail không đưa `program_started` vào label/progress, trong khi list đã có label.

Tác động: khách đã bắt đầu lộ trình có thể bị hiển thị các bước trước là chưa hoàn thành hoặc status thô.

Hướng sửa: một status contract dùng chung cho list/detail và bỏ status legacy khỏi business logic.

### CT-08 — MEDIUM — Policy nạp ví bị lặp ở ba lớp

- Model min tại `server/src/models/DepositRequest.js:15`.
- Controller min/max tại `server/src/controllers/deposit.controller.js:42-53`.
- FE lặp min/max tại `client/src/pages/wallet/MyWallet.jsx:122-126`, `:408-445`.

Các giá trị hiện đang cùng 5.000đ–100.000.000đ, nhưng đây là cùng loại rủi ro đã từng xảy ra với pricing.

Hướng sửa: pure backend policy cho controller/model; protected read endpoint; FE disable submit khi policy chưa tải thay vì dùng fallback số.

### CT-09 — HIGH — Lỗi API gói bị biến thành từ chối quyền truy cập

- Nhánh retry từng nằm bên trong `if (!user)`, nên không thể chạy cho user đã đăng nhập.
- Bằng chứng sau sửa: redirect chưa đăng nhập ở `client/src/routes/AdminRoute.jsx:32-34`; error/retry của subscription đứng độc lập tại `:36`.
- Regression guard: `client/scripts/__tests__/admin-route-guard.test.js:12`.

Tác động trước sửa: lỗi mạng tạm thời có thể đẩy user có quyền về trang chủ và tạo cảm giác mất gói.

Kết quả: tách trạng thái unauthenticated khỏi subscription API error; giữ loading, retry, disabled và focus-visible state.

### CT-10 — MEDIUM — Prerender Home có thể mất toàn bộ `Service.offers`

- Runtime Home fail-closed khi catalog API lỗi là đúng, nhưng build trước đó cũng bỏ offers khỏi HTML.
- Build-time request hiện lấy catalog canonical backend tại `client/scripts/prerender.js:37-56` và intercept ở `:116-122`.
- Validator so số lượng, giá và currency tại `client/scripts/prerender-validation.js:80-101`.
- Regression tests: `client/scripts/__tests__/seo-prerender.test.js:82` và `:111`.

Tác động trước sửa: crawler nhận `Service` nhưng không có `Offer`, dù Pricing runtime hiển thị đúng.

Kết quả: prerender dùng catalog backend chỉ trong build pipeline, không tạo fallback runtime; build fail nếu offer thiếu hoặc drift.

## Nhóm đã kiểm tra và hiện không có mismatch active

- Giá/quota/entitlement Free, Standard, Professional, Premium hiện khớp: 30 ngày/3 khách; 5/20/50 khách; F1 CRM & AI chỉ Professional/Premium.
- Site Settings upload count khớp FE/BE: hero 5, avatar 3, about 5, classes 5.
- Scheduling window hiện cùng 56 ngày; backend vẫn là authority. Giá trị FE này là presentation constraint, không dùng để cấp quyền hoặc ghi tiền.
- Deposit statuses, Booking statuses, WorkoutPlan statuses và F1 readiness hiện có đủ mapping ở các màn hình chính.
- Static route/method inventory không phát hiện service active nào khác gọi sai Express route ngoài nhóm `/user/trainers` nêu ở CT-02.
- Giá PT/hợp đồng do admin nhập và các card marketing PT không cùng luồng debit ví HLV, nên không ép chúng dùng trainer catalog.

## Guardrail sau sửa

- `check:commercial-contracts` phải fail khi giá/quota/deposit policy bị hardcode lại ngoài allowlist hoặc checkout mất handshake.
- Skill `impact-check` phải trace cả producer và consumer: import → service → route → controller → business service → model/validation → tests, cùng UI state/error/loading và SEO/CSP/migration khi liên quan.
- Mọi plan triển khai đặt tại `docs/plans/`; không tạo lại thư mục `plans/` ở root.

## Trạng thái thực thi

| Finding | Trạng thái | Guard chính |
|---|---|---|
| CT-01 | Đã sửa | Catalog handshake + `CATALOG_CHANGED` |
| CT-02 | Đã sửa | Admin-only assignment endpoint + integration test |
| CT-03 | Đã sửa | Bounded pagination collector |
| CT-04 | Đã sửa | Server quota + atomic record + fail-closed UI |
| CT-05 | Đã sửa | `orderStatus` contract |
| CT-06 | Đã sửa | `contractStatus` contract |
| CT-07 | Đã sửa | `f1CustomerStatus` contract |
| CT-08 | Đã sửa | Canonical deposit policy + protected endpoint |
| CT-09 | Đã sửa | AdminRoute structural regression test |
| CT-10 | Đã sửa | Prerender offer validator |

Không chạy migration, seed hoặc retention cleanup trên staging/production trong đợt này.

## Verification trước staging

- Client lint: PASS.
- Client unit/script tests: 15 files, 119 tests PASS.
- Server unit/integration tests: 47 files, 218 tests PASS.
- AI check: 11 tools hợp lệ, 0 orphan, 4/4 output sanitizer tests PASS.
- Production build: Vite PASS; prerender 83/83 routes; sitemap 780 URLs; bundle budget PASS.
- Home HTML: đúng 7 `Offer` — Free 0đ; tháng/năm 200.000/2.000.000, 250.000/2.500.000 và 300.000/3.000.000 VND.
- Contract, secret và repository-boundary gates: PASS; 0 boundary violation.
- Dependency audits: client PASS với waiver React Router RSC đã biết; server PASS không waiver.
- UI check: 33/40 (Good); không có HIGH mới trong surfaces đã sửa, retry/error controls có focus-visible và touch target tối thiểu.
- SEO check: PASS qua structured-data regression tests và full prerender.
- Skill drift: 11 AI tools đã đồng bộ; cảnh báo không block là `tdd-guide` vẫn ghi inventory 10 file cũ trong khi repo hiện có 76 test files.
- E2E local: SKIP theo pre-deploy policy vì không khởi động dev servers; thay bằng smoke test read-only sau khi staging deploy.
