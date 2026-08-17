# Spec: HT Fitness+

## Objective

Thêm nhóm khách hàng trả phí dành cho người đã biết tập luyện và muốn tự theo dõi hành trình bằng các công cụ số của HTCOACHING: HT Assistant, Meal Scan, Meal Plan, TDEE, thư viện bài tập và lưu tiến trình.

HT Fitness+ là product/entitlement riêng, không phải role mới, không phải Coaching Customer và không phải Trainer Subscription. Pricing hiển thị tên tiếng Việt mặc định; English locale hiển thị tên tiếng Anh tương ứng.

## Product vocabulary

| Context | Vietnamese | English | Canonical key |
|---|---|---|---|
| Product family | HT Fitness+ | HT Fitness+ | `fitness_plus` |
| Entry plan | Nền tảng | Essential | `fitness_plus_essential` |
| Recommended plan | Tăng tốc | Smart | `fitness_plus_smart` |
| Highest plan | Toàn diện | Max | `fitness_plus_max` |

Không dùng “VIP” cho HT Fitness+ vì plan không bao gồm HLV riêng. Không tạo `User` role mới; entitlement được resolver từ subscription đang active.

## Tech Stack liên quan

- Backend: Express 5, Mongoose 9, MongoDB, existing Wallet Ledger.
- Frontend: React 19, Vite, TanStack Query 5, react-i18next, existing Pricing and Admin Service Access pages.
- Security: existing JWT httpOnly cookies, CSRF middleware, server-authoritative catalog and wallet idempotency.

## Product contract

### Catalog and billing

- Catalog backend là nguồn sự thật duy nhất cho mã gói, tên, giá VND, chu kỳ `month`/`year`, quota và feature flags.
- Giá triển khai ban đầu:
  - Nền tảng: 99.000 VND/tháng hoặc 990.000 VND/năm.
  - Tăng tốc: 199.000 VND/tháng hoặc 1.990.000 VND/năm.
  - Toàn diện: 299.000 VND/tháng hoặc 2.990.000 VND/năm.
- Thanh toán dùng Wallet Ledger hiện có; backend tự tính số tiền từ catalog, không tin `expectedAmount` từ client.
- Mỗi user chỉ có một HT Fitness+ subscription active. Mua plan khác sẽ supersede plan cũ và tính phí đầy đủ; không prorate/refund trong phiên bản này.
- Subscription có `purchaseRequestId` duy nhất để chống retry/debit lặp.
- Không thực thi migration/seed/production write trong task này. Vì production tắt Mongoose `autoIndex`, release có script index guarded để preflight duplicate/name conflict và chỉ được apply sau khi khóa đúng target database cùng confirmation vận hành.
- Hai collection mới không cần backfill document cũ. Migration manifest có sáu index suy ra trực tiếp từ schema: hai query indexes, unique active subscription, unique purchase request, unique quota subject/service và TTL quota usage.

### Quota beta

| Plan | AI Chat | Meal Scan |
|---|---:|---:|
| Nền tảng | 20 tin / rolling hour / user | 15 lượt / rolling 30 days / user |
| Tăng tốc | 40 tin / rolling hour / user | 30 lượt / rolling 30 days / user |
| Toàn diện | 60 tin / rolling hour / user | 60 lượt / rolling 30 days / user |

Meal Plan dùng cùng entitlement nhưng quota hiện tại được mô tả riêng trong registry; TDEE và thư viện bài tập không giới hạn. Quota server trả `serviceKey`, `tier`, `limit`, `remaining`, `resetAt`.

AI Chat và Meal Scan của HT Fitness+ dùng shared Mongo rolling-window store theo `userId + serviceKey`, update atomic giữa nhiều instance. Store trim timestamp cũ và giữ tối đa `max(plan limits) + 1` phần tử để request đã bị chặn không làm state tăng vô hạn; TTL xóa document sau cửa sổ không hoạt động. Guest/User/Coaching/Trainer tiếp tục limiter legacy hiện tại.

Nếu user đồng thời có Trainer Subscription hoặc Order coaching đang hợp lệ, resolver giữ precedence hiện tại của Trainer/Coaching Customer để không làm giảm quyền đã có; HT Fitness+ vẫn được lưu và hiển thị trong tài khoản.

### Pricing UX

- Customer Pricing có mode riêng `fitness-plus` bên cạnh `1-1`, `online`, `trial`.
- Card HT Fitness+ hiển thị ba plan theo locale:
  - vi: Nền tảng / Tăng tốc / Toàn diện.
  - en: Essential / Smart / Max.
- Tăng tốc được đánh dấu “Phổ biến”/“Popular”.
- Card chỉ hiển thị quyền lợi thật và quota; không hứa hỗ trợ HLV hoặc quyền lợi chưa có backend.
- Checkout yêu cầu đăng nhập, kiểm tra số dư ví, hiển thị trạng thái thiếu tiền, retry và kết quả idempotent theo pattern checkout HLV.

### Admin monitoring

`GET /api/admin/service-access-policies` trả thêm ba tier HT Fitness+ trong `columns`. Trang Admin “Quyền & hạn mức → Hạn mức công cụ” tự render các cột mới từ registry; không hardcode quota ở client.

## Cấu trúc File bị ảnh hưởng

### Backend

- `server/src/constants/fitnessPlusPlans.js` — catalog plan/price/entitlement.
- `server/src/models/FitnessSubscription.js` — subscription collection và indexes.
- `server/src/models/FitnessPlusQuotaUsage.js` — bounded shared quota state và TTL.
- `server/src/migrations/20260817-fitness-plus-subscription-indexes.js` — guarded preflight/apply cho production indexes; không tự chạy khi deploy.
- `server/src/services/fitnessPlusCatalog.service.js` — fingerprint, resolver, amount/date helpers.
- `server/src/services/fitnessPlusSubscription.service.js` — atomic wallet purchase.
- `server/src/controllers/fitnessPlusSubscription.controller.js` — catalog, purchase, current subscription.
- `server/src/routes/fitnessPlusSubscription.routes.js` — public catalog + protected checkout/read.
- `server/server.js` — mount route.
- `server/src/constants/serviceAccessPolicies.js` — tiers, policy registry, version.
- `server/src/services/serviceAccessPolicy.service.js` — resolver and Admin matrix columns.
- `server/src/middlewares/fitnessPlusQuotaStore.js`, `aiRateLimit.js`, `ai.routes.js` và `mealScan.routes.js` — durable hourly/30-day enforcement cho HT Fitness+.
- `server/src/middlewares/validation.js` — checkout validator.
- `server/src/models/WalletTransaction.js` — `fitness_subscription` reference type.
- `server/src/routes/user.routes.js` — account order read model includes Fitness+ subscriptions.
- `server/src/services/subscriptionCron.js` — expiry of Fitness+ subscriptions.

### Frontend

- `client/src/services/fitnessPlus.service.js` — catalog, purchase, current subscription API calls.
- `client/src/queries/fitnessPlus.queries.js` — TanStack Query options and purchase cache invalidation.
- `client/src/components/Pricing/FitnessPlusPlans.jsx` — cards and checkout drawer.
- `client/src/sections/Pricing.jsx` — customer mode and Fitness+ rendering branch.
- `client/src/i18n/locales/vi/home.json` — Vietnamese labels/copy.
- `client/src/i18n/locales/en/home.json` — English labels/copy.
- `client/src/queries/walletAccount.queries.js` — invalidate Fitness+ subscription after purchase.

### Domain/docs/tests

- `CONTEXT.md` — canonical HT Fitness+ vocabulary.
- `docs/specs/service-access-policy.md` — approved tier/quota matrix update.
- `server/src/**/__tests__/*fitnessPlus*` and focused policy/route tests.
- `client/src/**/__tests__/*fitnessPlus*` and Pricing contract tests.

## Code Style

- Route → controller → service → model; component không gọi API trực tiếp.
- Catalog fingerprint và expected amount handshake giống Trainer Plan catalog, nhưng dùng namespace `fitness_plus`.
- Mutating endpoint dùng `protect` + `csrfProtection` + validation.
- Không sửa `client/src/utils/api.js`, auth middleware hoặc rate-limit security để né contract.
- Không nhận tier từ request body; resolver truy vấn subscription backend.

## Testing Strategy

- Unit catalog: plan codes, locale labels, fingerprint, amount/date, invalid cycle.
- Model/migration: sáu-index manifest, duplicate preflight, idempotent apply, explicit target lock và confirmation guard.
- Quota store: rolling trim, cross-instance persistence, bounded blocked requests, reset và TTL contract.
- Purchase integration: happy path, insufficient wallet, catalog mismatch, invalid plan/cycle, retry idempotency, active supersede.
- Access policy: resolver precedence, three Fitness+ tiers, registry limits, Admin columns.
- Rate limit: Meal Scan 30-day window for Fitness+ and existing 24-hour behavior for Guest/User/Coaching/Trainer.
- Frontend: catalog loading/error/empty, locale labels, wallet states, purchase success/failure, cache invalidation and responsive card layout.
- Verification gates: focused server/client tests, lint, client build, AI check, UI check, security/data boundary scans and `git diff --check`.

## Boundaries

- Always: server-authoritative catalog/price/quota, CSRF, idempotency, ownership, safe logging, no raw secret/PII.
- Ask first: production migration, production seed, external payment provider, refund/proration policy, new public SEO route.
- Never: reuse `TrainerSubscription` for Fitness+, create a new auth role, trust client tier/amount, disable CSRF/rate limit, expose wallet internals.
- Deferred: GitLab backup/repository workflow (issue 3), monthly AI fair-use cap beyond hourly policy, admin mutation of Fitness+ catalog.

## Success Criteria

- User sees HT Fitness+ in Pricing with Vietnamese/English plan names and can open an authenticated Wallet checkout.
- Successful purchase creates only a `FitnessSubscription`, one wallet purchase ledger entry and a server-authoritative active entitlement.
- Active Fitness+ plan changes Meal Scan and AI Chat limits without changing existing Guest/User/Coaching/Trainer behavior.
- Admin “Hạn mức công cụ” renders three Fitness+ columns from backend registry.
- Account orders include Fitness+ subscription history.
- Existing Trainer Subscription and Coaching Customer flows remain contract-compatible.
- Migration script đã sẵn sàng nhưng không có migration hoặc production mutation nào được thực thi trong implementation pass.

## Open Questions

None for this implementation pass; issue 3 is intentionally deferred until issue 4 is complete.
