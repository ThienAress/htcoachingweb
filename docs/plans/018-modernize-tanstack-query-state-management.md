# Plan 018: Chuẩn hóa TanStack Query v5 và vòng đời server state

> **Hướng dẫn thực thi**: Thực hiện theo đúng thứ tự các bước dưới đây. Sau mỗi
> nhóm thay đổi phải chạy verification mục tiêu trước khi mở rộng phạm vi. Nếu
> phát hiện cần đổi API/backend, transaction semantics hoặc wallet balance
> mutation thì dừng phần đó; không suy diễn ngoài phạm vi đã duyệt.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED; HIGH riêng với thiết kế wallet/account nên chỉ viết spec
- **Depends on**: 001, 002, 003H
- **Category**: bug | perf | tests | tech-debt | migration
- **Planned at**: 2026-08-01
- **Approval**: User đã duyệt thực hiện bảy bước từ TanStack Query review.
- **Execution status**: DONE / LOCAL VERIFIED

## Why This Matters

Client đã dùng TanStack Query rộng nhưng còn hai pattern v4 bị TanStack Query
v5 bỏ qua hoặc diễn giải sai: `invalidateQueries([...])` invalidates toàn cache,
còn `keepPreviousData: true` không giữ dữ liệu trang trước. Query keys hiện phân
tán và một số server state vẫn được fetch bằng `useEffect`, làm mất deduplication,
cache lifecycle và invalidation thống nhất. Plan này sửa correctness trước, sau đó
chuẩn hóa các domain an toàn; wallet/account chỉ được đặc tả và trace riêng vì có
dữ liệu tài chính.

## Current State

- `client/package.json:28` dùng `@tanstack/react-query` `^5.95.2`.
- `client/src/main.jsx:11-18` tạo một `QueryClient` với `staleTime` 5 phút,
  `refetchOnWindowFocus: false` và `retry: 1`.
- Có 20 call `invalidateQueries([...])` trên 7 file; runtime v5 coi array như
  filters object không có `queryKey`, nên mọi query đều match.
- Có 12 query trên 12 file dùng `keepPreviousData: true`; v5 yêu cầu
  `placeholderData: keepPreviousData`.
- `client/src/context/AuthContext.jsx:62` clear toàn cache khi logout.
- `client/src/utils/trainerPrivateCache.js` purge các root coaching nhạy cảm và
  có regression tests.
- `BookingManagement`, `useFoodDatabase` và `useMealPlanAccess` giữ server state
  bằng `useState + useEffect` dù đã có service layer.
- `MyWallet` và `AccountPage` cũng fetch thủ công nhưng liên quan balance,
  deposit, transaction, contract và mutation; không refactor runtime trong plan
  này trước khi spec riêng được user duyệt.
- `RecipeExplorer` đã dùng `placeholderData: keepPreviousData`; đây là exemplar
  cho pagination v5.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Client targeted tests | `npm test --prefix client -- --run <test-files>` | exit 0, all target tests pass |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client compile | `cd client && npx vite build` | exit 0 |
| Agent docs validation | `npm run agents:validate` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope:**

- TanStack v5 migration trong các file match `invalidateQueries([...])` và
  `keepPreviousData: true` tại thời điểm plan được viết.
- Query key/query option factories mới dưới `client/src/queries/`.
- Consumers subscription hiện có: `AdminRoute`, `F1Route`, `TrainerLayout`.
- Migrate read/query + mutation lifecycle cho `BookingManagement`,
  `useFoodDatabase`, `useMealPlanAccess` và consumer trực tiếp liên quan.
- Prefetch recipe detail từ recipe cards và optimistic bookmark có rollback.
- Regression tests cho targeted invalidation, query factories và optimistic
  cache helper.
- Spec `docs/specs/wallet-account-query-migration.md`, docs indexes và plan này.

**Out of scope:**

- Không đổi backend route/controller/service/model hoặc response contract.
- Không đổi auth, CSRF/JWT, `client/src/utils/api.js` hay logout cache semantics.
- Không đổi wallet balance/deposit/purchase mutation runtime trong lượt này.
- Không chạy migration, seed, staging/production write, deploy, commit hoặc push.
- Không refactor toàn bộ `Pricing.jsx`, `TrainerCoaching.jsx` hoặc
  `OnlineCoaching.jsx`; đây là known issues ngoài phạm vi.
- Không bật global `refetchOnWindowFocus` hoặc đổi global `staleTime` khi chưa có
  freshness matrix được kiểm chứng theo domain.

## Steps

### Step 1: Sửa API migration TanStack Query v5

Thay mọi `queryClient.invalidateQueries([...])` bằng
`queryClient.invalidateQueries({ queryKey: [...] })`. Thay mọi
`keepPreviousData: true` bằng import `keepPreviousData` và
`placeholderData: keepPreviousData`.

**Verify**: hai lệnh `rg` cho pattern cũ trả về không có kết quả; client lint
không báo unused import.

### Step 2: Thêm regression guard cho targeted invalidation

Tạo client unit test với ít nhất hai cache entries, gọi invalidation qua helper
object-filter và chứng minh chỉ prefix mục tiêu stale. Test phải fail với array
syntax cũ trước khi fix và pass sau khi fix.

**Verify**: targeted Vitest file pass.

### Step 3: Chuẩn hóa query keys và reusable query options

Tạo factories theo domain cho subscription, wallet/account, coaching, admin list
và public recipe. Dùng `queryOptions` cho query được chia sẻ giữa route/layout
hoặc prefetch/useQuery. Migrate consumers có thay đổi trong plan; không rewrite
mọi query key ngoài phạm vi.

**Verify**: unit tests xác nhận key chứa đủ identity variables và shared
subscription consumers dùng cùng factory.

### Step 4: Migrate các fetch effect rủi ro thấp

Chuyển Booking admin, food database và meal-plan access sang declarative query/
mutation. Giữ nguyên service layer, response adapters, loading/error/retry API mà
consumer đang dùng. Effect dùng cho DOM, timer, event listener và form sync vẫn
được giữ nguyên.

**Verify**: targeted tests cho hook/helper nếu có logic; lint và compile pass.

### Step 5: Viết wallet/account migration spec và impact matrix

Trace page -> service -> endpoint, response envelope, mutation, invalidation,
private cache, conflict/idempotency và UI states. Spec phải quy định server luôn
authoritative, không optimistic balance, không đổi CSRF/JWT, và yêu cầu user duyệt
trước khi implement runtime.

**Verify**: spec có objective, file map, boundaries, test strategy, success
criteria, open questions và được link từ `docs/README.md`.

### Step 6: Thêm prefetch và optimistic update rủi ro thấp

Dùng cùng recipe-detail query options cho `useQuery` và `prefetchQuery` khi recipe
card hover/focus. Bookmark update được phép optimistic vì reversible: cancel
query, snapshot cache, set cache, rollback on error và invalidate on settle.

**Verify**: unit test helper cache cover add/remove/rollback; keyboard focus cũng
kích hoạt prefetch; không prefetch khi slug thiếu.

### Step 7: Re-trace, QA và cleanup

Chạy lại inventory pattern cũ, review mọi query key/consumer, `git diff --check`,
client lint, client tests và compile build. Cập nhật plan/index theo kết quả thật.

## Test Plan

- Regression: object-filter invalidation chỉ stale đúng prefix và giữ query không
  liên quan fresh.
- Query factory: user/filters/slug/language cần thiết đều tham gia query key.
- Booking: query key thay đổi theo page/status/search; mutation thành công
  invalidate list; conflict vẫn refresh list.
- Meal access: disabled khi logout; record mutation cập nhật generation count và
  giữ semantics 403.
- Recipe bookmark: optimistic add/remove, rollback khi lỗi và settled
  invalidation.
- Existing trainer-private cache tests tiếp tục pass.
- Compile build để bắt import/API v5 sai; E2E skip nếu không có authenticated dev
  servers và test data.

## Done Criteria

- [x] Không còn `invalidateQueries([...])` trong `client/src`.
- [x] Không còn `keepPreviousData: true` trong `client/src`.
- [x] Targeted invalidation test chứng minh query không liên quan không stale.
- [x] Shared query factories được dùng thực tế, không có module mới chỉ để trang trí.
- [x] Ba fetch effect rủi ro thấp đã được migrate mà giữ public hook/UI contract.
- [x] Wallet/account spec hoàn chỉnh; runtime wallet/account chưa bị thay đổi.
- [x] Recipe prefetch hỗ trợ pointer và keyboard; optimistic bookmark rollback được.
- [x] Client tests, lint, compile build, agent validation và diff hygiene pass hoặc
  blocker môi trường được ghi đúng, không tuyên bố pass giả.
- [x] Không có debug log, commented-out code hoặc unused import mới.
- [x] `docs/plans/README.md` cập nhật trạng thái Plan 018.

## Verification Evidence

- `npm run lint --prefix client`: PASS.
- `npm run test:unit:client`: PASS, 38 files / 216 tests.
- `cd client && npx vite build`: PASS, 2791 modules transformed; chỉ còn
  bundle-size warning đã biết, không có compile error.
- `npm run agents:validate`: PASS trước final status update; chạy lại ở delivery gate.
- `npm run security:data-boundaries`: PASS, 0 violations.
- `npm run security:secrets`: PASS.
- `git diff --check`: PASS.
- Static re-scan: 0 `invalidateQueries([...])`, 0 `keepPreviousData: true`.
- E2E: SKIP vì không có authenticated dev servers/test data được xác nhận; không
  có wallet/account runtime mutation trong plan này.
- Server tests: NOT RUN vì không thay backend runtime.

## Implementation Notes

- Giữ nguyên global `staleTime`/focus defaults; freshness matrix chi tiết nằm
  trong wallet/account spec và cần duyệt trước runtime migration.
- `MyWallet`, `AccountPage`, Header composite query và Pricing purchase flow chưa
  bị refactor; đây là hard boundary của feature spec, không phải phần bỏ sót.
- Query factory mới được dùng cho subscription guards/layout, admin lists,
  Booking, Food/Meal access, deposit policy và recipe detail/bookmarks.
- Optimistic update chỉ áp dụng bookmark có snapshot/rollback; không áp dụng cho
  balance, deposit, order, contract hay subscription purchase.
## STOP Conditions

- Một refactor yêu cầu đổi response contract hoặc backend endpoint.
- Wallet/account implementation cần suy đoán transaction, idempotency hay balance
  authority ngoài contract hiện có.
- Query key mới có thể trộn dữ liệu của hai user/client mà không thể chứng minh
  cache được purge an toàn.
- Cần sửa `AuthContext.jsx`, `utils/api.js`, CSRF/JWT hoặc rate limit.
- Cùng một verification fail ba vòng sau các sửa có căn cứ.
- Phát hiện file in-scope có thay đổi user chưa biết và thay đổi đó chồng lên cùng
  symbol đang sửa.

## Maintenance Notes

- Query key là identity của data; mọi biến thay đổi response phải nằm trong key.
- Dùng prefix factories cho invalidation, detail keys cho exact cache update.
- Global freshness không thay thế policy theo domain.
- Wallet/account spec là gate riêng; chỉ triển khai sau khi user review/approve.
- Không dùng optimistic UI cho balance, debit, deposit approval hay purchase.
