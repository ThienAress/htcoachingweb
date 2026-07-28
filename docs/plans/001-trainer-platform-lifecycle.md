# Plan 001: Hoàn thiện vòng đời gói HLV và bảo vệ AI output

> Thực thi tuần tự. Mỗi bước phải qua verify trước khi sang bước kế tiếp. Migration và retention enforcement chỉ được tạo/kiểm thử; không chạy trên staging/production nếu chưa có xác nhận target riêng.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none
- **Category**: feature | security | payment | migration | tests
- **Planned at**: 2026-07-28
- **Implemented and verified at**: 2026-07-28

## Why This Matters

Trainer pricing hiện hiển thị 200.000/250.000/300.000đ mỗi tháng ở frontend nhưng backend chỉ trừ 5.000/7.000/10.000đ. Hệ thống chưa có Free 30 ngày, chưa cấp gói cho email chưa có tài khoản, chưa gửi mail đăng ký HLV và chưa mô hình hóa retention sau khi gói hết hạn. Đồng thời HT Assistant vẫn có thể kể tên tool nội bộ dù system prompt đã cấm.

## Confirmed Product Rules

- Free: 0đ, 30 ngày, tối đa 3 khách active, một lần duy nhất cho mỗi email đã xác thực.
- Tiêu chuẩn: 200.000đ/tháng hoặc 2.000.000đ/năm, tối đa 5 khách.
- Chuyên nghiệp: 250.000đ/tháng hoặc 2.500.000đ/năm, tối đa 20 khách, có F1 CRM & AI.
- Cao cấp: 300.000đ/tháng hoặc 3.000.000đ/năm, tối đa 50 khách, có F1 CRM & AI.
- Free đã dùng vẫn hiện trên Pricing với trạng thái đã dùng và CTA nâng cấp.
- Hết subscription: khóa quyền Trainer, không xóa ngay dữ liệu.
- Structured coaching data retention: 12 tháng; F1/coaching media retention: 90 ngày.
- Pending admin grant được giữ theo normalized email và tự claim sau Google login bằng đúng verified email.
- Mua Pricing, admin grant, pending claim và Free activation đều gửi email phù hợp; email lỗi không rollback giao dịch đã commit.

## Current State

- `client/src/sections/Pricing.jsx` — trainer cards hardcode giá và bắt đăng nhập trước purchase.
- `server/src/controllers/trainerSubscription.controller.js` — wallet transaction/idempotency tốt nhưng catalog giá sai và không có Free/admin grant.
- `server/src/models/TrainerSubscription.js` — bắt buộc `userId`, chỉ hỗ trợ month/year và active/expired/cancelled.
- `server/src/services/subscriptionCron.js` — chỉ expire subscription, chưa đặt retention deadlines.
- `server/src/config/passport.js` — Google login xác minh email và find/create `User`; chưa claim pending grant.
- `client/src/pages/admin/TrainerSubscriberManagement.jsx` — chỉ list/cancel subscription active.
- `server/src/services/ai/assistantOutput.js` — lọc pseudo action và một số câu “gọi tool”, chưa chặn chắc tên tool nằm trong đoạn giải thích dài.
- `server/src/controllers/coaching.controller.js:240` — timeline query theo `userId` sau ownership check; phải thêm `trainerId` để tránh lộ lịch sử giữa HLV.
- `server/src/controllers/order.controller.js:47` — giới hạn khách đếm mọi email lịch sử; phải chỉ đếm khách active.

## Schema Impact

### `TrainerSubscription`

- Add backward-compatible fields: `planCode`, `source`, `normalizedEmail`, `supersededAt`, `supersededBy`, `previousSubscriptionId`, `structuredRetentionExpiresAt`, `mediaRetentionExpiresAt`.
- Extend `billingCycle` with `trial`; extend `status` with `superseded`.
- Existing documents remain readable through `planTitle` fallback; migration backfills `planCode/source/normalizedEmail` and deadlines.

### New models

- `TrainerTrialClaim`: unique `normalizedEmail`, records the permanent one-time Free claim.
- `PendingTrainerGrant`: unique pending grant per normalized email, stores plan/cycle/admin/status and claimed user/subscription.

### Existing data

- No destructive migration.
- New fields have safe defaults or are optional during rollout.
- Idempotent migration is required to backfill old subscriptions and create indexes.
- Migration is not executed automatically.

## Scope

### Backend

- AI: `systemPrompt.js`, `assistantOutput.js` and tests.
- Catalog/lifecycle: new trainer plan catalog service, subscription model/controller/routes/service tests.
- Grants: pending/trial models, grant service, passport claim hook, admin endpoints and email templates.
- Retention/security: subscription cron deadlines, retention dry-run service, active-client counting, coaching tenant isolation.
- Migration: new phase-10 idempotent migration and package script only.
- Audit: extend allowed actions/targets without weakening existing validation.

### Frontend

- `trainerSubscription.service.js`: catalog, Free activation, admin grant/pending APIs.
- `Pricing.jsx`: consume backend prices; render Free first with eligible/active/used states and upgrade modal.
- `TrainerSubscriberManagement.jsx`: open grant modal and show pending grants.
- New focused admin modal/schema component, under 300 lines.
- i18n `home.json` vi/en: Free copy and state labels.

### Out of scope

- Refactor toàn bộ `Pricing.jsx` hoặc auth context.
- Đổi JWT/httpOnly/CSRF mechanisms.
- Tự chạy migration, seed, cleanup or retention enforcement on real data.
- Proration/refund for an existing paid subscription; admin/self upgrade supersedes access but does not silently refund ledger.
- Cold-storage provider migration.

## Steps

### Step 1: Regression guard cho AI internal narration

- Add failing tests using the exact leaked `search_knowledge` style response.
- Harden paragraph detection for known internal identifiers and meta narration.
- Add system-prompt response example that is transparent without naming internals.

**Verify**: targeted AI tests pass and `ai-check` later reports PASS.

### Step 2: Central trainer plan catalog and schema rollout

- Implement server-owned catalog with plan codes, prices, limits, duration and entitlements.
- Add public catalog endpoint.
- Extend subscription schema backward-compatibly and write model/catalog tests first.
- Switch max-client lookup to plan code/title fallback and active client definition.

**Verify**: targeted server unit tests pass; catalog prices exactly match confirmed table.

### Step 3: Free trial one-time lifecycle

- Create unique email claim model.
- In one transaction, claim trial and create 30-day subscription with no wallet debit.
- Duplicate email returns `FREE_TRIAL_ALREADY_USED` even after account recreation.
- Upgrade/supersede keeps historical subscription records and coaching data.

**Verify**: integration tests cover first claim, duplicate, active conflict, expiry and paid upgrade.

### Step 4: Email-based admin grants and automatic claim

- Admin endpoint validates email, plan and billing cycle with CSRF + role.
- Existing user receives active subscription immediately.
- Unknown email receives pending grant and invitation email.
- Google login calls a business service to claim matching pending grants after email verification; auth continues safely if mail delivery fails.
- Record audit events and avoid duplicate claims/emails.

**Verify**: service/integration tests cover existing user, pending email, exact normalized match, duplicate/retry and non-admin 403.

### Step 5: Subscription email templates

- Add distinct invitation and activation templates through existing Resend wrapper.
- Send after DB transaction commits; never include secrets or tokens.
- Pricing purchase sends activation mail once only on non-idempotent creation.

**Verify**: unit tests mock mail delivery and assert each state emits at most one notification call.

### Step 6: Pricing and Admin UI

- Fetch catalog with TanStack Query; backend price is authoritative.
- Free card appears first and handles unauthenticated, eligible, active and used states.
- Used state copy: “Gói dùng thử đã kết thúc”; data-preservation message and CTA to Tiêu chuẩn.
- Admin modal supports email, plan and cycle; pending list clearly distinguishes “Chờ đăng nhập”.
- Preserve existing brand/product visual language, keyboard focus, disabled/loading/error states.

**Verify**: client unit tests for derived card states/schema, client lint and build.

### Step 7: Retention metadata and tenant safety

- Expiry records 12-month structured and 90-day media deadlines.
- Retention service is dry-run by default and exposes counts only; destructive enforcement remains gated.
- Expired user loses Trainer API access; records remain keyed to stable trainer user id.
- Tighten coaching timeline query with trainer ownership.
- Count only active clients so archived/completed history does not consume plan slots.

**Verify**: tests prove expiry does not delete data, renewal sees old data, dry-run writes nothing and cross-trainer timeline access is isolated.

### Step 8: Migration and full gates

- Add idempotent phase-10 migration/backfill and verification script/package entry.
- Run targeted tests, full server/client unit, AI check, lint, build, secret scan and boundary scan.
- Restore generated sitemap changes after build and leave `.vscode/` untouched.

**Verify**: every command exits 0; migration script is syntax/test verified but not run against real DB.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Target server | `npm run test:unit:server -- <test-file>` | exit 0 |
| All server | `npm run test:unit:server` | exit 0 |
| All client | `npm run test:unit:client` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0; prerender and budget pass |
| Secrets | `npm run security:secrets` | exit 0 |
| Boundaries | `npm run security:data-boundaries` | exit 0 |

## Done Criteria

- [ ] AI response never exposes `search_knowledge` or internal tool narration in regression tests.
- [ ] Backend catalog owns exact confirmed month/year prices.
- [ ] Free lasts 30 days, max 3 active clients and is one-time per normalized verified email.
- [ ] Free-used UI remains visible and guides upgrade.
- [ ] Existing-account and pending-email admin grants work and send correct email.
- [ ] Paid self-purchase sends one success email and retains wallet idempotency.
- [ ] Subscription expiry revokes Trainer access without deleting coaching history.
- [ ] Retention deadlines are 12 months/90 days and destructive jobs stay gated.
- [ ] Cross-trainer data isolation is enforced.
- [ ] Existing subscription documents remain backward-compatible; migration exists but is not run.
- [ ] Full verification gates pass and no unrelated file is changed.

## STOP Conditions

- Stop if implementation requires disabling CSRF/JWT/rate limits.
- Stop if wallet ledger idempotency cannot be preserved.
- Stop before running any migration or destructive retention against real data.
- Stop if existing production subscription titles cannot be mapped unambiguously.
- Stop after three failed repair cycles for the same verification blocker.

## Maintenance Notes

- Future price/feature changes must update only the server catalog; clients consume it.
- Free eligibility is enforced by a unique normalized-email claim, never by UI state alone.
- Subscription records are entitlement history, not parents of coaching data; never cascade-delete coaching data on subscription deletion.
- Review retention candidate metrics and media byte totals before enabling enforcement.
