# Spec: Chuẩn hóa TanStack Query cho Wallet và Account

**Status:** IMPLEMENTED / LOCAL TARGETED VERIFIED — authenticated financial E2E còn chờ test account.

## Assumptions

1. Backend hiện tại là nguồn sự thật duy nhất cho balance, ledger, deposit status,
   subscription, orders, transactions và contracts.
2. Runtime migration đã được user duyệt và áp dụng cho `MyWallet`,
   `AccountPage`, `Pricing` và Header; không sửa financial endpoint.
3. Migration tương lai giữ nguyên endpoint, CSRF/JWT cookie flow, idempotency key,
   response envelope và server-side ownership checks.
4. Query cache luôn scope theo `userId`; logout tiếp tục dùng
   `queryClient.clear()`.
5. Không optimistic balance, deposit approval, purchase hoặc transaction history.
   Chỉ được ghi cache balance từ response server-authoritative như
   `data.newBalance`, nếu contract đã được test.

## Objective

Chuyển các read model Wallet/Account đang dùng `useState + useEffect` hoặc query
composite sang reusable TanStack Query options, để các consumer chia sẻ cache,
deduplicate request và invalidate có chủ đích sau mutation. Migration phải giữ
nguyên financial correctness: server quyết định số tiền, ledger và trạng thái;
frontend chỉ hiển thị response đã xác thực và không giả lập debit/credit.

Success là Wallet, Account, Header và Pricing cùng dùng một identity cho mỗi
resource, partial error không làm mất dữ liệu domain khác, và mọi financial
mutation có invalidation matrix/test rõ ràng.

## Tech Stack liên quan

- React 19.2.4
- TanStack Query 5.95.2
- Axios instance hiện có trong `client/src/utils/api.js`
- Express 5, Mongoose 9
- JWT trong httpOnly cookies và CSRF header do axios interceptor quản lý
- Vitest frontend; Vitest + Supertest + MongoDB Memory Server backend

## Commands

- Client compile: `cd client && npx vite build`
- Client tests: `npm run test:unit:client`
- Server tests: `npm run test:unit:server`
- Financial boundary scan: `npm run security:data-boundaries`
- Diff hygiene: `git diff --check`

## Current contracts và dependency map

| Resource/command | Client producer | HTTP contract | Backend producer | Current consumers |
|---|---|---|---|---|
| Wallet balance | `wallet.service.getMyWallet` | `GET /api/me/wallet` → `{ success, data: { balance, currency } }` | `deposit.controller.getMyWallet`; user scoped, upsert zero wallet | `MyWallet`, Header, Pricing |
| Deposit history | `wallet.service.getMyDeposits` | `GET /api/deposits` → latest 20 own deposits | `deposit.controller.getMyDeposits`; query by `userId` and field projection | `MyWallet` |
| Deposit policy | `wallet.service.getDepositPolicy` | `GET /api/deposits/policy` → server min/max policy | `depositPolicy.controller` | `useDepositPolicy` / `MyWallet` |
| Create deposit | `wallet.service.createDeposit` | `POST /api/deposits`; financial limiter + CSRF | `deposit.controller.createDeposit`; validates canonical amount/open request | `MyWallet` |
| Confirm deposit | `wallet.service.confirmDeposit` | `POST /api/deposits/:id/confirm`; financial limiter + CSRF | ownership filter `{ _id, userId }`, state/expiry guarded | `MyWallet` |
| Account orders | `user.service.getMyOrders` | `GET /api/user/me/orders` → top-level `trainerSubscriptions`, `trainerOrders`, `clientOrders` | inline protected handler in `user.routes.js` | `AccountPage` |
| Transactions | `user.service.getMyTransactions` | `GET /api/user/me/transactions` → top-level `transactions` | inline protected handler, query by `userId` | `AccountPage` |
| My contracts | `contract.service.getMyContracts` | `GET /api/contracts/my` → `{ success, data }` | `contract.controller` → `contract.service.getMyContracts`, client scoped | `AccountPage` |
| Subscription | `trainerSubscription.service.getMySubscription` | `GET /api/trainer-subscriptions/my` | lifecycle controller/service | route guards, TrainerLayout, Header, Pricing |
| Purchase | `purchaseTrainerPlan` | `POST /api/trainer-subscriptions/purchase`; CSRF + requestId/catalog handshake | transactional purchase service + wallet ledger; response `data.newBalance` | Pricing |

## Target query architecture

### Canonical keys

Dùng factories từ `client/src/queries/queryKeys.js`:

- `walletAccountKeys.wallet.mine(userId)`
- `walletAccountKeys.wallet.deposits(userId)`
- `walletAccountKeys.wallet.policy()`
- `walletAccountKeys.account.orders(userId)`
- `walletAccountKeys.account.transactions(userId)`
- `walletAccountKeys.account.contracts(userId)`
- `subscriptionKeys.mine(userId)`

Không dùng endpoint URL làm key. Không dùng key không có `userId` cho private
resource, ngoại trừ policy không chứa dữ liệu người dùng.

### Query options

Tạo option factory riêng cho từng resource trong
`client/src/queries/walletAccount.queries.js`. Mỗi option phải:

- gọi service hiện có, không gọi `api` trực tiếp từ component;
- normalize đúng response envelope một lần;
- `enabled: Boolean(userId)` với private resource;
- nhận `AbortSignal` nếu service hỗ trợ;
- đặt freshness theo nghiệp vụ, không dựa mù vào global 5 phút;
- retry tối đa một lần cho 5xx/network; không retry 401/403/4xx;
- giữ error riêng theo domain.

Khuyến nghị freshness ban đầu:

| Resource | staleTime | Refetch |
|---|---:|---|
| Deposit policy | 5 phút | mount khi stale |
| Wallet balance | 30 giây | focus khi stale; invalidate sau purchase/financial response |
| Deposit history | 15 giây khi có open deposit, 60 giây nếu không | polling chỉ khi `pending/needs_review` |
| Orders/contracts | 60 giây | focus khi stale |
| Transactions | 30 giây | invalidate sau purchase; focus khi stale |
| Subscription | 60 giây | shared factory hiện có |

### Consumer split

- `MyWallet`: hai queries độc lập cho wallet và deposits; policy tiếp tục là query
  riêng. Create/confirm dùng `useMutation`.
- `AccountPage`: orders, transactions và contracts là ba queries độc lập. Profile
  form state vẫn là client state; avatar preview vẫn local/object URL.
- Header: bỏ composite `header-account-summary`; dùng wallet và subscription
  options chung để dedup với Wallet/Pricing/route guards.
- Pricing: dùng wallet/subscription queries chung. Purchase vẫn là server command,
  không optimistic.
- Query error ở một domain không được xóa hoặc che dữ liệu domain khác.

## Mutation và invalidation matrix

| Mutation | Cache write được phép | Invalidate bắt buộc | Không được làm |
|---|---|---|---|
| Create deposit | Có thể dùng response server để đặt active deposit | deposit history | Không tăng balance |
| Confirm deposit | Có thể cập nhật status từ response server | deposit history | Không set success/balance |
| Purchase trainer plan | Có thể set wallet balance từ `data.newBalance` nếu là integer/null contract hợp lệ | wallet, transactions, subscription, account orders, Header-derived consumers | Không trừ balance phía client; không tạo subscription optimistic |
| Update profile/avatar | Chỉ auth/profile response server | auth/current-user cache nếu được chuẩn hóa | Không đưa file/blob vào query cache |
| Contract sign/view/download | Chỉ response server nếu endpoint trả entity đầy đủ | my contracts và contract detail phù hợp | Không optimistic signature/download counters |
| Admin approve/reverse deposit | Không cross-write cache của user khác trong admin browser | admin deposits; user browser tự refresh/poll/focus | Không giả định có push cross-session |

Mọi `onSuccess` có invalidation cần return/await Promise để `isPending` chỉ kết
thúc sau khi cache active được đồng bộ.

## UI states

Mỗi tab/page phải xử lý độc lập:

- initial loading;
- background fetching không xóa dữ liệu hiện tại;
- empty;
- API error + retry;
- disabled/pending mutation;
- 401/403 fail closed;
- 409 conflict refetch server state;
- stale/open deposit polling indicator;
- accessibility: status qua `role="status"` hoặc `aria-live`, action pending bị
  disable nhưng không mất focus.

Wallet balance lỗi không được fallback thành số 0 theo cách khiến người dùng hiểu
là balance thật; hiển thị trạng thái “không tải được” hoặc `—`. Pricing không được
cho phép purchase nếu balance chưa xác minh, trừ Free flow đã được backend định
nghĩa.

## Cấu trúc file đã triển khai

### Sửa

- `client/src/queries/queryKeys.js`
- `client/src/queries/walletAccount.queries.js`
- `client/src/pages/wallet/MyWallet.jsx`
- `client/src/pages/account/AccountPage.jsx`
- `client/src/sections/Header/Header.jsx`
- `client/src/sections/Pricing.jsx` — chỉ khu vực wallet/subscription query
- `client/src/services/wallet.service.js`
- `client/src/services/user.service.js`
- `client/src/services/contract.service.js`

### Tests dự kiến

- `client/src/queries/__tests__/walletAccount.queries.test.js`
- `client/src/queries/__tests__/subscription.queries.test.js`
- `server/src/routes/__tests__/accountReadModels.integration.test.js`
- Component/hook tests gần consumer nếu test runtime có React Testing Library.
- Giữ và mở rộng:
  - `server/src/controllers/__tests__/deposit.integration.test.js`
  - `server/src/controllers/__tests__/depositPolicy.integration.test.js`
  - `server/src/controllers/__tests__/phase6.financial.integration.test.js`
  - `server/src/controllers/__tests__/trainerSubscription.lifecycle.integration.test.js`
- Bổ sung integration coverage cho `/user/me/orders`,
  `/user/me/transactions` và `/contracts/my` vì hiện chưa có targeted test được
  tìm thấy.

Không cần sửa backend runtime nếu contract tests xác nhận response hiện tại.

## Code Style

- Component/page chỉ gọi service hoặc query option factory.
- Query keys được lấy từ factory; không khai báo string trùng trong consumer.
- TanStack Query v5 object syntax.
- Server state ở query cache; form/modal/filter/preview ở React state.
- Chỉ sửa đúng khu vực liên quan trong `Pricing.jsx` vì file lớn là known issue.

## Testing Strategy

### Frontend

1. Key isolation giữa hai user.
2. Query options normalize đúng từng response envelope.
3. Logout/clear không để private cache.
4. Create/confirm invalidation đúng, không sửa balance.
5. Purchase success dùng server `newBalance`; replay `skipped` không double apply.
6. Partial query error: Wallet, orders, transactions, contracts render độc lập.
7. Open deposit polling bật/tắt đúng trạng thái.
8. 409 refetch và UI giữ command error.

### Backend contract gates

1. Wallet/deposit ownership và CSRF giữ nguyên.
2. Invalid amount/open-deposit conflict không thay đổi.
3. Purchase stale catalog/request replay tạo đúng một ledger effect.
4. `newBalance` khớp ledger.
5. Account orders/transactions/contracts chỉ trả dữ liệu của actor.
6. Response envelopes khớp adapters frontend.

### E2E

Chỉ chạy với local dev servers và test account được xác nhận:

- mở Wallet, tạo deposit test hợp lệ, xác nhận rồi quan sát status refetch;
- purchase bằng wallet test đã seed, reload Header/Account và đối chiếu balance;
- logout/login account khác và chứng minh không thấy cache account trước.

Không chạy staging/production write trong implementation mặc định.

## Boundaries

### Always

- Backend authoritative cho money/status.
- User ID trong private query keys.
- Clear cache khi logout.
- CSRF/JWT interceptor giữ nguyên.
- IDOR/ownership và rate limit giữ nguyên.
- Invalidate theo matrix và test target/unrelated cache.
- Không log payload tài chính hoặc PII.

### Ask first

- Thay response envelope hoặc endpoint.
- Thêm WebSocket/SSE/push invalidation.
- Thay polling interval có ảnh hưởng tải backend.
- Thay semantics `newBalance`, ledger, idempotency hoặc deposit state.
- Chạy E2E có write trên staging/production.

### Never

- Optimistic balance/debit/credit.
- Dùng frontend amount làm nguồn trừ tiền.
- Disable CSRF/rate limit.
- Đổi httpOnly JWT cookies.
- Cache private data bằng key không scope user.
- Chạy migration/seed/financial cleanup không có target xác nhận.

## Success Criteria

- Wallet, Header và Pricing chia sẻ một wallet query identity.
- Route guards, Header và Pricing chia sẻ subscription query identity.
- Account orders/transactions/contracts fetch và lỗi độc lập.
- Không còn fetch server state bằng effect trong `MyWallet`/`AccountPage`.
- Mọi mutation tuân thủ invalidation matrix.
- Không optimistic financial state.
- Existing financial tests và test mới đều pass.
- Client lint/build pass; data-boundary scan pass.
- Không thay đổi backend contract hoặc dữ liệu thật.

## Impact matrix

| Contract/symbol | Producer | Consumers đã trace | Test/gate dự kiến | Kết quả |
|---|---|---|---|---|
| wallet balance | deposit controller | MyWallet, Header, Pricing, purchase response | deposit + phase6 financial integration | Giữ server-authoritative |
| deposit list/status | deposit controller | MyWallet | deposit integration + polling query tests | Giữ ownership/status guards |
| account orders | inline user route | Account Orders tab | protected contract test | Ownership/envelope test pass |
| transactions | inline user route | Account History tab, purchase refresh | protected contract test + ledger tests | Ownership/envelope test pass |
| my contracts | contract controller/service | Account Contracts tab | ownership/list test | Client-scope test pass |
| subscription | lifecycle controller/service | route guards, layout, Header, Pricing | lifecycle integration + query key tests | Shared factory đã có |
| purchase `newBalance` | purchase service/controller | Pricing → wallet/transaction/subscription caches | lifecycle + phase6 replay tests | Chỉ dùng response server |

## Quyết định đã duyệt ngày 2026-08-01

1. Wallet polling 15 giây chỉ khi có deposit `pending/needs_review`.
2. Account lazy query theo tab; profile hiển thị ngay, dữ liệu tab giữ trong cache.
3. Giữ countdown + full-page reload sau purchase cho tới khi financial E2E pass.
4. Header refetch wallet/subscription khi focus; không polling toàn ứng dụng.
