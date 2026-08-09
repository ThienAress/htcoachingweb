# Plan 028: Xây dựng SEO & Conversion Analytics an toàn

> **Hướng dẫn thực thi**: triển khai theo release, khóa contract bằng test trước và chỉ mở release sau khi
> release trước pass. Không deploy, chạy migration/sync dữ liệu thật, cài Docker hoặc dùng paid API nếu
> chưa có yêu cầu/target/credential riêng.
>
> **Drift check**: `client/index.html` vẫn chỉ cấu hình GA4 base; `BlogPost.views` vẫn tăng ở public detail;
> Contact và Booking vẫn là hai lead model riêng; F1/Order chỉ có optional explicit origin reference; admin routes vẫn được
> bảo vệ bởi `AdminRoute` + backend role middleware. Nếu một điều sai, dừng và trace lại impact map.

## Status

- **Priority**: P1
- **Effort**: XL (nhiều release)
- **Risk**: HIGH
- **Depends on**: 019, 020, 027
- **Category**: feature / data / infrastructure
- **Planned at**: 2026-08-05
- **State**: IN PROGRESS — RELEASES 028A–028C LOCAL VERIFIED
- **Canonical spec**: `docs/specs/seo-conversion-analytics.md`
- **Approved at**: 2026-08-05

## Task Documents

- `028a-instrument-public-seo-conversion-measurement.md`
- `028b-build-admin-seo-analytics-read-model.md`
- `028c-link-explicit-business-conversions.md`
- `028d-pilot-openseo-readonly-mcp.md`

Chỉ bắt đầu 028B sau khi release gate 028A pass; 028C sau 028B; 028D là operational release độc lập nhưng
không được kết nối MCP trước khi tool/cost boundary được kiểm chứng.

## Why This Matters

Admin hiện chỉ thấy `BlogPost.views`, trong khi số này là request counter và không trả lời người đọc đến từ
keyword nào, có quay lại hay có trở thành khách hàng. Feature này tạo read model SEO/conversion có privacy
boundary rõ, giúp ra quyết định content bằng outcome nhưng giữ public site fail-open khi provider analytics lỗi.

## Baseline Before Plan 028

- `client/index.html:5-11` tải GA4 và chỉ gọi `gtag('config')`; chưa có business event wrapper.
- `server/src/controllers/blog.controller.js:181-225` tăng `views` ở mỗi request detail.
- `client/src/sections/Contact.jsx:199-218` gửi Contact và chỉ xử lý success/error UI.
- `client/src/pages/RegisterPage/RegisterPage.jsx:141-197` tạo Booking với idempotency request ID.
- `server/src/models/ContactMessage.js:3-40` có PII + status nhưng chưa có attribution.
- `server/src/models/Booking.js:3-75` có lead state machine nhưng chưa có attribution.
- `server/src/models/F1Customer.js:53-69` có source/status nhưng không reference lead cụ thể.
- `server/src/models/Order.js:3-59` có user/status nhưng không reference lead/F1 cụ thể.
- `client/src/layouts/AdminLayout.jsx:31-82` có nav group Hoạt động; chưa có analytics entry.
- `client/src/App.jsx:295-329` lazy admin shell; chưa có route SEO analytics.
- `server/server.js:189-263` đăng ký API routes; chưa có `/api/admin/analytics`.
- `server/package.json` chưa khai báo Google reporting SDK trực tiếp.
- Máy local chưa có lệnh `docker`; OpenSEO local chưa thể chạy ở gate hiện tại.

## Implementation Status — 2026-08-06

- Release 028A đã hoàn tất measurement + session attribution fail-safe và local verified; live GA4
  DebugView vẫn là deploy gate riêng.
- Release 028B đã hoàn tất Google read-only adapters, cache-first aggregate/read model, Admin API và
  responsive `/admin/seo-analytics` dashboard; provider thiếu cấu hình trả `not_configured` thay vì làm
  hỏng startup/public runtime.
- Full 028B coverage pass 56 client files / 276 tests, 109 server files / 502 tests bằng single thread,
  4/4 Chromium Admin E2E, release build/lint/security/governance pass. Final tree sau 028C đã được recheck
  bằng Node 22.23.1; live Google provider và strict staging prerender vẫn là deploy gates riêng.
- Release 028C đã hoàn tất optional immutable origin cho F1/Order, admin selector, ObjectId-only funnel và
  fail-closed index verifier; documents cũ giữ `unattributed`, không backfill và không đổi financial semantics.
- Final 028C coverage trên Node 22.23.1 pass 57 client files / 279 tests, 112 server files / 520 tests bằng
  single thread, 14/14 relevant Chromium E2E, release compile/bundle budget/lint/UI/index dry-run và local
  physical index verification. Staging index apply và strict staging-backed prerender vẫn là deploy gates riêng.
- Release 028D vẫn chờ Docker/DataForSEO/paid-call approvals riêng; chưa cài, kết nối hoặc gọi dịch vụ.

## Impact Map

| Contract/change | Producers | Consumers/gates |
|---|---|---|
| GA4 event allowlist | analytics utility + public pages | GA4 report, PII regression tests |
| Session attribution | browser utility | Contact/Booking validation + models |
| SEO aggregate | Google provider + sync service | admin analytics API/UI |
| Sync state | sync service | stale/error banner, operations log |
| Origin references | admin conversion workflow | F1/Order funnel aggregation |
| Admin analytics API | route/controller/service | TanStack Query admin page |
| OpenSEO MCP | separate local service | owner/Codex only, cost guard |

## Architecture Decisions

1. Không tạo raw `PageView` collection; GA4/GSC giữ traffic detail, Mongo chỉ cache aggregate.
2. Không lưu raw IP/fingerprint; initial attribution tồn tại theo browser session và fail-safe.
3. `BlogPost.views` được giữ backward-compatible, chỉ đổi nhãn/diễn giải trong admin analytics.
4. Google integration nằm trong adapter/service riêng; controller không gọi SDK trực tiếp.
5. Aggregate upsert idempotent; unique key không chứa PII hoặc unbounded provider string.
6. Dashboard cache-first; provider down không được kéo theo public/contact/booking failure.
7. F1/Order chỉ attribution khi admin tạo explicit origin link; missing giữ `unattributed`.
8. OpenSEO/MCP là operational release độc lập; không import code hoặc DB vào core app.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Focused client | `cd client && npx vitest run <analytics test files>` | exit 0 |
| Focused server | `cd server && npx vitest run <analytics integration files>` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Full unit | `npm run test:unit` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 incl. sitemap/prerender/budget |
| Relevant E2E | `npx playwright test <admin analytics spec> --project=chromium` | exit 0 |
| Security | `npm run security:secrets && npm run security:data-boundaries` | exit 0 |
| Governance | `npm run agents:validate` | exit 0 |

## Scope

**Release A — Measurement foundation**:

- New client analytics/attribution utilities + unit tests.
- Blog engagement and main consultation CTA event wiring.
- Contact/Booking success events, attribution request fields and validation.
- Optional attribution subdocument in ContactMessage/Booking.

**Release B — Google read model và Admin dashboard**:

- Google read-only provider, sync/aggregation services, two new models and integration tests.
- Admin analytics routes/controller/service with bounded date/filter/pagination contracts.
- Lazy Admin page, service/query options, nav entry and UI/E2E states.
- Provider-disabled/stale cache behavior; manual admin sync only.

**Release C — Explicit business conversion**:

- Optional origin references in F1Customer/Order with server-side existence/authorization checks.
- Admin conversion actions/workflow and funnel aggregation tests.
- Idempotent index/migration dry-run; no historical attribution inference.

**Release D — OpenSEO/MCP pilot**:

- Separate local deployment/runbook, budget, keyword set, competitor set and tool inventory.
- Read-only/cached MCP allowlist or proxy decision after native tool audit.
- No HT customer data, no public exposure and no core schema coupling.

**Out of scope for Plan 028**:

- Raw IP/session replay/fingerprinting, customer-level browsing timeline or arbitrary event warehouse.
- Public analytics dashboard, trainer access or HT Assistant SEO tools.
- Auto-publish/content generation, automatic metadata mutation or backlink automation.
- Production cron/migration/deploy, Google credential creation and DataForSEO purchase without approval.
- Refactor Blog/Contact/Booking controllers unrelated to the new contract.

## Release A Steps — Measurement Foundation

### A1. Khóa analytics/PII contract bằng test đỏ

- Test `trackEvent` no-op khi `window.gtag` absent; chỉ chấp nhận event/parameter allowlist.
- Test attribution strips query/hash, external landing path, raw referrer path và oversized strings.
- Test engaged read cần active ≥30 giây + scroll ≥50%, fire đúng một lần và cleanup listener/timer.
- Test Contact/Booking payload không đổi business fields và attribution optional.

**Verify**: focused client tests fail đúng assertion trước implementation, sau đó exit 0.

### A2. Thêm client utilities fail-safe

- Tạo `client/src/utils/analytics.js`, `publicAttribution.js` và focused tests.
- Dùng `sessionStorage`; storage/gtag exception bị swallow có kiểm soát, không log PII.
- Event names: `blog_read_engaged`, `consultation_cta_click`, GA4 recommended `generate_lead`.

### A3. Wire blog, CTA và lead success

- BlogDetail mount tracker với canonical slug/category/language.
- CTA chỉ gửi placement enum; giữ nguyên label/navigation/visual behavior.
- Contact và Register chỉ fire `generate_lead` sau API success; retry/idempotent replay không double count.

### A4. Thêm optional attribution backend

- Reusable schema/helper normalize một shape, default `null`, `strict` allowlist và max length.
- Cập nhật Contact/Booking validators/controllers bằng explicit fields; không spread arbitrary body.
- Integration test old payload, valid attribution, malicious field/operator và oversized input.

**Release A gate**: public form/booking E2E + unit/lint/build pass; GA4 absence không đổi outcome.

## Release B Steps — Read Model và Dashboard

### B1. Khóa provider/aggregate contract

- Fixture GA4/GSC cho happy/empty/partial/timeout/malformed response.
- Test GSC page/query/date mapping và ghi chú top-row limitation.
- Test aggregate unique key, idempotent replay, bounded rows và stale fallback.

### B2. Thêm Google adapter và sync service

- Thêm Google reporting dependency trực tiếp sau khi plan được duyệt; không import transitive package.
- Service account read-only từ env; timeout/retry/row cap; safeLog chỉ provider/status/duration.
- Manual sync có per-provider lock, idempotent upsert và sync state sanitized.

### B3. Tạo admin read API

- Route `/api/admin/analytics` dùng `protect` + `requireRoles('admin')` cho mọi read.
- Manual sync thêm CSRF + rate limit; date/filter/sort/pagination validation fail closed.
- DTO chỉ trả aggregate, sync health và canonical content metadata; không trả PII/provider raw response.

### B4. Xây Product UI

- Lazy route `/admin/seo-analytics`, nav dưới Hoạt động và service/query keys theo convention.
- Tách page/table/detail/funnel components để mỗi file mới dưới 300 dòng.
- Loading/empty/not-configured/partial/stale/error/retry, desktop/mobile, keyboard/focus và WCAG AA.
- Không dùng nested cards, gradient text, glassmorphism hoặc animation trang trí.

**Release B gate**: server RBAC/integration + client UI/unit + Chromium admin E2E + build pass.

## Release C Steps — Explicit Conversion

### C1. Chốt origin semantics trước schema

- `originBookingId`/`originContactMessageId` optional; không cho đồng thời hai nguồn.
- Reference phải tồn tại và actor phải có quyền; transition/action phải idempotent/audited.
- Old F1/Order không origin vẫn valid và dashboard ghi `unattributed`.

### C2. Thêm schema, validation và workflow

- Thêm optional fields/index có select/projection đúng phạm vi.
- Cập nhật create F1/Order bằng allowlist; không sửa financial amount/status semantics.
- Thêm action admin explicit từ lead thay vì auto-match PII.

### C3. Migration/dry-run và funnel

- Script chỉ tạo/verify indexes và report counts; không backfill source.
- Dashboard chỉ tính assessment/customer khi origin explicit; tests chứng minh không false attribution.

**Release C gate**: schema compatibility, IDOR/RBAC, audit, order regression và dry-run local pass.

## Release D Steps — OpenSEO/MCP

### D1. Operational preflight

- Xác nhận Docker Desktop, pin OpenSEO image digest, DataForSEO budget/credential và localhost-only port.
- Chọn 30–50 Vietnamese mobile keywords, 3–5 competitors; defer backlinks paid commitment.

### D2. Pilot và tool audit

- Chạy 30 ngày; ghi keyword/rank/audit outcomes và chi phí thực.
- Inventory native MCP tools: cached read, paid/live side effect, mutation/credential access.

### D3. Read-only MCP gate

- Chỉ kết nối owner/Codex sau khi cached-read allowlist được chứng minh.
- Nếu native scope không đủ, giữ MCP disabled hoặc tạo bounded proxy; mọi paid call cần approval/audit.

## Test Plan

- Client unit: analytics allowlist/no-op, session attribution sanitization, engaged threshold/dedupe/cleanup.
- Server unit: Google mapping, external error classification, aggregate key/upsert, stale fallback.
- Server integration: Contact/Booking backward compatibility; analytics 401/403; filters; manual sync CSRF/rate/lock.
- Schema integration: old documents, optional origin, invalid/missing/cross-origin IDs và no-PII DTO.
- UI tests: loading, empty, not configured, partial, stale, error/retry, pagination/filter and accessible labels.
- E2E: admin route protected, cached dashboard render, provider failure does not break public lead journey.
- Regression: Contact, Booking, F1 authorization, Order lifecycle and public Blog.

## Done Criteria

- [ ] Canonical spec acceptance criteria pass; no raw IP/PII in analytics storage or provider payload.
- [x] Public blog/contact/booking behavior survives analytics unavailable/storage exception/provider timeout.
- [x] GA4/GSC aggregate and DB conversion sources are visibly distinguished; legacy views not mislabeled.
- [x] Admin-only API/UI supports bounded filters and all required product states.
- [x] Existing documents stay valid; no historical source is guessed; migration remains dry-run until approval.
- [ ] OpenSEO/MCP remains isolated, localhost/auth-bound and cost-controlled.
- [x] Focused/full tests, lint/build/E2E/security/governance gates pass for Releases 028A–028C with evidence recorded in their task documents.
- [x] No debug logs, secrets, unrelated refactor, commit, push, deploy or real-data mutation in Releases 028A–028C.

## STOP Conditions

- Product requires raw IP, fingerprint or customer browsing timeline contrary to approved spec.
- GA/GSC credential would need to be sent to client, printed, committed or broadened beyond read-only.
- Two sources claim canonical conversion without an explicit reference and cannot be reconciled safely.
- Schema requires required field/type change/backfill or financial status semantics beyond this plan.
- Provider sync cannot be made idempotent/cache-first or can block public request paths.
- Native OpenSEO MCP cannot enforce boundaries and no bounded proxy/manual UI fallback is acceptable.
- Same verification fails three rounds after evidence-based fixes, or implementation needs production mutation.

## Maintenance Notes

- Adding a new event requires updating allowlist, PII test and metric source table together.
- Adding a provider requires a separate adapter; controller and React page never call external SDK directly.
- Never compare/merge GA users with GSC clicks as if they were the same unit; labels retain source semantics.
- Long-lived journey IDs, consent manager and cross-session first-party attribution need a separate privacy spec.
- Scheduled production sync and credential rotation belong in an operations runbook after local/staging proof.
