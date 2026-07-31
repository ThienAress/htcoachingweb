# Plan 012: Tách quản lý học viên khỏi Coach Online

> Drift check: Worktree đang chứa thay đổi chưa commit từ Plans 009-011. Chỉ sửa các symbol trong scope
> và không ghi đè dashboard progress, crawler, sitemap hoặc thay đổi của user.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH - protected route, role-aware client list, admin habit ownership và UI state xuyên nhiều page
- **Depends on**: 009, 010, 011
- **Category**: feature | ui | navigation | tests
- **Planned at**: 2026-07-30
- **Status**: IMPLEMENTED / LOCAL VERIFIED

## Why This Matters

TrainerCoaching hiện trộn ba module quản lý chung với luồng soạn bài Online Coaching. Khách PT 1-1
không cần video/feedback nhưng vẫn cần target, habit và progress. Workspace theo client tạo một nơi
canonical dùng chung, còn WorkoutPlan chỉ đọc target để hỗ trợ quyết định khi soạn giáo án.

## Current State

- client/src/pages/trainer/TrainerCoaching.jsx:584-598 render habit, target và overview trước form online.
- client/src/pages/trainer/Dashboard.jsx chỉ hiển thị orders và chưa có hành động quản lý client.
- client/src/pages/trainer/WorkoutPlan.jsx lấy client list và mở WorkoutPlanModal.
- client/src/App.jsx lazy-load page và bảo vệ /trainer bằng AdminRoute.
- GET /api/coaching/trainer/clients đã trả client active đúng scope trainer/admin.
- Wellness target và habits đã có service/component độc lập; không cần API/schema mới.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Focused client tests | npm run test:unit:client -- --run trainerClientWorkspace | exit 0 |
| Client lint | npm run lint --prefix client | exit 0 |
| Vite compile | npx vite build | exit 0 |
| Diff check | git diff --check | exit 0 |

## Scope

In scope:

- client/src/App.jsx
- client/src/layouts/AdminLayout.jsx
- client/src/layouts/TrainerLayout.jsx
- client/src/pages/trainer/Dashboard.jsx
- client/src/pages/trainer/TrainerCoaching.jsx
- client/src/pages/trainer/TrainerClientWorkspace.jsx
- client/src/pages/trainer/trainerClientWorkspace.helpers.js
- client/src/pages/trainer/WorkoutPlanClientTargetSummary.jsx
- client/src/pages/trainer/WorkoutPlanModal.jsx
- client/src/pages/trainer/WorkoutPlanDetail.jsx
- client/src/pages/trainer/__tests__/trainerClientWorkspace.test.js
- client/src/pages/trainer/TrainerHabitManager.jsx
- client/src/pages/trainer/TrainerClientOverview.jsx
- client/src/pages/trainer/WorkoutPlan.jsx
- client/src/utils/trainerPrivateCache.js
- server/src/routes/coachingHabit.routes.js
- server/src/controllers/coachingHabit.controller.js
- server/src/services/coachingHabitAccess.service.js
- server/src/services/coachingHabit.service.js
- server/src/services/coachingHabitRead.service.js
- server/src/controllers/__tests__/coachingHabit.integration.test.js
- docs/specs/trainer-client-workspace.md
- docs/specs/wellness-targets.md
- docs/plans/012-separate-client-management-from-online-coaching.md
- docs/plans/README.md
- docs/README.md

Out of scope:

- New backend endpoint, Mongoose schema/model hoặc migration.
- Daily Journal completion and student WellnessCard.
- WorkoutPlan schema/payload.
- Online Coaching video/feedback semantics.
- Public SEO, sitemap and prerender.

## Steps

### Step 1: Lock presentation contracts with RED tests

Add pure tests for workspace tab normalization, deep links and target summary presentation. Confirm missing
module fails before implementation.

### Step 2A: Normalize admin habit ownership

Replace requireTrainerActor on trainer habit endpoints with requireTrainerAccess, then enforce active Order ownership
inside the habit access service. Admin may manage trainer-created habits for any active client; trainer remains
limited to assigned clients and user-created private habits stay hidden.
### Step 2: Create client workspace

Create lazy protected nested route /trainer/clients/:clientId. Fetch canonical active client list through
getTrainerClients, handle loading/error/not-found, render date-aware overview/habits and versioned target card.

### Step 3: Move entry points

Update Khách của tôi to use the active-client list and provide Quản lý actions. Update Admin navigation to
/trainer. Remove overview/habit/target imports and rendering from TrainerCoaching.

### Step 4: Add WorkoutPlan target context

Add a compact reusable summary to create modal and detail page. Summary is read-only and links to the
workspace wellness tab; it must not mutate or copy target into WorkoutPlan payload.

### Step 5: Re-trace and verify

Search all three moved components, route literals and labels. Run focused/full client tests as proportionate,
lint, Vite compile, bundle gate and git diff --check. Perform scoped UI quality check.

## Test Plan

- Unit: allowed tab normalization and fallback.
- Unit: workspace deep link encodes client id and preserves valid date/tab.
- Unit: target summary distinguishes empty target from numeric values.
- Structural trace: TrainerCoaching has no moved component imports; App route stays lazy/protected.
- Manual/source review: loading/error/empty/focus/mobile states.

## Verification Evidence

- RED client: missing trainerClientWorkspace module failed as expected.
- Regression guard: opaque client ID coercion failed before the defensive ID normalizer and passed after the fix.
- GREEN focused client: 3 files, 9/9 tests passed.
- Full client: 35 files, 190/190 tests passed.
- RED server: admin habit list returned 403 as expected before ownership fix.
- GREEN focused server: habit suite 6/6 passed; related integration group 4 files, 23/23 passed.
- Client lint: passed.
- Vite production compile: passed, 2,773 modules transformed.
- Bundle budget: passed.
- Scoped UI check: passed with no findings in the three new product-surface files.
- Secret scan: passed.
- Repository data-boundary scan: passed.
- git diff --check: passed; only existing LF/CRLF conversion warnings.
- Full server suite was not rerun; focused integration coverage was selected because backend change is isolated to Coaching Habits.

## Done Criteria

- [x] Coach Online contains only online plan/video/feedback concerns.
- [x] Client workspace works for trainer/admin active clients.
- [x] Dashboard and Admin navigation reach the workspace.
- [x] WorkoutPlan create/detail show read-only target context.
- [x] No new API/schema/data migration.
- [x] Tests/lint/Vite/diff checks recorded.
- [x] No debug log, unused import or new file over 300 lines.
## STOP Conditions

- Existing client API cannot prove trainer/admin scope.
- Moving UI requires changing WellnessTarget or CoachingHabit semantics.
- Direct workspace access can bypass backend ownership checks.
- Verification exposes an unrelated worktree conflict that would require overwriting user changes.

## Maintenance Notes

Future client-level coaching modules should enter through the workspace, not TrainerCoaching or individual
WorkoutPlan documents. Package-specific actions can deep-link out while shared data remains client-scoped.
