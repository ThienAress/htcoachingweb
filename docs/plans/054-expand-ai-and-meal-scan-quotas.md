# Plan 054: Mở rộng quota AI Chat và Meal Scan theo entitlement

> **Hướng dẫn thực thi**: Thực hiện từng behavior slice, chạy focused verification sau mỗi
> slice và không chạy migration hay ghi dữ liệu production. Nếu contract runtime khác phần
> Current State hoặc cần giảm quyền lợi của entitlement đã mua thì dừng và cập nhật plan.
>
> **Drift check**: Đọc `git status --short`, diff các file in-scope và đối chiếu registry,
> route middleware, model quota cùng spec trước khi sửa. Giữ nguyên các thay đổi Pricing,
> email catalog và backup-readiness đang có trong working tree.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 033, 052, 052A
- **Category**: migration
- **Planned at**: 2026-08-18
- **Execution**: IMPLEMENTED / FULL QA VERIFIED — STAGING DEPLOY PENDING

## Why This Matters

Quota hiện tại chỉ có một cửa sổ và làm Meal Scan trả phí kém hấp dẫn hơn quyền miễn phí.
Thay đổi này tạo funnel rõ ràng “1 lượt Guest + 1 lượt sau đăng nhập”, bổ sung burst limit
chống spam cùng ngân sách 30 ngày cho các entitlement trả phí, và bảo đảm khách đã mua không
bị giảm quyền lợi khi registry thay đổi trong tương lai.

## Current State

- `server/src/constants/serviceAccessPolicies.js` chỉ mô tả một `limit/windowMs` cho mỗi tier.
- `server/src/services/serviceUsageLedger.service.js` giữ một counter/bucket cho mỗi actor + service;
  chưa thể enforce đồng thời burst và monthly limit hoặc hoàn lượt provider lỗi.
- `server/src/middlewares/aiRateLimit.js` tách Fitness+ sang Express rate-limit store riêng.
- `server/src/models/FitnessSubscription.js`, `TrainerSubscription.js` và `Order.js` chưa lưu
  policy snapshot để làm sàn quyền lợi.
- `client/src/pages/MealScan/MealScan.jsx` và Chat quota presentation chỉ hiển thị một cửa sổ.
- Trang Admin đã render policy từ API canonical; presentation chưa format danh sách cửa sổ.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused server | `npm exec --prefix server vitest run -- <test files>` | exit 0 |
| Focused client | `npm exec --prefix client vitest run -- <test files>` | exit 0 |
| Client lint | `npx eslint <changed client files>` | exit 0 |
| Quick QA compile | `npx vite build` trong `client/` | exit 0 |
| AI gate | chạy workflow `$ai-check` | không có regression mới |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Registry/resolver của `ai_chat`, `meal_scan`, quota metadata và Admin matrix.
- Mongo shared ledger đa cửa sổ, guest Meal Scan browser trial, refund provider 5xx/timeout.
- Snapshot/version quyền lợi trên Order, TrainerSubscription và FitnessSubscription mới.
- UI quota Meal Scan/HT Assistant, CTA đăng nhập và locale liên quan.
- Focused tests, spec này, service-access spec và plan index.

**Out of scope**:

- Không đổi giá, wallet debit, catalog gói hoặc email.
- Không chạy migration/backfill/index production.
- Không xóa collection/store Fitness+ cũ trong cùng rollout; code không còn dùng có thể được
  dọn ở release sau khi production verification.
- Không sửa auth/CSRF/JWT interceptor hoặc dữ liệu hội thoại.

## Steps

### Step 1: Phát policy canonical đa cửa sổ và chọn entitlement mạnh nhất

Registry mô tả stable quota windows (`trial`, `burst`, `daily`, `monthly`) và Admin API phát
nguyên shape này. Resolver lấy mọi entitlement active, chọn policy mạnh nhất theo từng service,
không để việc mua thêm gói làm quota thấp đi.

**Behavior**: bảy tier có đúng ma trận đã duyệt; Admin “Hạn mức công cụ” hiển thị tất cả cửa sổ.

**Verify**: registry/resolver/Admin route và presentation focused tests pass.

### Step 2: Enforce quota atomically và hoàn lượt lỗi upstream

Shared ledger lưu usage event theo actor + service và atomically chỉ thêm event khi mọi cửa sổ
còn dung lượng. Guest Meal Scan dùng opaque httpOnly browser cookie cho trial; IP limiter vẫn là
lớp chống abuse. Provider 5xx/timeout của Meal Scan hoặc HT Assistant xóa reservation tương ứng
một cách idempotent.

**Behavior**: request cuối hợp lệ được phép, request kế tiếp 429 có metadata mọi cửa sổ; request
upstream lỗi không làm giảm `remaining`.

**Verify**: ledger concurrency/refund tests, Meal Scan route integration và AI quota middleware pass.

### Step 3: Giữ sàn quyền lợi entitlement đã mua

Order được duyệt và subscription mới lưu `entitlementPolicyVersion` cùng snapshot allowlisted.
Resolver lấy max giữa snapshot và registry hiện tại; document cũ không có snapshot fallback về
registry mới và không cần backfill.

**Behavior**: hạ literal trong registry test fixture không làm quota entitlement có snapshot giảm;
subscription mới có version/snapshot, API public không lộ field nội bộ.

**Verify**: schema, lifecycle/purchase và resolver compatibility tests pass.

### Step 4: Đồng bộ trải nghiệm client

Meal Scan nói rõ Guest có một lượt, khi hết hiện CTA `/login`, User thường chỉ còn một lượt trial.
Meal Scan và HT Assistant render cửa sổ quota do server phát; không hardcode limit fallback.

**Behavior**: loading/error/retry hiện tại không regress; quota trial không hiện reset giả;
daily/monthly hiển thị rõ remaining và reset.

**Verify**: client service/runtime/component tests, ESLint và UI audit phạm vi thay đổi pass.

### Step 5: QA, review và bàn giao

Chạy AI check, focused QA rồi full gates khả thi trong sandbox. Review độc lập ba axis và cập nhật
plan status bằng kết quả thật; blocker môi trường ghi `BLOCKED`, không đổi thành `PASS`.

## Verification Evidence — 2026-08-18

**PASS**:

- `npm run build --prefix client`: Vite release build, prerender `38/38` route và bundle budget pass.
- `npm run test:unit:client`: `97` test files, `469/469` tests pass.
- `npm run test:unit:server`: `174` test files, `898/898` tests pass, gồm Mongo integration cho
  concurrency, lifetime trial, dual-window quota, refund và snapshot floor.
- `npm run test:e2e`: Chromium `98/98` tests pass; Guest/User CTA, entitled-user behavior và mobile
  Meal Scan `390px` đều được thực thi.
- `npm run lint --prefix client`, AI eval `9/9`, tool validation `11/11` và runtime logging pass.
- UI regression gate có `0` finding mới, `0` high-confidence blocker và `8` finding được giải quyết.
- Browser local desktop/mobile: ba thẻ HT Fitness+ cùng top/height; hover nâng `8px`; Month/Year dùng
  chung control `44px`, indicator `300ms`; viewport `390px` không overflow ngang.
- Secret scan, repository data-boundary scan, client/server dependency audit, commercial contract,
  ops `35/35`, agent validation và `git diff --check` đều pass.

**PENDING**:

- Commit/push và xác minh exact candidate trên staging được thực hiện ở release step riêng; không có
  migration/backfill bắt buộc cho rollout additive này.

## Test Plan

- Registry: assert literal độc lập cho toàn bộ AI Chat/Meal Scan matrix.
- Ledger: concurrent boundary, dual-window exhaustion, lifetime trial, replay và refund idempotent.
- Resolver: guest/user, coaching, trainer, ba Fitness+, multiple entitlements, snapshot floor.
- Meal Scan HTTP: Guest 1 → 429/login, User 1 → 429, provider 5xx/timeout refund, CSRF giữ nguyên.
- AI: SSE quota windows, provider/deadline refund, abuse ceiling vẫn hoạt động.
- Client: Admin format đa cửa sổ, Chat compact status, Meal Scan login CTA và locale.

## Done Criteria

- [x] Ma trận canonical khớp spec và bảng Admin.
- [x] Guest Meal Scan chỉ có 1 trial browser; User thường chỉ có thêm 1 trial account.
- [x] Paid/coaching/trainer enforce đồng thời burst/daily và monthly quota.
- [x] Provider 5xx/timeout hoàn lượt idempotent.
- [x] Entitlement mới lưu snapshot và không bị giảm dưới snapshot.
- [x] Quota response giữ field tương thích và bổ sung `windows`.
- [x] Focused/full client-server tests và release build có runtime evidence thật.
- [x] AI check khả thi, lint, UI audit và `git diff --check` có evidence thật.
- [x] Không có production mutation, debug log hoặc thay đổi ngoài scope do plan tạo ra.

## STOP Conditions

- Cần hạ CSRF/auth/rate limit hoặc tin tier từ client.
- Cần migration/backfill production để runtime hoạt động.
- Snapshot không thể được lấy trước financial mutation trong cùng transaction.
- Cùng focused verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Stable window key là contract; đổi period/window semantics cần version mới và compatibility test.
- Collection Fitness+ quota cũ chỉ được xóa sau deploy verification và migration riêng có phê duyệt.
- Khi giảm quota tương lai, tạo policy version mới; resolver phải tiếp tục lấy max với snapshot cũ.
