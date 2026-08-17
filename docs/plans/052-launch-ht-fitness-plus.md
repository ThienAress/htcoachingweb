# Plan 052: Launch HT Fitness+ self-service entitlements

> **Hướng dẫn thực thi**: Thực hiện theo thứ tự các bước. Mỗi bước phải qua verification gate trước khi chuyển bước tiếp theo. Được tạo và test migration index guarded, nhưng không chạy migration/seed/production write.

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH
- **Depends on**: 033, 051
- **Category**: feature
- **Planned at**: 2026-08-17
- **Status**: IMPLEMENTED / LOCAL VERIFIED — STAGING INDEX PREFLIGHT PASS / DEPLOY PENDING

## Why This Matters

HTCOACHING hiện có user thường, Coaching Customer và Trainer nhưng chưa có entitlement trả phí cho người chỉ muốn dùng công cụ số. HT Fitness+ bổ sung sản phẩm tự theo dõi với catalog, wallet checkout và quota riêng mà không làm lẫn `Order` coaching với `TrainerSubscription`. Admin cần thấy quota mới trong cùng bảng “Quyền & hạn mức” để đối soát một nguồn.

## Current State

- `server/src/constants/serviceAccessPolicies.js` giữ bốn tier `guest`, `user`, `coaching_customer`, `trainer`; AI Chat và Meal Scan đọc limit từ registry nhưng Meal Scan đang dùng rolling 24 giờ.
- `server/src/services/serviceAccessPolicy.service.js` resolver `trainer → coaching_customer → user` dựa trên role, TrainerSubscription và Order; Admin matrix hiện có ba cột gộp.
- `server/src/models/TrainerSubscription.js` và `server/src/services/trainerSubscriptionPurchase.service.js` dành riêng cho gói HLV; không được tái sử dụng cho HT Fitness+.
- Production tắt Mongoose `autoIndex`; unique active/idempotency và query indexes của collection mới phải có migration script guarded trước deploy.
- `client/src/sections/Pricing.jsx` có mode customer `1-1`/`online`/`trial` và trainer catalog/checkout riêng.
- `client/src/pages/admin/ServiceAccessPoliciesPage.jsx` render bảng “Hạn mức công cụ” động từ `columns`/`services` API.
- `server/src/services/walletLedger.service.js` là nguồn debit atomic, idempotent; `WalletTransaction.referenceType` cần thêm namespace Fitness+.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused server | `npm run test:unit:server -- --runInBand` | Relevant Vitest suites pass |
| Focused client | `npm run test:unit:client -- --runInBand` | Relevant Vitest suites pass |
| Client lint | `npm run lint --prefix client` | Exit 0 |
| Client build | `npm run build --prefix client` | Exit 0 |
| Agent validation | `npm run agents:validate` | Exit 0 |
| Contract diff | `git diff --check` | No whitespace errors |

## Scope

**In scope**

- HT Fitness+ catalog with Vietnamese/English display labels, VND monthly/yearly price and quota metadata.
- New `FitnessSubscription` model/collection, atomic Wallet checkout, idempotency, current subscription API and account read model.
- Backend resolver tiers and Meal Scan 30-day enforcement; hourly AI Chat limits.
- Pricing mode/cards/checkout and i18n.
- Admin service-access matrix columns and canonical service policy spec.
- Domain glossary and focused tests.

**Out of scope**

- GitLab/GitHub backup workflow (issue 3).
- External payment provider, auto-renewal, prorating, refunds and production migration/seed.
- New role, trainer benefits, public SEO route or AI prompt/tool changes.

## Steps

### Step 1: Codify domain/catalog and policy contract

**Behavior**: Backend exposes a fingerprinted HT Fitness+ catalog and Admin matrix displays three new tiers; resolver recognizes active subscriptions while preserving existing precedence.

**Blast radius**: `CONTEXT.md`, `fitnessPlusPlans.js`, service-access registry/service, service-access spec, catalog/policy tests.

**Depends on**: none.

**Verify**: focused catalog/policy tests; inspect `git diff --check`.

### Step 2: Add subscription collection and wallet purchase

**Behavior**: Authenticated user can purchase a catalog plan with Wallet, retry safely with same request ID, and read current subscription; old TrainerSubscription documents/flows remain unchanged.

**Blast radius**: model, guarded index migration, catalog/purchase services, controller/route, validation, wallet transaction enum, server route mount, account orders, expiry cron, integration tests.

**Depends on**: Step 1.

**Verify**: purchase integration covers amount/catalog/CSRF/idempotency/insufficient balance/supersede; migration test covers manifest/duplicate/idempotent apply/target guards; run focused server suites.

### Step 3: Enforce plan-specific service access

**Behavior**: Fitness+ plans receive correct AI Chat hourly and Meal Scan rolling-30-day quotas; existing tiers keep their current windows and metadata.

**Blast radius**: shared quota model/store, guarded index migration, rate-limit middleware/routes, account deletion, policy tests, resolver tests, Meal Scan/AI contract tests.

**Depends on**: Step 2.

**Verify**: boundary tests for each plan and existing four tiers; cross-instance rolling/bounded store tests; server unit/integration tests.

### Step 4: Add Pricing and account UX

**Behavior**: Customer can select HT Fitness+, view locale-specific plan names, inspect quota/features, open wallet checkout, see loading/error/insufficient-balance/success states, and refresh subscription/account caches.

**Blast radius**: new FitnessPlus component/service/query, Pricing mode branch, wallet invalidation, vi/en home translations, client tests.

**Depends on**: Step 2.

**Verify**: focused client tests, lint, responsive/manual UI check, client build.

### Step 5: Integrate Admin dashboard and final gates

**Behavior**: Admin “Quyền & hạn mức → Hạn mức công cụ” shows three HT Fitness+ columns from registry and account reads include subscription history.

**Blast radius**: Admin presentation tests if needed, service policy tests, docs and release evidence.

**Depends on**: Steps 1–4.

**Verify**: full relevant client/server tests, lint, build, AI/UI checks, security/data-boundary scans, agent validation, `git diff --check`.

## Test Plan

- `fitnessPlusCatalog.test.js`: catalog codes, prices, fingerprints, date/amount helpers, locale mapping.
- `fitnessPlusSubscription.lifecycle.integration.test.js`: purchase happy path, wallet shortage, catalog mismatch, duplicate request, supersede and current read.
- `serviceAccessPolicy.test.js`: three Fitness+ limits and precedence.
- `fitnessPlusRateLimit.policy.test.js`: 20/40/60 AI hourly and 15/30/60 Meal Scan 30-day boundaries; preserve Guest/User/Coaching/Trainer.
- `fitnessPlusPricing.test.jsx`: locale labels, catalog loading/error, wallet disabled state, purchase cache invalidation.
- Update account read-model contract for `fitnessSubscriptions`.

## Done Criteria

- [x] `docs/specs/ht-fitness-plus.md` and glossary are canonical and match runtime.
- [x] No new role; `TrainerSubscription` behavior unchanged.
- [x] Purchase is atomic, server-priced, CSRF-protected and idempotent.
- [x] Quota metadata and Admin matrix expose all three plans.
- [x] Fitness+ AI Chat/Meal Scan quota state is shared, atomic, TTL-cleaned and bounded across instances.
- [x] Vietnamese/English Pricing labels render correctly.
- [x] Focused tests, lint, build, security/data-boundary scans and agent validation pass.
- [x] Guarded index migration exists, passes local contract tests and reports all six indexes present on locked staging target; no migration apply/seed/production write executed.
- [x] `docs/plans/README.md` row 052 updated to final status.

## Local Verification Evidence

- 2026-08-17, HEAD `2276611fac870ec970c3c1dd43e9b7be37634dbc`, dirty working tree fingerprint retained in Git status/diff.
- Client unit: `94` files / `460` tests passed.
- Focused server lifecycle, quota, migration and account contracts: `7` files / `28` tests passed.
- Client ESLint and Vite compile-only build passed.
- AI tool validation `11/11`; UI regression `0` new high-confidence findings.
- Secret scan, repository data boundaries, commercial contracts, agent validation and `git diff --check` passed.
- Staging read-only index preflight passed against locked database `htcoaching_staging`: all six indexes present, zero duplicate groups, no apply required. E2E and deployed staging verification remain pending.

## STOP Conditions

- Existing code requires changing auth middleware, `client/src/utils/api.js` or production data to make the feature work.
- Wallet transaction reference contract cannot be extended without breaking legacy documents/tests.
- A verification gate fails three times after evidence-based fixes.
- A requirement expands into external payment/auto-renewal/refund or migration work.

## Maintenance Notes

- Future quota changes belong in `server/src/constants/serviceAccessPolicies.js` and the product spec, never in Pricing JSX or limiter literals.
- Future billing/renewal should extend `FitnessSubscription` lifecycle with a separate financial spec; do not copy TrainerSubscription blindly.
- Before issue 3, review whether the repository backup policy needs GitLab mirror, protected branches, secret scanning and restore drills.
