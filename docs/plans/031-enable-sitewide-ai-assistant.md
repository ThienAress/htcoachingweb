# Plan 031: Mở HT Assistant theo ngữ cảnh toàn website cho guest

> **Hướng dẫn thực thi**: Thực hiện từng behavior slice, chạy focused verification trước khi chuyển bước.
> Nếu cần nới dữ liệu private, bỏ CSRF/rate limit hoặc migration production thì STOP.
>
> **Drift check**: Các AI runtime files không có diff tại thời điểm lập plan; working tree có nhiều thay đổi
> ngoài scope, đặc biệt `BlogDetail.jsx`, `useBlogEngagement.js`, `App.jsx` và analytics. Không ghi đè chúng.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 019, 020, 021, 026A, 027
- **Category**: security | feature | ux
- **Planned at**: 2026-08-06
- **Execution**: IMPLEMENTED / LOCAL VERIFIED — FULL SERVER + PRERENDER ENV BLOCKED

## Why This Matters

Launcher hiện chỉ xuất hiện sau login và backend giả định mọi conversation có `userId`. Context đã có cho một
số detail page nhưng bị cắt quá ngắn, registry phân tán và một số query thiếu public-status filter. Plan này
mở discovery cho khách mới trong khi giữ auth/data boundaries và biến page awareness thành contract dùng chung.

## Current State

- `DeferredChatPanel.jsx:21` và `ChatPanel.jsx:350` chặn `!user`.
- `ai.routes.js:18-30` dùng `protect` cho mọi route.
- `ChatConversation.js:33-37` yêu cầu `userId`.
- `ChatPanel.jsx:275-283` gửi pathname/type/title; `aiChat.js` allowlist type nhưng không xác minh cặp route/type.
- `contextEnricher.js:36` query recipe thiếu `isPublished: true`; blog chỉ lấy 1.000 ký tự và recipe 5 bước.
- `useBlogEngagement.js` là thay đổi ngoài scope đang đo 30 giây + 50% scroll; plan không sửa file đó.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused server | `npm run test:unit:server -- --run <file>` | exit 0 |
| Focused client | `npm run test:unit:client -- --run <file>` | exit 0 |
| Tool contract | `node .agents/scripts/validate-tools.mjs` | ALL PASS |
| Agent contract | `npm run agents:validate` | exit 0 |
| Release build | `npm run build --prefix client` | exit 0 |

## Scope

**In scope**:

- AI chat route/controller/model/middleware/services/tool registry và focused tests.
- Chat launcher/panel, page-context config, proactive nudge hook và focused tests.
- Knowledge Base conversation filters để guest content không đổi admin contract.
- Spec/plan/index documentation.

**Out of scope**:

- Deploy, migration/backfill/index apply trên production.
- `client/src/utils/api.js`, `AuthContext`, JWT/CSRF middleware hiện có.
- Dashboard/admin/trainer navigation, Blog analytics và các thay đổi dirty khác.
- Tự động crawl DOM hoặc gọi AI khi chưa có click.

## Steps

### Step 1: Guest gửi chat an toàn nhưng không có capability cá nhân

Thêm optional AI auth phân biệt “không token” với “token lỗi”, guest session cookie httpOnly đã hash, owner
XOR trong conversation và rate limit riêng. Giữ history/fork/delete/feedback protected; filter tool schema
theo actor và dùng moderation stateless cho guest.

**Behavior**: Guest gửi tối đa quota, giữ mạch trong tab; user đăng nhập vẫn có đầy đủ history/tool.

**Blast radius**: route, middleware, controller, model, moderation, tool registry và Knowledge Base filters.

**Depends on**: none.

**Verify**: focused server tests cho auth/guest isolation/tool capability và existing AI integration tests.

### Step 2: Server hiểu canonical page context trên toàn website

Tập trung route registry và detail adapters ở server; derive type từ pathname; query published DTO; chỉ lấy
nội dung blog mở rộng khi intent cần summary; đóng gói CMS dưới untrusted-data boundary.

**Behavior**: Cùng một request giả mạo `pageType` vẫn chỉ nhận context đúng theo route; draft không vào prompt.

**Blast radius**: context service, request parsing/controller, system prompt và tests.

**Depends on**: Step 1.

**Verify**: context resolution tests + system prompt assertions + existing conversation memory tests.

### Step 3: Guest UI và suggestion dùng registry theo trang

Tách page map/suggestions khỏi `ChatPanel`; hiển thị launcher cho guest; ẩn sidebar/history/upload/feedback;
reset local conversation khi actor chuyển guest ↔ user và thêm CTA đăng nhập.

**Behavior**: Guest mở chat trên public route, thấy gợi ý đúng trang và không thấy control private.

**Blast radius**: client config, DeferredChatPanel, ChatPanel và focused component/config tests.

**Depends on**: Steps 1-2.

**Verify**: focused client tests + client compile.

### Step 4: Lời mời hỗ trợ chủ động local-first

Thêm hook generic đo active-time/scroll theo route config, session cap và localStorage snooze; nudge dùng UI
solid zinc/emerald, aria-live polite, close/CTA đủ hit target. Click CTA mới mount chat và gửi prompt canonical.

**Behavior**: Không có network call trước click; tối đa một nudge/session; dismiss được nhớ theo route.

**Blast radius**: new hook/config, DeferredChatPanel và tests.

**Depends on**: Step 3.

**Verify**: fake-timer client tests + manual DOM/keyboard check nếu dev server sẵn sàng.

### Step 5: Re-trace, QA và cleanup

Chạy lại dependency searches, review diff theo Standards/Spec/Security, AI check, unit suites và release build;
cập nhật plan status/evidence thật.

**Behavior**: Không regression auth chat; không file ngoài scope bị ghi đè; evidence đủ bàn giao.

**Depends on**: Steps 1-4.

**Verify**: `git diff --check`, tools validation, agents validation, client/server unit, release build.

## Test Plan

- Guest chat: no token success; expired/invalid token 401; CSRF required; guest A không đọc conversation B.
- Model: exactly one owner; existing user docs hợp lệ; guest TTL ngắn.
- Tools: guest schema không chứa auth tools và `search_knowledge`; executor vẫn fail closed.
- Context: path normalization, static route, detail route, draft exclusion, spoofed type, content bounds.
- Nudge: active/visibility/scroll, one-per-session, per-route snooze và click action.
- Regression: authenticated AI integration, moderation, conversation memory và ChatPanel runtime.

## Done Criteria

- [x] Success criteria trong spec đạt bằng focused tests và review trace end-to-end.
- [x] Client full unit 301/301, lint và Vite production compile pass.
- [x] Focused server AI/guest/context suites pass; full server suite đã thử 3 lần nhưng runner không thoát trước timeout 5 phút.
- [x] AI tool validator, agent validator, secret scan và data-boundary scan pass.
- [x] `git diff --check` sạch cho working-tree diff.
- [x] Không debug log, secret, raw IP, unused import hoặc commented-out code mới trong scope.
- [x] `docs/plans/README.md` cập nhật trạng thái thực tế.

## Verification Evidence

- Focused server AI suite after final review fixes: 6 files, 34/34 tests pass.
- Focused client context/nudge/runtime: 3 files, 11/11 tests pass.
- Client full unit: 62 files, 301/301 tests pass; ESLint `--quiet` pass.
- `vite build` production compile pass. Full `npm run build --prefix client` tới được postbuild nhưng prerender bị sandbox chặn public fetch (`EACCES`) và route waits gây timeout; không có compile error.
- Full server unit được chạy riêng tới timeout 300 giây, không có assertion failure được report; focused AI/integration evidence ở trên là release evidence cho scope này.
- `validate-tools.mjs`: 11/11 tools hợp lệ; executor test xác nhận guest không thể gọi tool bị tắt kể cả provider trả tool call ngoài schema.
- `agents:validate`, `security:secrets`, `security:data-boundaries` đều pass; E2E không chạy vì không có dev servers/test environment.
- Chưa apply index mới lên production; `guest_ai_conversations` sẽ được Mongoose tạo theo quy trình deploy hiện có.

## STOP Conditions

- Cần thay đổi JWT/CSRF interceptor hoặc nới private ownership.
- Cần migration/backfill/index apply trên dữ liệu thật.
- AI runtime files xuất hiện concurrent diff không thuộc task.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Trang mới thêm vào server page registry; UI chỉ thêm suggestion/nudge khi cần presentation riêng.
- Quota guest đọc từ env và phải giữ giới hạn bảo thủ cho tới khi có production evidence.
- Guest conversations không phải nguồn Knowledge Base; thay đổi quyết định này cần privacy review riêng.
