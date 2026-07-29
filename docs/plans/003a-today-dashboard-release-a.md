# Plan 003A: Ship Today Dashboard read-only từ nguồn canonical hiện có

> **Hướng dẫn thực thi**: Release này chỉ compose dữ liệu đang tồn tại. Không tạo
> collection, không sửa lịch/coaching/workout và không thêm quick-log mutation.
> Chạy từng verification gate trước khi chuyển bước.
>
> **Drift check**: Nếu schema/status hoặc ownership ở các file Current State không
> còn khớp, STOP và cập nhật plan 003/spec trước khi code tiếp.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — private schedule/coaching data, IDOR và multi-source contract
- **Depends on**: Plan 003; Plans 001–002 đã verified
- **Category**: feature | security | tests | UX
- **Planned at**: 2026-07-28
- **Status**: IMPLEMENTED / VERIFIED

## Why This Matters

Release A tạo giá trị sớm bằng một trang duy nhất cho biết lịch, coaching, workout
và attendance của ngày mà không ghi dữ liệu mới. Đây cũng là contract foundation
cho journal/progress sau này; nếu source ownership hoặc timezone sai ở release này,
các phase ghi dữ liệu sẽ khuếch đại drift.

## Current State

- `server/src/services/trainingScheduleCommand.service.js:186` — resolver active
  Order và default admin trainer; phải reuse semantics.
- `server/src/models/TrainingSchedule.js:22-34` — occurrence date + timezone;
  `occurrenceDateKey` vẫn optional cho legacy compatibility.
- `server/src/models/CoachingDay.js:5-66` — canonical `userId + dateString`, exercise
  completion và client status.
- `server/src/controllers/workoutPlan.controller.js:55-69` — customer chỉ xem
  `published|completed`; legacy lookup đang dùng email.
- `server/src/models/Checkin.js:29-32` — attendance timestamp là `time` UTC.
- `client/src/App.jsx:121-165` — customer routes chưa có auth wrapper dùng chung.
- `client/src/context/AuthContext.jsx:47-65` — logout đã clear TanStack cache.
- `client/src/components/SEO.jsx:32-35` — private page dùng `noindex`.

## Canonical API Contract

`GET /api/today-dashboard/day/:dateKey`

- Authenticated; identity luôn lấy từ `req.user.id`.
- `dateKey` là calendar date `YYYY-MM-DD` theo `Asia/Ho_Chi_Minh`.
- Response envelope và section shape lấy từ
  `docs/specs/today-dashboard.md#91-aggregation`.
- `contractVersion = 1`; client fail closed khi version khác.
- Eligibility: `never_coached | pending | active | inactive |
  assignment_required`.
- Source status: `ready | empty | error`.
- Fatal: invalid date, authentication và ownership.
- Partial: lỗi query riêng của schedule/coaching/workout/attendance.
- Header bắt buộc: `Cache-Control: private, no-store`.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Target server tests | `cd server && npx vitest run src/controllers/__tests__/todayDashboard.integration.test.js` | exit 0 |
| Target client tests | `cd client && npx vitest run src/pages/today-dashboard/__tests__/todayDashboard.adapter.test.js src/utils/__tests__/vietnamDate.test.js` | exit 0 |
| Server suite | `npm run test:unit:server` | exit 0 |
| Client suite | `npm run test:unit:client` | exit 0 |
| Lint | `npm run lint --prefix client` | exit 0 |
| Build | `$env:SKIP_DYNAMIC_ROUTES='true'; npm run build --prefix client` | exit 0 |
| Secrets | `npm run security:secrets` | 0 findings |
| Boundaries | `npm run security:data-boundaries` | 0 findings |

## Scope

### Server files

- Create `server/src/utils/dateKey.js` and tests.
- Update `server/src/services/trainingOccurrence.service.js` to consume/re-export
  canonical date helpers without breaking current imports.
- Create `server/src/services/todayDashboard.service.js`.
- Create `server/src/controllers/todayDashboard.controller.js`.
- Create `server/src/routes/todayDashboard.routes.js`.
- Create `server/src/controllers/__tests__/todayDashboard.integration.test.js`.
- Update `server/src/middlewares/rateLimit.js`, `server/src/observability/metrics.js`
  and mount route in `server/server.js`.

### Client files

- Create `client/src/utils/vietnamDate.js` and tests; migrate duplicated helpers in
  `BookTraining.jsx` và `TrainingSchedule.jsx` without changing behavior.
- Create `client/src/services/todayDashboard.service.js`.
- Create `client/src/routes/AuthenticatedRoute.jsx`.
- Create page, adapter, components and tests under
  `client/src/pages/today-dashboard/`.
- Update lazy routes in `client/src/App.jsx` and entry point in
  `client/src/sections/Header/Header.jsx`.

### Out of scope

- DailyJournal, meal persistence, habits, weekly check-in, comments, notification.
- Trainer-scoped client Today view.
- F1 mapping, schema/index/migration và production data writes.
- Sitemap/prerender changes; `/today` is private and `noindex`.

## Steps

### Step 1: Khóa canonical date helpers

- RED tests: invalid dates, leap day, Việt Nam midnight, UTC range.
- Server helper exports parse/assert/add/range/day-of-week.
- `trainingOccurrence.service.js` reuses helper and preserves its public exports.
- Client helper replaces two current local copies.

**Verify**: server/client date tests exit 0; schedule tests remain green.

### Step 2: Build access policy và source adapters

- Resolve current active Order with existing `resolveClientTrainer()`.
- Check historical/pending orders separately to create eligibility reason codes.
- Source adapters use bounded projections:
  - Schedule by client/date, including explicit legacy fallback.
  - Coaching by `userId + dateString`; never return media URLs.
  - Workout by date UTC range, `published|completed`, prefer clientId and allow
    email only as legacy fallback.
  - Attendance by all own Order IDs + UTC day range.
- Run adapters with `Promise.allSettled`; redact source errors to stable codes.
- Completion only uses applicable schedule + CoachingDay items; WorkoutPlan is
  informational to avoid double counting.

**Verify**: unit/integration cover active, inactive, never coached, empty/rest,
partial failure, cancelled schedule and timezone boundary.

### Step 3: Expose protected endpoint

- Route order: `protect` → read limiter → controller.
- Controller validates `dateKey`, checks `TODAY_DASHBOARD_ENABLED !== false`, sets
  no-store and returns v1 envelope.
- Add request, partial error and aggregation latency metrics.
- Never accept `clientId` or `trainerId` from query/body.

**Verify**: 401 guest, 400 invalid/leap date, 200 active/no-order, no-store header,
stable partial error and feature-disabled response.

### Step 4: Add client contract adapter và route guard

- Service is the only API caller.
- Adapter validates version/required fields and normalizes section empty states.
- Query key: `today-dashboard`, authenticated user id, dateKey.
- `AuthenticatedRoute` waits for auth and redirects guest to login.
- `/today` redirects/render current Vietnam date; `/today/:dateKey` supports direct
  history links.

**Verify**: adapter tests for success, never-coached, partial error and unknown version.

### Step 5: Build product UI

- Restrained product layout: slate surface, primary accent only for main actions.
- Header date navigation, completion, return-to-today.
- Independent Schedule, Coaching, Workout and Attendance sections.
- Loading skeleton, eligibility onboarding, partial error + retry and full API error.
- Deep-link to existing canonical pages; no write form or media payload.
- `<SEO title=... noindex />`, keyboard focus, 44px controls và responsive single
  column at 360px.

**Verify**: client tests + lint/build; manual 360/768/1280 review when dev server is available.

### Step 6: Release gate

- Run targeted then full unit suites.
- Run lint/build/secrets/boundaries.
- Compare source IDs/status with canonical pages using synthetic/local data.
- Record rollback: set `TODAY_DASHBOARD_ENABLED=false`; no data cleanup required.

## Test Plan

- Server: 8+ integration cases covering auth, eligibility, date, projections,
  partial error and privacy headers.
- Client: date helper + adapter contract tests; no snapshot-only assertions.
- Regression: existing schedule, coaching, workout, auth and sitemap/prerender tests.

## Done Criteria

Verification completed on 2026-07-28:

- Targeted Today server integration: 8/8 passed.
- Targeted client adapter/date/F1 regression: 13/13 passed.
- Full client suite: 132/132 passed.
- Full server suite: 233/233 passed.
- Client lint and production build: passed; Today route remains lazy and private.
- Secret, repository data-boundary and commercial contract scans: passed.
- E2E/live viewport review: not run because authenticated dev servers and fixture
  data were not running; scoped source UI audit found no HIGH issue.

- [x] Both `/today` routes are lazy and authenticated.
- [x] Guest cannot trigger source queries.
- [x] No source model is written by aggregator.
- [x] Draft WorkoutPlan và media URL không xuất hiện trong response.
- [x] Unknown contract version fails closed.
- [x] One source failure leaves other cards usable.
- [x] Private response is no-store and route is noindex.
- [x] All required test/build/security gates pass.
- [x] Plan 003/README status is updated with real result.

## STOP Conditions

- Resolver semantics differ from current source evidence.
- Workout identity can only be established by unverified email.
- Implementing Release A requires a new collection/migration.
- Authentication/ownership error would need to be downgraded to partial success.
- Same verification fails three times after evidence-based fixes.

## Maintenance Notes

- New source modules must add an adapter, projection, section error code and test;
  do not query them directly from the page.
- Contract v1 changes require a version bump or backward-compatible optional field.
- Privacy lifecycle is mandatory in the same release that introduces any write model.
