# Plan 047: Triển khai TDEE có độ tin cậy, độ phức tạp bài tập và Tiến trình cơ thể

> **Hướng dẫn thực thi**: Thực hiện theo từng gate. Chỉ chuyển phase khi focused verification của phase trước pass. Không chạy migration/seed hoặc ghi dữ liệu staging/production.
>
> **Drift check**: `git status --short` phải chỉ có thay đổi sidebar HLV đã biết và các file của Plan 047. Nếu consumer/schema khác contract trong spec thì dừng và cập nhật plan trước khi mở rộng.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (health estimates + Mongoose schema + cross-layer AI/UI)
- **Depends on**: 003F, 006, 016, 031, 046
- **Category**: feature
- **Planned at**: 2026-08-12
- **Execution**: COMPLETE — local implementation/review/QA finished; authenticated UI smoke and release prerender remain environment-blocked

## Why This Matters

TDEE hiện dùng mô tả activity dựa nhiều vào số buổi và AI Chat còn mặc định 1.55. Exercise chưa có dữ liệu độ khó. Progress đã thu cân nặng/vòng eo nhưng chỉ trực quan hóa cân nặng. Plan này biến ba khoảng trống thành behavior có contract, không tạo cảm giác chính xác giả hoặc dữ liệu sức khỏe suy đoán.

## Current state

- `client/src/pages/TdeeCalculator/TdeeForm.jsx` — activity dropdown 1.2–1.9 dựa trên số buổi.
- `client/src/components/ChatWidget/cards/TdeeFormCard.jsx` — default `moderate`.
- `server/src/services/ai/tools/calculateTdee.tool.js` — duplicate calculation và fallback 1.55.
- `server/src/models/Exercise.js` — chỉ có name, muscleGroup, description và media.
- `server/src/models/WeeklyCheckin.js` — đã có `body.weightKg` và `body.waistCm`.
- `server/src/services/progressSources.service.js` — projection hiện chỉ đọc cân nặng.
- `client/src/pages/progress/ProgressSummary.jsx` — wellness + weight trend, chưa có body report.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Focused client | `cd client && npx vitest run <files>` | exit 0 |
| Focused server | `cd server && npx vitest run <files>` | exit 0 |
| AI contract | `node .agents/scripts/validate-tools.mjs` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Compile | `cd client && npx vite build` | exit 0 |
| Full unit | `npm run test:unit` | exit 0 |

## Scope and ownership

- TDEE workstream owns TDEE public helpers/form/result, Chat TDEE card/tool/registry/mock and their tests.
- Exercise workstream owns Exercise model/controller/admin/public-library/service and focused tests.
- Body Progress workstream owns progress source/read model/presentation/navigation and focused tests.
- Root owns spec/plan/glossary, reconciliation, shared contract decisions, integrated QA/review and existing sidebar diff.
- No agent may edit another workstream or the existing sidebar files.

## Steps

### Phase 1: Make TDEE an explicit estimate across web and AI

**Status**: COMPLETE

**Behavior**: User supplies whole-day activity evidence; system recommends an activity band, returns estimate + range, never silently chooses 1.55, and explains 14-day calibration.

**Verify**: focused client/server TDEE tests + tool validator; only then Phase 2 may start integration.

### Phase 2: Add reviewed Exercise technical-complexity rubric

**Status**: COMPLETE

**Behavior**: Admin can record five 0–2 criteria; server derives 1–5 or null; public library displays/filters rating and old exercises show `Chưa đánh giá`.

**Compatibility**: optional fields only; no backfill/migration required.

**Verify**: model/helper/controller and client presentation tests; existing Exercise API behavior remains green.

### Phase 3: Add Body Progress report from canonical measurements

**Status**: COMPLETE

**Behavior**: submitted/reviewed weekly check-ins yield ordered weight/waist histories, current values and deltas; customer and authorized trainer/admin presentation shows a report-like view and correct empty state.

**Compatibility**: retain `weightTrend`; add `bodyProgress`; no WeeklyCheckin schema change.

**Verify**: progress service/read-model and client presentation tests.

### Phase 4: Integrate, review and release-gate locally

**Status**: COMPLETE WITH ENVIRONMENT CAVEATS

Re-trace all producers/consumers, run AI check, full unit suites, lint, compile/release build as environment permits, data-boundary/secret scans when relevant, UI check desktop/mobile and independent code review. Update this plan status with actual evidence.

## Done criteria

- [x] All three spec success-criteria groups pass focused tests.
- [x] Full client/server unit tests, client lint and Vite compile pass.
- [x] AI tool registry validation passes and no default 1.55 remains reachable.
- [x] Exercise documents without rubric remain valid and render `Chưa đánh giá`.
- [x] Body report only uses valid measurements and never coerces missing values to zero.
- [x] `git diff --check` passes; no debug logs, unused imports or unrelated formatting from Plan 047.
- [x] Independent review has no blocking/high/medium finding after fixes.

## Final evidence — 2026-08-12

- Baseline: branch `staging`, HEAD `5b9e6c696bf8d5a8dfe8ea03f68c2d908399d1c8`; working tree dirty because Plan 047 and separate parallel Plan 048/Skill Radar work are both uncommitted.
- Server full unit/integration: `144` files, `730/730` tests, exit `0`. Vitest emitted a post-result worker SIGKILL cleanup warning; assertions and command exit remained successful.
- Client full unit: `88` files, `439/439` tests, exit `0`.
- Client ESLint: exit `0`.
- Release lifecycle: Vite transformed `2,863` modules, bundle budget passed, command exit `0`.
- Prerender: `BLOCKED` in the local sandbox (`0/38`) by denied external network/asset loading; the current script reports warnings and still exits `0`, so this is not recorded as a prerender pass.
- AI/tool validation: `11/11` registered tools, `0` warnings; TDEE contradictory evidence fails closed in public helper, chat/mock provider, tool runtime and executor validation.
- Security/agent checks: secret scan pass, repository data-boundary scan pass with `0` violations, agent instruction validation pass, `git diff --check` pass.
- UI smoke: public TDEE and Exercise Library pass on desktop/mobile; the seated + under-5,000-step + 5-session case recommends `1.55` within band `1.5–1.6`, not `1.7`; no page-level horizontal overflow. Customer Progress and admin Exercise screens are `BLOCKED` because the local browser had no authenticated session.
- Independent review: TDEE PASS after resolving no-workout consistency, mock-parser and 14-day copy findings; Exercise PASS; Body Progress/navigation PASS after adding fail-closed audit logging for direct admin health-data reads.
- E2E: `SKIP` because authenticated dev servers/test identities were not available; this local evidence is suitable for implementation handoff but is not complete deployment/release evidence.

## STOP conditions

- A phase requires production/staging data write or destructive backfill.
- Two canonical sources disagree on a health metric and ownership cannot be proven.
- Adding body composition beyond weight/waist becomes necessary.
- Same verification fails three rounds after evidence-based fixes.

## Maintenance notes

- Future device/InBody import is a separate schema/privacy feature with provenance and confirmation.
- Future TDEE account history/calibration persistence is separate if local/session history is insufficient; it must not auto-adjust calories without user/HLV confirmation.
- Future injury suitability is separate from technical complexity and requires client-specific context.
