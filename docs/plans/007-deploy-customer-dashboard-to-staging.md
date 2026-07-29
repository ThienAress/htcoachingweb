# Plan 007: Deploy Customer Dashboard lên staging và xác minh từ xa

> **Hướng dẫn thực thi**: Chạy tuần tự mọi gate, chỉ commit/push khi `ship` kết luận GO.
> Không chạy migration/seed/cleanup và không ghi production trong plan này.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: 003H, 004, 005, 006
- **Category**: release | staging | verification
- **Planned at**: 2026-07-29
- **Status**: DEPLOYED / VERIFIED ON STAGING

## Why This Matters

Customer Dashboard và các thay đổi liên đới đã hoàn tất local nhưng staging vẫn đang phục vụ SHA cũ.
Release này cần đưa cùng một candidate lên Netlify và Render, giữ database staging cô lập, rồi chứng minh
frontend, API, auth boundary và Dashboard hoạt động trên URL staging thật.

## Current State

- Branch deploy canonical là `staging`; runtime candidate đã deploy là `040f36a`.
- Frontend staging: `https://staging--htcoachingweb.netlify.app`.
- API staging: `https://htcoachingweb-staging.onrender.com`.
- Push `staging` kích hoạt GitHub CI, Netlify branch deploy, Render auto-deploy và workflow
  `Staging Health and Security`.
- Candidate gồm Today Dashboard, Customer Dashboard IA, notification/progress flows, F1 entitlement fix,
  blog discovery và việc tổ chức lại docs; `.vscode/` và artifact local không thuộc release.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Full E2E | `npm run test:e2e` | 61/61 pass |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | build + prerender + budget pass |
| Client tests | `npm run test:unit:client` | all pass |
| Server tests | `npm run test:unit:server` | all pass |
| Security | `npm run security:secrets` và `npm run security:data-boundaries` | zero findings |
| Remote health | `node scripts/staging-health.mjs` với staging guard | 7/7 pass |

## Scope

**In scope**:

- Toàn bộ tracked/untracked source và docs thuộc các Plan 003A–006 trong working tree hiện tại.
- `.github/workflows/ci.yml`, `.github/workflows/staging-security.yml` chỉ được đọc để xác minh topology.
- Cập nhật plan/index/report staging bằng kết quả thực tế.

**Out of scope**:

- `.vscode/`, `playwright-report/`, `test-results/`, sitemap do local build sinh lại.
- Migration, seed, cleanup hoặc mutation dữ liệu staging.
- Merge `main`, production deploy, production database hoặc production secrets.

## Steps

### Step 1: Chạy pre-deploy pipeline

- Audit quick các hotspot và security-critical diff.
- Chạy AI check, QA, UI check, SEO check, skill-drift và hard `ship` gate.
- Fix mọi BLOCK/HIGH rồi re-check trước khi tiếp tục.

**Verify**: tất cả seven gates PASS hoặc PASS WITH non-blocking drift warning; `ship` = GO.

### Step 2: Tạo release candidate trên branch staging

- Review staged file list; loại `.vscode/` và artifact generated/local.
- Commit candidate bằng một release commit rõ nghĩa và push `origin/staging`.

**Verify**: remote `origin/staging` trỏ đúng release SHA vừa commit.

### Step 3: Chờ deploy và CI cùng SHA

- Theo dõi GitHub CI và Staging Health/Security workflow.
- Chờ Netlify branch deploy và Render staging phục vụ candidate mới.

**Verify**: required workflows xanh; frontend/API staging reachable và không lệch candidate.

### Step 4: Smoke staging và ghi evidence

- Chạy read-only staging health/security smoke.
- Kiểm tra anonymous/private route boundary và Dashboard UI trên staging.
- Ghi SHA, kết quả gate, URL và blocker vào plan/report staging.

**Verify**: staging health 7/7, security smoke pass, Customer Dashboard reachable sau auth.

## Done Criteria

- [x] Pre-deploy seven gates hoàn tất và `ship` = GO.
- [x] Release commit chỉ chứa file thuộc phạm vi, không có secret/artifact local.
- [x] `origin/staging`, Render staging và Netlify branch deploy cùng candidate.
- [x] GitHub CI và Staging Health/Security pass.
- [x] Remote health/security smoke pass và production không bị ghi.
- [x] Plan 007 cùng index được cập nhật bằng evidence thực tế.

## Local Gate Results

- Audit quick: PASS, không có finding BLOCK/HIGH.
- AI check: PASS, 27/27 files và 11/11 tools hợp lệ.
- QA: strict staging-backed build 25/25 prerender; client 167/167; server 329/329;
  Chromium E2E 61/61; client lint PASS.
- UI check: PASS; accessibility/responsive regression được bảo vệ bởi E2E.
- SEO check: PASS; private Dashboard routes noindex và không vào sitemap/prerender.
- Skill drift: hai warning không chặn deploy về test-count docs và backup-file reference cũ.
- Ship: GO; dependency audits, runtime logging, commercial contracts, secret scan,
  repository data boundaries, ops tests và `git diff --check` đều PASS.
- File-size exception: hai integration suites giữ lifecycle scenarios trong cùng fixture;
  `coachingComment.service.js` 305 dòng là transaction orchestrator đã tách helper modules.

## Remote Deployment Results

- Runtime release commit: `040f36a2909d16a57373b3f861e04ba6782b08e8` trên `origin/staging`.
- Netlify branch deploy `6a69bff8cd6d7200083cc09d` ở trạng thái `ready`, `commit_ref=040f36a`.
- GitHub CI run `30437469121`: client, server, E2E và secrets đều `success`.
- Staging Health and Security run `30437470297`: `success` trên đúng head SHA `040f36a`.
- Direct staging health tại `2026-07-29T08:58:55.499Z`: 7/7 pass.
- Direct staging security smoke: 7/7 pass.
- Render readiness trả 200; hai route mới `/api/today-dashboard/day/:dateKey` và
  `/api/notifications` trả 401 cho anonymous, chứng minh backend candidate đã live và giữ auth boundary.
- Browser smoke mở `/dashboard` trên Netlify staging, redirect đúng sang `/login`, không có console error.
- Không chạy migration, seed, cleanup hoặc staging write; production không bị thay đổi.

## STOP Conditions

- Bất kỳ build/test/security gate nào FAIL sau tối đa ba vòng sửa có căn cứ.
- Candidate chứa secret, private runtime data, `.vscode/` hoặc artifact generated không chủ đích.
- Render/Netlify target không thể chứng minh là staging hoặc yêu cầu migration/write không được duyệt.
- Remote staging phục vụ SHA khác release candidate sau khi thời gian deploy hợp lý đã hết.
- Bất kỳ thao tác nào yêu cầu merge/deploy production.

## Maintenance Notes

- Staging release dùng push branch, không cần chạy migration cho thay đổi này.
- Luôn giữ compatibility redirect `/today` và `/progress` cho notification/bookmark cũ.
- Production rollout cần một yêu cầu và pre-deploy/observation window riêng.
