# Plan 002: Loại bỏ drift giá và hợp đồng thương mại giữa FE/BE

> **Hướng dẫn thực thi**: Làm tuần tự, viết test RED trước mỗi thay đổi tài chính và
> chỉ chuyển bước khi verification tương ứng pass. Nếu gặp STOP condition thì dừng,
> không tự nới validation hoặc bỏ qua ledger/idempotency.
>
> **Drift check đầu tiên**: chạy lại inventory ở Step 1. Nếu giá, route hoặc payload
> hiện tại không còn khớp phần Current State dưới đây thì STOP và cập nhật plan trước.

## Status

- **Priority**: P1
- **Effort**: L (1–2 ngày, chưa gồm thời gian quan sát staging)
- **Risk**: HIGH
- **Depends on**: Plan 001
- **Category**: security | payment | correctness | tests | tech-debt
- **Planned at**: 2026-07-28
- **Status**: DEPLOYED / VERIFIED ON STAGING
- **Staging verified at**: 2026-07-28
- **Implemented and verified locally at**: 2026-07-28

## Why This Matters

Lỗi lịch sử từng khiến Pricing hiển thị 200.000/250.000/300.000đ nhưng backend
chỉ trừ 5.000/7.000/10.000đ. Hiện các giá đã khớp, nhưng cùng một bảng giá vẫn
được lặp ở backend catalog, controller legacy, fallback FE và JSON-LD. Backend
đang tự tính số tiền phải trừ nên client không thể tự giảm giá, nhưng checkout
không gửi số tiền đã hiển thị hoặc fingerprint catalog; vì vậy một FE cũ hoặc bị
drift vẫn có thể khiến người dùng xác nhận giá A nhưng ledger trừ giá B.

Mục tiêu của plan không chỉ là “các số đang bằng nhau”, mà là tạo invariant:
> **Không có wallet debit nếu catalog mà user nhìn thấy khác catalog backend đang
> thực thi. Mọi thay đổi giá/quota/quyền lợi phải làm CI fail nếu tạo thêm nguồn
> sự thật thứ hai.**

## Current State

### Kết quả audit hiện tại

| Contract | FE hiện tại | BE hiện tại | Trạng thái | Rủi ro còn lại |
|---|---|---|---|---|
| Giá HLV tháng | 200k / 250k / 300k | 200k / 250k / 300k | Đang khớp | Hardcode fallback + controller legacy + SEO |
| Giá HLV năm | 2m / 2.5m / 3m | 2m / 2.5m / 3m | Đang khớp | Cùng một giá ở nhiều file |
| Free | 0đ / 30 ngày / 3 khách | 0đ / 30 ngày / 3 khách | Đang khớp | Label/quota FE hardcode |
| Client limit | 3 / 5 / 20 / 50 | 3 / 5 / 20 / 50 | Đang khớp | Order controller không đọc catalog chính |
| F1 CRM & AI | Chỉ Professional/Premium | Middleware đọc catalog | Đang khớp | UI feature copy không có contract test |
| Nạp ví | min 5k, max 100m | min 5k, max 100m | Đang khớp | Hardcode ở FE + controller + model |
| Hợp đồng PT | Admin nhập số tiền | BE lưu/validate số dương | Không phải catalog | Không được ép bằng giá HLV |
| PT marketing cards | Chỉ phục vụ chọn gói/register | Không debit wallet | Presentation-only | Ghi rõ để audit không báo nhầm |

### Evidence chịu tải

- `server/src/services/trainerPlanCatalog.service.js:1-38` chứa catalog HLV chính xác.
- `server/src/services/trainerPlanCatalog.service.js:67-70` là hàm BE lấy amount.
- `server/src/services/trainerSubscriptionPurchase.service.js:52-69` resolve plan/cycle
  từ catalog; `:104-120` trừ `subscription.amount` qua wallet ledger.
- `client/src/sections/Pricing.jsx:62-70` fetch catalog nhưng lỗi thì dùng object rỗng.
- `client/src/sections/Pricing.jsx:344-410` fallback về các giá hardcode.
- `client/src/sections/Pricing.jsx:989-1007` tính số tiền hiển thị nhưng request chỉ gửi
  `planCode`, `billingCycle`, `requestId`.
- `client/src/services/trainerSubscription.service.js:6-11` chưa gửi
  `expectedAmount`/catalog fingerprint.
- `server/src/controllers/trainerSubscription.controller.js:16-29` giữ một catalog
  thứ hai; file còn purchase handler legacy từ `:68`, dù route hiện import handler mới
  tại `server/src/routes/trainerSubscription.routes.js:13-20`.
- `server/src/controllers/order.controller.js:36-44` lấy max client qua controller
  legacy thay vì catalog service.
- `client/src/pages/admin/components/TrainerGrantPanel.jsx:11-35` hardcode plan,
  client limits và billing cycles.
- `client/src/pages/Home.jsx:57-110` hardcode JSON-LD offers.
- `client/src/pages/wallet/MyWallet.jsx:119-170` hardcode deposit min/max.
- `server/src/controllers/deposit.controller.js:35-53` và
  `server/src/models/DepositRequest.js:11-16` lặp deposit policy.
- `server/src/middlewares/validation.js:935-960` và
  `server/src/models/TrainerSubscription.js:16-26` lặp code/cycle enum.

### Security invariants phải giữ

- Backend luôn tự tính canonical amount; tuyệt đối không dùng `expectedAmount` làm
  số tiền trừ ví.
- Purchase vẫn ở trong MongoDB transaction và giữ idempotency key hiện tại.
- Mọi POST vẫn qua `protect` + `csrfProtection` + server validation.
- Mismatch phải fail trước wallet mutation; không “tự sửa giá rồi tiếp tục charge”.
- Không thay đổi httpOnly JWT, CSRF interceptor hoặc wallet ledger semantics.

## Target Contract

Catalog response giữ backward compatibility:

```json
{
  "success": true,
  "data": [{ "code": "standard", "prices": { "month": 200000 } }],
  "meta": {
    "currency": "VND",
    "catalogFingerprint": "sha256-of-canonical-public-fields",
    "protocolVersion": 1
  }
}
```

Purchase request mới:
```json
{
  "planCode": "standard",
  "billingCycle": "month",
  "requestId": "uuid",
  "expectedAmount": 200000,
  "catalogFingerprint": "fingerprint-returned-by-catalog",
  "protocolVersion": 1
}
```

Backend so sánh fingerprint + expected amount với catalog hiện tại, sau đó vẫn
trừ canonical amount do server tính. Mismatch trả `409 CATALOG_CHANGED`, không tạo
subscription, ledger hay audit purchase. FE refetch catalog và bắt user xác nhận lại.
## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Inventory | `rg -n "200000|250000|300000|maxClients|amount <|amount >" client/src server/src` | Chỉ còn locations được allowlist |
| Server target | `npm run test:unit:server -- trainerSubscription.lifecycle.integration.test.js` | exit 0 |
| Client tests | `npm run test:unit:client` | exit 0 |
| Server tests | `npm run test:unit:server` | exit 0 |
| Contract gate | `npm run check:commercial-contracts` | exit 0, 0 drift |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `$env:SKIP_DYNAMIC_ROUTES='true'; npm run build --prefix client` | build + prerender + budget pass |
| Secrets | `npm run security:secrets` | exit 0 |
| Boundaries | `npm run security:data-boundaries` | exit 0 |

## Scope

### In scope

- Catalog/purchase: `server/src/services/trainerPlanCatalog.service.js`,
  `trainerSubscriptionPurchase.service.js`, lifecycle controller, validation và tests.
- Loại duplicate backend: `trainerSubscription.controller.js`, `order.controller.js`.
- FE catalog contract: `trainerSubscription.service.js`, `Pricing.jsx`,
  `TrainerGrantPanel.jsx`, `Home.jsx` và helper/hook mới dưới 300 dòng.
- Deposit policy: controller/model/policy endpoint, wallet service/UI và tests.
- Guardrail: root `package.json`, script boundary mới và `.github/workflows/ci.yml`.
- Staging verification chỉ read-only hoặc test account được xác nhận riêng.

### Out of scope

- Đổi giá/gói đã được product xác nhận trong Plan 001.
- Refactor toàn bộ `Pricing.jsx` hoặc `trainerSubscription.controller.js` ngoài phần
  dead purchase/catalog duplicate thuộc task.
- Đồng nhất giá PT marketing với hợp đồng: hai miền này chưa cùng một checkout.
- Proration, refund, payment gateway mới hoặc thay đổi wallet ledger.
- Chạy migration/seed hoặc ghi dữ liệu staging/production khi chưa xác nhận target.

## Steps

### Step 1: Chốt inventory mọi commercial contract chéo FE/BE

- Quét money, currency, duration, quota, client limits, entitlements và billing cycle.
- Phân loại từng literal thành `server-authoritative`, `presentation-only`,
  `validation mirror`, hoặc `unrelated numeric` (timeout, pagination, port).
- Ghi allowlist có lý do cho PT marketing, contract admin-entered và quick deposit
  amounts; không biến mọi số giống nhau thành một finding.
- Nếu phát hiện mismatch đang active ngoài bảng Current State: STOP, thêm finding và
  test tái hiện trước khi sang Step 2.

**Verify**: inventory có `file:line`, không còn monetary literal chưa phân loại.

### Step 2: Tạo catalog fingerprint và pure server constants

- Tách plan definitions/codes/cycles sang module thuần không import Mongoose.
- Catalog service clone dữ liệu và tạo SHA-256 deterministic từ code, prices,
  billing cycles, duration, maxClients, entitlements và currency.
- `GET /catalog` giữ `data` array hiện tại, thêm `meta` để không phá client cũ.
- Validation dùng exported codes/cycles; model chỉ import pure constants, không import
  service để tránh circular dependency.

**Verify**: unit tests chứng minh thay một price/limit/entitlement làm fingerprint đổi;
thứ tự object ổn định không làm fingerprint đổi.

### Step 3: Thêm price-confirmation handshake trước wallet debit

- Bổ sung validation bắt buộc cho `expectedAmount`, fingerprint, protocol version.
- Trong purchase service, compare trước `startSession()` hoặc ít nhất trước mọi write.
- Mismatch trả `409 CATALOG_CHANGED`; canonical amount không được lấy từ client.
- Giữ idempotency: retry request đã commit trả kết quả cũ; mismatch chưa commit không
  tạo ledger/subscription và có thể yêu cầu user xác nhận lại bằng requestId mới.
- Ghi metric drift nhưng không log raw email/token/PII.

**Verify**: integration tests cover expected amount thấp/cao, stale fingerprint,
tampered Free, valid purchase, concurrent retry và wallet/subscription count bằng 0
sau mismatch.

### Step 4: Biến FE thành consumer bắt buộc, bỏ numeric fallback

- Tạo `useTrainerPlanCatalog` dùng TanStack Query với một query key dùng chung.
- Pricing không render giá/checkout khi catalog chưa sẵn sàng; có loading/error/retry.
- Không fallback về 200k/250k/300k. Checkout dùng đúng amount đang render và gửi
  amount + fingerprint; `CATALOG_CHANGED` refetch rồi yêu cầu xác nhận lại.
- Không trừ tiền hoặc giả lập success ở client.

**Verify**: pure adapter tests cover loading/error/month/year/Free/stale response;
client source không còn trainer price literal.

### Step 5: Xóa đường purchase/catalog legacy ở backend

- `getMaxClientsByPlan` chuyển sang catalog service và nhận `planCode || planTitle`.
- `order.controller.js` import service, không import controller.
- Xóa `TRAINER_PLANS` thứ hai và purchase handler legacy không còn route sử dụng;
  giữ nguyên list/cancel behavior cùng audit/retention logic.
- Dọn đúng imports do phần xóa tạo ra; không refactor controller ngoài phạm vi.

**Verify**: route import test + integration tests chứng minh only lifecycle purchase
handler được dùng; client limit của cả bốn plan lấy từ catalog.

### Step 6: Đồng bộ Admin UI, entitlements và SEO từ cùng catalog

- TrainerGrantPanel tạo plan/cycle/limit labels từ hook catalog.
- Pricing feature visibility dựa trên entitlements/maxClients từ response; i18n chỉ
  giữ copy, không giữ số làm business logic.
- Home xây `Service/Offer` JSON-LD từ catalog đã fetch; nếu catalog lỗi thì omit offers,
  tuyệt đối không publish giá cũ. Prerender strict phải bắt được offers.
- F1 backend middleware tiếp tục là enforcement cuối cùng.

**Verify**: JSON-LD test so offers với API fixture; Admin options và Pricing cards có
cùng plan codes/cycles; F1 tests vẫn chặn Free/Standard.

### Step 7: Centralize deposit policy và loại drift ví nạp tiền

- Tạo pure `depositPolicy` cho min/max/integer VND, controller và model dùng chung.
- Thêm protected read-only policy endpoint; MyWallet lấy min/max từ server.
- Quick amounts vẫn presentation-only nhưng phải nằm trong min/max response.
- API lỗi thì disable submit với retry, không dùng min/max hardcode cũ.

**Verify**: boundary tests cho min-1/min/max/max+1/non-integer; FE không còn hardcode
deposit min/max; existing deposit integration suite pass.

### Step 8: Thêm anti-drift gate vào CI

- Tạo `scripts/check-commercial-contract-boundaries.mjs` bằng Node built-ins.
- Gate fail nếu trainer price/maxClients/deposit limits xuất hiện ngoài allowlist,
  `TRAINER_PLANS` legacy quay lại, hoặc purchase payload mất handshake fields.
- Thêm `npm run check:commercial-contracts` và chạy trong `.github/workflows/ci.yml`.
- Script chỉ scan source, không gọi network/DB và không in secret.

**Verify**: test script với fixture drift cố ý phải fail; repo thật pass.

### Step 9: Full gates và staging rollout an toàn

- Chạy targeted tests, full client/server, lint, build, commercial-contract gate,
  secrets, boundaries và dependency audit.
- Không deploy production trực tiếp. Staging backend enforcement có thể làm FE cũ
  tạm không checkout được; chấp nhận fail-closed thay vì charge sai.
- Sau cả FE/BE staging online, verify catalog fingerprint, bốn plan, tháng/năm,
  Free và error `CATALOG_CHANGED`. Wallet mutation test chỉ dùng tài khoản staging
  chuyên dụng sau khi user xác nhận.

**Verify**: mọi automated gate pass; staging read-only contract check khớp; mutation
scenario có evidence riêng hoặc được ghi rõ chưa chạy vì thiếu authorization.

## Test Plan

- Server unit: deterministic fingerprint, amount lookup, plan code/title fallback.
- Server integration: catalog response contract; mismatch không write; valid debit
  đúng canonical amount; idempotent retry không debit lần hai.
- F1/order integration: entitlements và maxClients đọc catalog.
- Deposit integration: integer/min/max boundaries từ policy chung.
- Client pure tests: map catalog → cards/admin options/JSON-LD, không cần thêm test-only
  export vào production component.
- E2E mock: stale fingerprint trả 409, UI refetch và không hiển thị success.
- CI boundary test: inject fixture hardcode → expected non-zero exit.

## Done Criteria

- [x] FE không còn hardcode trainer prices, annual prices, client limits hoặc deposit limits.
- [x] Backend không còn `TRAINER_PLANS` duplicate/purchase handler legacy.
- [x] Catalog response có deterministic fingerprint + currency + protocol version.
- [x] Mọi self-purchase gửi expected amount/fingerprint và backend fail-closed khi lệch.
- [x] Mismatch tạo 0 subscription, 0 wallet ledger và không đổi balance.
- [x] Pricing, Admin, JSON-LD, maxClients và F1 entitlements cùng đọc một catalog.
- [x] Deposit FE/controller/model cùng một policy.
- [x] `npm run check:commercial-contracts` chạy trong CI và pass.
- [x] Full pre-deploy gates pass; không chạy migration hoặc staging write trái phép.

## STOP Conditions

- Catalog/API hiện tại khác evidence hoặc có payment path thứ hai chưa inventory.
- Cần lấy số tiền trừ ví từ client để làm test pass.
- Cần disable CSRF, auth, validation, transaction hoặc idempotency.
- Không thể chứng minh mismatch không write bằng integration test.
- JSON-LD chỉ có thể giữ đúng bằng cách thêm một bản hardcode giá mới.
- Staging test cần ghi dữ liệu nhưng chưa có xác nhận tài khoản/target.
- Cùng một verification fail ba vòng sau khi sửa có căn cứ.

## Maintenance Notes

- Đổi giá/quota/quyền lợi trong tương lai chỉ sửa pure server catalog/policy; fingerprint
  tự đổi và buộc FE cũ refetch.
- Reviewer phải kiểm tra mọi PR có literal tiền/quota mới bằng commercial-contract gate.
- “Presentation-only” phải có comment/allowlist; nếu sau này PT marketing bắt đầu debit
  wallet thì phải đưa nó vào handshake trước khi release.
- Availability có thể tạm giảm trong rollout lệch phiên bản; financial correctness luôn
  fail-closed và được ưu tiên hơn việc tự charge với giá mới.
