# Plan 035: Xây dựng Upstream Skill Radar và trang Admin Radar công nghệ

> **Hướng dẫn thực thi**: Follow từng step và chạy verification tương ứng trước khi chuyển tiếp. Giữ mọi
> upstream change ở chế độ evidence-only; không cài/copy skill hoặc sửa local canonical source khi chưa có
> review riêng.
>
> **Drift check**: Trước khi implement, kiểm tra lại `git status`, Plan 030, `$goad`, Admin navigation,
> route registration và skills.sh API/audit contract. Nếu các contract đã đổi thì cập nhật plan/spec trước.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 017, 030
- **Category**: dx
- **Planned at**: 2026-08-08
- **State**: IMPLEMENTED / LOCAL VERIFIED — AUTHENTICATED VISUAL PENDING

## Why This Matters

Kho Desktop hiện là snapshot lớn không có Git provenance, còn `$goad` chỉ xử lý drift giữa local skill và
codebase. Plan này bổ sung external upstream radar có nguồn, hash, lịch review và approval gate; đồng thời giúp
admin quan sát tình trạng học hỏi công nghệ từ xa mà không đưa live third-party dependency vào product runtime.

## Current State

- `.agents/skills/` có các workflow project-specific và validator tại
  `.agents/scripts/validate-agent-system.mjs`.
- `.agents/skills/goad/SKILL.md` tạo audit draft cho internal drift và chờ user duyệt trước khi sửa.
- `docs/specs/agent-workflow-modernization.md` cấm import/cài nguyên bộ upstream skill.
- `client/src/layouts/AdminLayout.jsx` nhóm các trang vận hành trong sidebar `Hoạt động`.
- `client/src/App.jsx` lazy-load page Admin; route mới phải theo cùng pattern.
- `server/src/routes/serviceAccessPolicy.routes.js` và các layer liên quan là exemplar cho admin-only read model.
- Chưa có watchlist có version, provenance, monthly scanner, upstream decision log hoặc Admin radar.
- Spec canonical: `docs/specs/upstream-skill-radar.md`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Agent validation | `npm run agents:validate` | exit 0, skill catalog/map hợp lệ |
| Radar tests | `node --test .agents/scripts/skill-radar.test.mjs` | exit 0, fixtures pass |
| Server focused tests | `npm run test:unit:server -- --run src/routes/__tests__/skillRadar.routes.integration.test.js` | exit 0 |
| Client focused tests | `npm run test:unit:client -- --run src/pages/admin/skill-radar/__tests__/skillRadarPresentation.test.js` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0 |
| Security | `npm run security:secrets` | exit 0 |
| Data boundary | `npm run security:data-boundaries` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

Nếu Vitest root forwarding không nhận `--run`, chạy trực tiếp trong package tương ứng bằng
`cd client && npx vitest run <file>` hoặc `cd server && npx vitest run <file>` và ghi evidence thật vào plan.

## Scope

**In scope**:

- `docs/specs/upstream-skill-radar.md`, `docs/plans/035-build-upstream-skill-radar.md` và indexes.
- `.agents/upstream-skills/watchlist.json`, `.agents/upstream-skills/snapshot.json`.
- `.agents/scripts/skill-radar.mjs`, test/fixtures liên quan và npm scripts.
- `.agents/skills/skill-radar/**`, workflow map và agent validator nếu cần.
- `.github/workflows/skill-radar-monthly.yml` cho scan metadata không phá hoại.
- `server/src/{services,controllers,routes}/skillRadar.*`, route registration và focused tests.
- `client/src/services/skillRadar.service.js`, query options/key, Admin page/presentation/tests.
- `client/src/layouts/AdminLayout.jsx`, `client/src/App.jsx`.

**Out of scope**:

- Mongoose schema/migration, production write endpoint hoặc Admin mutation UI.
- Auto-install/auto-adopt upstream skill; sửa `AGENTS.md` hoặc `.agents/rules/`.
- Commit/push/deploy và tạo credentials/OIDC token trong lần implementation local.
- Refactor navigation, API client hoặc Admin pages không liên quan.

## Steps

### Step 1: Materialize provenance và lifecycle contract

Tạo `watchlist.json` với đúng 20 skill từ spec và `snapshot.json` có schema/version rõ. Xác minh từng skills.sh
URL, GitHub repo, source path, license và local targets. Mở rộng validator để bắt duplicate id, URL không HTTPS,
lifecycle/drift không hợp lệ, missing provenance và local target không tồn tại.

**Behavior**: Maintainer có một watchlist machine-readable, versioned và validator fail sớm khi metadata sai.

**Blast radius**: `.agents/upstream-skills/**`, validator/tests, package scripts.

**Depends on**: none.

**Verify**: `npm run agents:validate`; mutation fixture với duplicate id/missing URL phải fail có message cụ thể.

### Step 2: Tạo `$skill-radar` và decision workflow

Khởi tạo skill bằng generator chính thức, giữ `SKILL.md` ngắn và đưa scoring/lifecycle details vào một reference
trực tiếp nếu cần. Skill phải đọc manifest/snapshot, kiểm tra skills.sh Trending/Hot/Official/Audits, tạo report
`docs/audits/YYYY-MM-skill-radar.md` và phân loại `adopt/adapt/reject/defer`. Cập nhật workflow map; invocation
đặt user-controlled nếu workflow có thể tạo audit/update snapshot.

**Behavior**: User gọi `$skill-radar` nhận báo cáo evidence-first, không có local skill/rule bị ghi đè.

**Blast radius**: `.agents/skills/skill-radar/**`, workflow map, validator.

**Depends on**: Step 1.

**Verify**: skill quick validation + `npm run agents:validate`; forward-test bằng fixture có một hash đổi, một repo
unreachable và một candidate duplicate.

### Step 3: Thêm scanner deterministic và lịch tháng

Tạo scanner Node đọc watchlist, chỉ gọi domain allowlisted, dùng timeout/retry/response-size cap và hỗ trợ
`GITHUB_TOKEN` tùy chọn mà không log token. Scanner cập nhật snapshot/report artifact, không sửa local skills. Thêm
workflow chạy `0 2 1 * *` (09:00 ngày 1 theo Asia/Saigon) và `workflow_dispatch`; job failure chỉ báo radar,
không chặn CI/release chính. Không auto-commit/merge; artifact là input cho review `$skill-radar`.

**Behavior**: Known-source drift được kiểm tra hàng tháng hoặc thủ công ngay cả khi Codex Desktop không mở.

**Blast radius**: `.agents/scripts/skill-radar.mjs`, test fixtures, `.github/workflows/skill-radar-monthly.yml`.

**Depends on**: Step 1.

**Verify**: `node --test .agents/scripts/skill-radar.test.mjs`; mock timeout, 404, rate limit, oversized response,
unchanged/changed hash; validate workflow YAML structure.

### Step 4: Cung cấp Admin read model an toàn

Thêm service đọc manifest/snapshot bằng path dựa trên `import.meta.url`, validate/fallback an toàn và chỉ trả
allowlisted fields. Controller/route theo MVC, `protect + requireRoles("admin")`, response contract
`{ success: true, data: { summary, schedule, items } }`; lỗi dùng `safeLog` và không lộ filesystem/raw content.

**Behavior**: Admin đọc được radar snapshot; User/Trainer/Guest bị từ chối ở backend.

**Blast radius**: server service/controller/route, `server/server.js`, integration tests.

**Depends on**: Step 1.

**Verify**: focused server test cover 200 admin, 401 guest, 403 non-admin, malformed/missing snapshot fallback và
response không chứa raw skill content/absolute path.

### Step 5: Xây trang Admin “Radar công nghệ”

Thêm lazy route `/admin/skill-radar`, menu `Radar công nghệ` trong nhóm `Hoạt động`, service layer và TanStack
Query options/key. Trang Product UI có summary strip, search/filter, responsive table, badges lifecycle/drift,
ngày quét **dự kiến** dạng `DD/MM/YYYY`, external links an toàn và detail drawer cho hash/license/audit/decision history.
Thiết kế đầy đủ loading/empty/error/retry, keyboard focus, aria labels và mobile cards hoặc horizontal strategy.

**Behavior**: Admin xem, tìm và lọc 20 nguồn; biết nguồn nào đổi, đến hạn, dormant và ngày scan kế tiếp.

**Blast radius**: App lazy route, Admin sidebar, client service/query/page/presentation/tests.

**Depends on**: Step 4.

**Verify**: presentation tests cho ngày dự kiến/timezone/status mapping/filter; client focused tests, lint và build;
manual 1440px/768px/390px kiểm tra loading/empty/error/detail drawer.

### Step 6: Áp dụng candidate và retirement policy

Trong skill/report, candidate mới từ skills.sh chỉ được đề xuất, không auto-add. Implement rule:
`candidate → active/watch`, `active → watch → dormant`, và `archived/rejected` giữ tombstone. Không dùng số tháng
không commit làm điều kiện duy nhất; yêu cầu relevance, local usage, maintainer/security/license evidence.

**Behavior**: Nguồn im lặng không bị xóa nhầm; nguồn bỏ hoang/nguy hiểm không tiếp tục tiêu tốn scan hàng tháng;
repo mới không lọt vào canonical watchlist nếu chưa review.

**Blast radius**: radar skill/reference, scanner lifecycle functions, fixtures và admin status presentation.

**Depends on**: Steps 2, 3, 5.

**Verify**: table-driven tests cho mọi lifecycle transition và duplicate/superseded source; manual report review.

### Step 7: Cross-layer review và release evidence

Chạy review theo Standards, Spec/Contract, Security/Operations; xác minh không có schema/mutation/live upstream
request trong Admin runtime. Chạy toàn bộ gate tương xứng và cập nhật plan/index bằng evidence thực tế. Chỉ sau
local verification mới đề xuất staging; không tự deploy.

**Behavior**: Feature sẵn sàng staging, có rollback đơn giản bằng cách bỏ route/menu/workflow mà không ảnh hưởng
dữ liệu người dùng.

**Blast radius**: toàn bộ in-scope diff; không mở rộng refactor.

**Depends on**: Steps 1–6.

**Verify**: agent validation, radar tests, focused/full tests theo rủi ro, client lint/build, secret scan,
data-boundary scan và `git diff --check` đều có kết quả được ghi lại.

## Test Plan

- Manifest validator: schema, duplicate, URL/source path, lifecycle/drift, local target, schedule.
- Scanner: clean drift, changed hash, timeout, retryable rate limit, 404/archive, audit warning và output sanitize.
- API: auth/role, summary/schedule contract, malformed/missing data fallback, no raw content/path.
- Client presentation: timezone/ngày dự kiến, filter/search, badge mappings, missing dates và external links.
- UI manual: loading, empty, error/retry, drawer, focus order, contrast và responsive states.
- Workflow: scheduled/manual trigger, least-privilege permissions, artifact retention và no auto-commit.

## Done Criteria

- [x] Đúng 20 watchlist entries có provenance, local target và lifecycle.
- [x] `$skill-radar` tạo audit draft nhưng không sửa local canonical skill/rule.
- [x] Monthly/manual scanner phát hiện drift với failure isolation và không log secret.
- [x] Admin-only API trả read model sanitize; unauthorized roles bị chặn.
- [ ] Admin `Radar công nghệ` đã có summary, filter, statuses, links, ngày quét dự kiến và responsive code; visual trong phiên
  đăng nhập Admin chưa chạy vì browser hiện tại không có admin session.
- [x] Candidate/dormant/archive policy có guard/test và không auto-delete record.
- [x] Không thêm schema/migration/dependency nếu chưa được nêu và review lại.
- [x] Agent validation, focused/full tests phù hợp, client lint/compile, security scans và diff hygiene pass; blocker
  của full server rerun và authenticated visual được ghi thật bên dưới.
- [x] `docs/plans/README.md` được cập nhật status/evidence cuối.

## Implementation Evidence

- Lần chạy metadata chính thức đầu tiên: scan thành công 20/20 nguồn, `failures: 0`, `content-hash drift: 0` và
  `repository archived: 0`; snapshot sinh lúc `2026-08-08T12:09:34.043Z` (19:09 Việt Nam), lịch kế tiếp
  `2026-09-01T02:00:00.000Z` (09:00 Việt Nam). Đây là hash baseline, không phải bằng chứng local skill đã ngang
  bằng upstream.
- Baseline content comparison sau đó đã đọc 20 upstream và đối chiếu local targets: 13 `adapt`, 7 `defer`, 0
  `adopt/reject`; report nằm tại `docs/audits/2026-08-skill-radar.md` và implementation follow-up là Plan 036.
- Metadata refresh lúc `2026-08-08T12:26:53.850Z` kiểm tra đầy đủ 19 nguồn; GitHub API trả 403 cho `seo-audit` nhưng
  raw source vẫn HTTP 200 và hash khớp. Gap `403 → unreachable` được ghi vào Plan 036, không báo repo archived.
- Discovery review đã kiểm tra bốn khu vực `Trending`, `Hot`, `Official` và `Audits` của skills.sh. Năm candidate
  được triage; không candidate nào được tự thêm vào watchlist và không local skill/rule nào bị sửa trong baseline audit.
- `npm run test:agents:radar`: PASS, 11/11 tests; cover validation, changed/clean hash, retry, timeout, 404,
  response-size cap, cadence `watch/dormant` và tombstone `archived/rejected`.
- Focused server route/read model: PASS, 5/5 tests; cover Admin 200, User 403, Guest 401, missing snapshot fallback
  và allowlist report path tương đối.
- Full client: PASS, 66/66 files, 310/310 tests. `npm run lint --prefix client`: PASS.
- Current client compile: `cd client && npx vite build`: PASS, 2.842 modules transformed; chunk
  `SkillRadarPage` được sinh thành công. Release build lifecycle trước patch focus-only cũng đã PASS với sitemap,
  prerender 9/9 và bundle budget; `client/public/sitemap.xml` được giữ nguyên.
- Full server checkpoint trước thay đổi test-only: PASS, 121/121 files, 566/566 tests bằng single-thread runner.
  Rerun cuối bị treo ở runner và hết timeout mà không in test failure; focused route hiện tại vẫn PASS 5/5, vì vậy
  không dùng rerun đó làm release evidence.
- `npm run agents:validate`: PASS, 28/28 skills, 20/20 upstream entries, 0 warnings.
- `npm run security:secrets` và `npm run security:data-boundaries`: PASS, 0 violations.
- Node syntax checks và `git diff --check`: PASS. Workflow YAML đã parse thành công tại implementation checkpoint;
  lần kiểm lại sau không chạy được vì workspace không có package `yaml`, file workflow không thay đổi sau checkpoint.
- Browser unauthenticated đã xác nhận `/admin/skill-radar` redirect về Login. Visual 1440/768/390 và focus flow trong
  phiên Admin: PENDING vì không có admin session trong in-app browser.
- Official `quick_validate.py`: BLOCKED do Python runtime thiếu PyYAML; validator canonical của project đã PASS.
- Hai file registry/generated data vượt 300 dòng (`watchlist.json`, `snapshot.json`) vì chứa đủ 20 records;
  toàn bộ file code mới đều dưới 300 dòng.

## STOP Conditions

- skills.sh/GitHub contract yêu cầu credential mới hoặc điều khoản không phù hợp với scheduled environment.
- Muốn hiển thị live data buộc production request phụ thuộc upstream hoặc phải lưu raw third-party content.
- Cần production mutation/schema để đạt release đầu.
- Upstream URL/source path/owner của bất kỳ entry nào không xác minh được.
- Workflow cần quyền GitHub rộng hơn `contents: read` và artifact write mặc định.
- Cùng verification fail ba vòng sau các sửa có evidence.

## Maintenance Notes

- Ngày hiển thị là lịch chạy dự kiến; GitHub scheduled job có thể bị trễ nên UI phải giữ nhãn `Dự kiến`.
- Popularity là discovery signal, không phải acceptance gate.
- Stable skill ít commit vẫn có thể giữ `active`; retirement cần nhiều evidence.
- Khi local skill được cập nhật từ finding, mở audit `$goad` riêng để kiểm tra internal drift và approval.
- Nếu sau này cần sửa watchlist từ Admin, thiết kế mutation/audit/versioning ở plan riêng; không mở rộng release này.
