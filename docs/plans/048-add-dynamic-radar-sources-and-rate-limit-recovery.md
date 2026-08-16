# Plan 048: Thêm nguồn Radar động và làm rõ phục hồi GitHub rate limit

> Thực thi theo từng bước, giữ nguyên thay đổi ngoài Radar trong working tree và không chạy migration/production write.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 035, 036
- **Category**: feature
- **Planned at**: 2026-08-12
- **State**: COMPLETE — local implementation/review/QA finished; authenticated visual and production GitHub verification remain pending

## Why This Matters

Radar hiện chỉ đọc 23 nguồn từ JSON versioned nên Admin không thể dán GitHub URL và lưu nguồn bền vững. Badge
`Giới hạn GitHub API` giữ đúng last-known-good data nhưng thiếu retry metadata, dễ bị hiểu là mất theo dõi. Plan này thêm
luồng preview → xác nhận → lưu MongoDB, hợp nhất nguồn động vào bảng và harden rate-limit recovery mà không auto-install.

## Current State

- `server/src/services/skillRadar.service.js` đọc đồng bộ watchlist/snapshot file và tạo read model.
- `server/src/routes/skillRadar.routes.js` chỉ có GET Admin-only.
- `client/src/pages/admin/SkillRadarPage.jsx` có bảng sáu nhóm cột nhưng không có mutation/form.
- `.agents/scripts/skill-radar.mjs` phân loại 403/429 là `rate_limited` và giữ provenance, chưa lưu reset/retry time.
- `.github/workflows/skill-radar-monthly.yml` đã truyền scoped `github.token`; 403 của `seo-audit` ngày 08/08/2026 là
  lỗi quota/fetch, raw source vẫn 200 và hash không đổi.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused server | `cd server && npx vitest run src/routes/__tests__/skillRadar.routes.integration.test.js src/services/__tests__/skillRadarGithub.service.test.js` | exit 0 |
| Focused client | `cd client && npx vitest run src/pages/admin/skill-radar/__tests__` | exit 0 |
| Scanner | `npm run test:agents:radar` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 hoặc báo rõ environment blocker |
| Agent validation | `npm run agents:validate` | exit 0 |

## Scope

**In scope**: Radar spec/plan; `SkillRadarSource` model; append-only AuditLog action/target key; Radar
route/controller/services/validation/limiter/tests; scanner retry metadata/tests; Radar client
service/query/form/page/table/detail/presentation/tests; server background-job registration và production env readiness.

**Out of scope**: cài/chạy upstream code; sửa/xóa nguồn đã lưu; tự sửa local skills; chạy migration/backfill; deploy/commit/push;
mọi file TDEE, Exercise, Progress, Chat và sitemap đang dirty.

## Steps

### Step 1: Preview GitHub repository an toàn qua API Admin

**Status**: COMPLETE

Thêm URL canonicalizer/SSRF guard, GitHub metadata adapter có timeout/size cap/token tùy chọn và mapper deterministic cho
source type/domain/local targets. POST preview có auth/role/CSRF/validation/limiter và trả rate-limit retry contract.

**Behavior**: TencentDB URL có tracking query trả canonical repository preview; non-GitHub URL bị 400; GitHub quota bị 429/503
có `retryAt` và không bị mô tả là repo chết.

**Verify**: focused service + route tests pass.

### Step 2: Xác nhận và lưu nguồn động bền vững

**Status**: COMPLETE

Thêm `SkillRadarSource` với unique repository key/defaults an toàn; POST source chỉ nhận allowlisted editable fields, phân
tích GitHub lại server-side, chống duplicate với cả baseline và DB, lưu `createdBy` + audit trail, rồi GET hợp nhất static +
dynamic read model.

**Behavior**: Admin lưu preview đã chỉnh và GET ngay sau đó có 24 nguồn; user/unauth/CSRF/duplicate/invalid payload bị chặn.

**Verify**: integration tests pass; index scheduler có preflight/apply target-locked nhưng không chạy ghi vào DB trong task này.

### Step 3: Thêm UI phân tích/xác nhận và cập nhật bảng tức thì

**Status**: COMPLETE

Thêm form Product/Operate trước bộ lọc, đủ loading/error/rate-limit/duplicate/success và các field tương ứng cột. Dùng service
layer + TanStack mutation; sau save cập nhật/invalidate `adminQueryKeys.skillRadar` để hàng mới xuất hiện không reload.

**Behavior**: keyboard-accessible flow URL → preview → chỉnh → lưu; mobile xếp dọc, desktop hai vùng rõ; GitHub-only sources
không render link skills.sh giả.

**Verify**: focused client tests, lint và build.

### Step 4: Làm rõ scanner rate-limit và retry

**Status**: COMPLETE

Parse `X-RateLimit-Reset`/`Retry-After`, carry last-known-good, lưu `rateLimitRetryAt`, dừng request mới khi batch quota cạn và
hiển thị “Thử lại …” ở row/drawer. Snapshot lịch sử thiếu field vẫn tương thích.

**Behavior**: `seo-audit` giữ hash/commit/decision; badge chỉ báo metadata đang chậm và có thời điểm retry.

**Verify**: `npm run test:agents:radar` + focused API/presentation tests.

### Step 5: Re-trace và gate bàn giao

**Status**: COMPLETE WITH ENVIRONMENT CAVEATS

Rà API/schema/auth/CSRF/UI states, `git diff --check`, agent validator, focused/full relevant tests, lint/build, secret/data
boundary scan. Cập nhật evidence và trạng thái plan theo kết quả thật.

## Test Plan

- Backend: canonical URL, repository/skill classifier, bounded GitHub response, rate limit headers, duplicate static/dynamic,
  Admin/role/CSRF, persistence/read merge and sanitized response.
- Frontend: preview field population, editable local targets, save mutation/cache update, rate-limit retry copy, conditional links.
- Scanner: 403/429 preserve provenance + retryAt, stop batch after exhaustion, 404 remains unreachable.

## Done Criteria

- [x] TencentDB example is deterministically previewed as a repository and can be persisted by Admin.
- [x] All requested columns are visible/editable in add-source preview and the saved row is inserted into cache immediately.
- [x] Dynamic sources are MongoDB-owned while the static 23-source baseline remains Git-owned and compatible.
- [x] `seo-audit` rate limit has retry guidance and never loses last-known-good metadata.
- [x] Focused/full tests, lint/compile and security gates are reported truthfully.
- [x] No unrelated dirty file was overwritten.

## Final evidence — 2026-08-13

- Baseline: branch `staging`, HEAD `5b9e6c696bf8d5a8dfe8ea03f68c2d908399d1c8`; working tree remains dirty with separate TDEE, Exercise, Progress, Chat and sitemap work that was preserved.
- Focused Radar: backend `47/47`, frontend `10/10`, repo-native scanner `17/17`, all exit `0`.
- Full regression: client `88` files / `440/440`; server `145` files / `739/739`, both exit `0`. Server emitted existing Mongoose deprecation messages and a post-result process-cleanup warning without failed assertions.
- Client ESLint: exit `0`.
- Final Vite compile-only: `2,863` modules transformed, exit `0`; existing large-chunk warnings remain non-blocking.
- Release lifecycle: `BLOCKED` at public prerender in the local sandbox after Vite compilation because the external API/network environment was unavailable. This is not release evidence and the Admin-only Radar route is not a public prerender route.
- Security/governance: secret scan pass, repository data-boundary scan pass with `0` violations, agent instruction validation pass and scoped `git diff --check` pass.
- Independent review: one MED lifecycle finding was fixed so an unreviewed dynamic source stays `review_due`; re-review verdict `PASS WITH RESIDUAL GAPS`.
- UI/E2E: static responsive/accessibility review and focused presentation tests pass. Authenticated browser smoke is `SKIP` because no signed-in local Admin session/test environment was available.
- Index readiness: `skill_radar_refresh_due` có migration preflight/apply target-locked và unit test idempotency; chưa chạy
  apply vào staging/production trong task implementation.
- External verification: no live GitHub call, production MongoDB write, migration apply, seed, deploy, commit or push was performed.

## STOP Conditions

- GitHub metadata requires executing/cloning third-party code.
- Implementation would write repository files at runtime or need production migration/backfill.
- Same verification fails three rounds after evidence-based fixes.
- Required file overlaps a concurrent uncommitted Radar edit not owned by this task.

## Maintenance Notes

Dynamic sources are MongoDB-owned; static sources remain Git-owned. A future release may add edit/archive and a database-driven
scheduled scanner, but must retain Admin approval, SSRF boundaries and last-known-good behavior.
