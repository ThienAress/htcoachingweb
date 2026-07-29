# Today Dashboard completion audit — 2026-07-29

## Kết luận

Plan 003 từ Phase 0 đến Phase 6 và ba vấn đề tiền đề đã hoàn tất ở phạm vi local.
Producer, API/service boundary, consumer UI và regression test đều có bằng chứng trong matrix dưới.
Không phát hiện requirement local nào còn thiếu sau vòng audit cuối.

Trạng thái release vẫn là **LOCAL VERIFIED — STAGING PENDING**. Migration/index verification trên
target, retention enforcement, cohort rollout, deploy và production write không thuộc local completion
và chưa được chạy. F1 baseline linking tiếp tục deferred vì chưa có explicit identity link; hệ thống
không auto-link bằng email.

## Requirement matrix

| Requirement | Producer/canonical boundary | Consumer/surface | Test/evidence | Kết quả |
|---|---|---|---|---|
| Tổ chức lại `docs/` | `docs/README.md`; các nhóm `architecture/`, `audits/`, `handoffs/`, `operations/`, `phases/`, `plans/`, `reports/`, `specs/` | Developer/operations navigation | Local Markdown link checker; root `docs/` chỉ còn README và thư mục phân loại | PASS |
| Free plan không vào F1 | `server/src/middlewares/f1Access.middleware.js`; entitlement `f1CrmAi` | `client/src/routes/F1Route.jsx`; account dropdown trong `client/src/sections/Header/Header.jsx` | `f1Access.middleware.test.js`; `trainerEntitlements.test.js`; authorization/F1 Chromium smoke | PASS |
| 3–5 blog khác chủ đề dưới mục lục | `server/src/services/blogDiscovery.service.js`; `discoveryPosts` trong blog detail API | Desktop sidebar và mobile block trong `client/src/pages/BlogDetail.jsx` | `blogDiscovery.service.test.js`; published-only, khác category, ưu tiên đa dạng category, limit 5 | PASS |
| Phase 0 — contract, flags, date rules | Today contract v1, `TODAY_DASHBOARD_ENABLED`, các write flags, date key `Asia/Ho_Chi_Minh` | `todayDashboard.service.js`; frontend adapter/date navigation | `todayDashboard.integration.test.js`; client/server date helper tests, gồm 23:30/00:30 Việt Nam | PASS |
| Phase 1 — protected read-only Today | `todayDashboard.routes/controller/service`; canonical Schedule, CoachingDay, WorkoutPlan, Checkin và Order readers | `/today` và `/today/:dateKey`; onboarding, partial-error, future/read-only states | `todayDashboard.integration.test.js`; `todayDashboardPrivacy.integration.test.js`; adapter unit; Chromium mobile journey | PASS |
| Phase 2 — Daily Journal, revision, wellness | `DailyJournal`, `DailyJournalRevision`; command/access/privacy/timeline services | Wellness autosave, submit/correction, revision/timeline cards | Daily Journal integration/nutrition/privacy suites; wellness unit; Chromium save → reload | PASS |
| Phase 3 — Saved Meal Plan và nutrition | `SavedMealPlan`; snapshot/version/privacy services; Daily Journal nutrition patch | `/mealplan/saved`; Today nutrition quick log | Saved Meal Plan integration/privacy; Daily Journal nutrition; saved plan unit; Chromium fresh browser context | PASS |
| Phase 3 — Coaching Habit và streak | `CoachingHabit`; access/read/privacy/streak/snapshot services | Today habit card; trainer habit manager | Habit integration/privacy; streak unit; private client habit regression | PASS |
| Phase 4 — Weekly Check-in | `WeeklyCheckin`, `WeeklyCheckinRevision`; command/review/privacy services | `/progress`; client submit/correction và trainer review | Weekly integration/privacy; progress presentation unit | PASS |
| Phase 4 — Progress Hub | `progressReadModel.service.js` tổng hợp nguồn có provenance, không biến missing thành zero | `/progress`; trend, adherence, source labels | Progress integration/read-model tests; Chromium Progress journey | PASS |
| Phase 4 — F1 baseline | Chỉ cho phép explicit `F1Customer.userId` link | Progress source optional | STOP condition trong spec/plan; không có email join hoặc schema write | DEFERRED BY DESIGN |
| Phase 5 — contextual comments | Comment command/read/access/privacy/target services; revisions và tombstone | Today, Weekly, CoachingDay, WorkoutPlan comment threads | Comment lifecycle/privacy/target-deletion và dual-scope actor suites | PASS |
| Phase 5 — trainer overview/attention | Hai endpoint dùng chung `trainerOverview.service.js` và cùng privacy-filtered read model | Trainer client overview, attention, habit và weekly review panels | Trainer overview + client overview integration; private-habit leak regression | PASS |
| Phase 5 — trainer subscription access | `trainerAccess.middleware.js`; `requestActor.js`; active `TrainerSubscription` hoặc legacy trainer role | Habit, Weekly, Progress, Overview và Comment trainer surfaces | `todayDashboardTrainerSubscription.integration.test.js`; active/expired/dual-scope matrix | PASS |
| Phase 5 — notifications/deep links | In-app notification/preference services; allowlisted internal deepLink | Header center, preferences, `/notifications` | Notification/event integration; destination unit; Chromium popover/inbox deepLink | PASS |
| Phase 5 — activity/export/actor labels | Activity read/export services; bounded JSON/CSV; normalized actor role | Progress activity panel và timeline labels | Activity integration; timeline presentation unit | PASS |
| Phase 6 — privacy delete/retention | Transactional Today deletion orchestration; target cascades; retention guard dry-run/fail-closed | Self privacy endpoints và admin operations endpoints | Privacy suites + target-deletion + transactional rollback tests | PASS |
| Phase 6 — indexes/performance | Additive index-only migrations; bounded query loaders; performance operation budgets | Today/Progress/Trainer API latency and payload controls | Query performance service test; operations performance test; full server suite | PASS LOCAL |
| Phase 6 — trainer cache fail-closed | `trainerPrivateCache.js`; 403 current-query remove/reset guard | Trainer client overview and all trainer-private TanStack roots | `trainerPrivateCache.test.js` kiểm tra active + inactive reset và scope allowlist | PASS |
| Phase 6 — rollout/runbook | Feature flags, cohort order, rollback thresholds | `today-dashboard-phase5-6.md` | Runbook review; local gates bên dưới | READY, STAGING PENDING |

## Completion audit fixes

Vòng cuối không chỉ đối chiếu checkbox mà còn thêm regression cho sáu gap thực tế:

1. Hợp nhất hai trainer overview endpoint để không lộ client-created private habit.
2. Cho phép trainer subscription hợp lệ dùng workspace, đồng thời thu hồi ngay subscription hết hạn.
3. Giữ dual-scope actor đúng ngữ cảnh khi một user vừa là client vừa có trainer subscription.
4. Reset cả active/inactive trainer-private cache và current overview khi backend trả 403.
5. Dùng date key Việt Nam trong trainer workspace và hiển thị actor label trong timeline.
6. Chứng minh wellness persistence sau reload và Saved Meal Plan qua fresh browser context.

## Local verification — 2026-07-29

| Gate | Kết quả |
|---|---|
| Client Vitest | 28 files, 161/161 tests PASS |
| Server Vitest/Supertest | 74 files, 329/329 tests PASS |
| Client ESLint | PASS, không warning |
| Deterministic production build | PASS; Vite compile, prerender 8/8, bundle budget PASS |
| Playwright Chromium | 57/57 PASS |
| Operations tests | 11/11 PASS |
| Secret scan | PASS |
| Repository data-boundary scan | PASS, 0 violation |
| Commercial/cross-layer contract scan | PASS |
| Local Markdown links | PASS, tất cả relative link resolve |
| Changed-code debug scan | PASS, không có `console.log`/`debugger` mới |
| Patch whitespace check | PASS (`git diff --check`; chỉ có CRLF conversion warnings) |

Build local dùng `SKIP_DYNAMIC_ROUTES=true` theo Plan 003 để không phụ thuộc production content API.
Full Chromium dùng deterministic mock API. Server integration dùng test database; các kết quả này không
được diễn giải thành staging/database-target verification.

Hai integration suite dài hơn 300 dòng vì giữ trọn lifecycle/privacy scenario trong một fixture.
Production coordinator `coachingComment.service.js` dài 305 dòng nhưng các concern đã được tách sang
access, command, content, DTO, target, read và privacy services; không tiếp tục chia transaction boundary
chỉ để giảm số dòng.

## Việc cố ý chưa chạy

- Không chạy migration Release G/Phase 6 hoặc index verifier trên staging/production target.
- Không seed/cleanup staging, không signed-in staging acceptance và không bật cohort.
- Không bật retention enforcement; duration canonical vẫn là 365 ngày và enforcement cần target,
  env guard cùng admin actor được duyệt riêng.
- Không deploy, commit, push hoặc ghi dữ liệu production.
- Không auto-link F1 bằng email; chờ explicit identity-linking design và dữ liệu hợp lệ.
