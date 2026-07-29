# Plan 003G: Coach collaboration, notifications và audit

> Release G triển khai Phase 5 Task 5.1–5.4 sau khi Release F verified. Text-only collaboration và
> in-app notification trước; voice/video, email delivery và PDF export không thuộc release này.

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH — comment IDOR, private habit inference, notification dedupe và sensitive exports
- **Depends on**: 003F implemented/verified
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / LOCAL VERIFIED — STAGING PENDING

## Scope

- Contextual CoachingComment cho Daily Journal, Weekly Check-in, Coaching Day và Workout Plan.
- Revision/idempotency cho create/edit/tombstone; không hard delete trong normal comment workflow.
- Trainer client overview reuse Today/Progress services, actor-specific privacy và attention queue.
- In-app notification cho journal/comment/weekly events với dedupe key và preference opt-out.
- Activity timeline và authenticated JSON/CSV export có timestamp/timezone/source IDs.
- AuditLog cho sensitive trainer/admin read/write; không expose internal audit metadata cho client.

## Safety contracts

- Mọi target resolve server-side, owner/managed-client access fail closed; không tin client target owner.
- Comment text tối đa, text-only, không raw HTML/media URL.
- Trainer mất quyền ngay khi active Order kết thúc; client vẫn đọc own history.
- Notification payload/subject không chứa weight, pain detail, wellness note hay comment body.
- Trainer overview không query formula riêng; shared sources phải bằng canonical client services.
- Export dùng bounded pagination/range, CSV escaping và Cache-Control private, no-store.

## Tasks

- [x] Inventory notification/reminder, trainer client surfaces, target ownership và export patterns.
- [x] TDD CoachingComment access, revision, idempotency, tombstone, pagination và privacy lifecycle.
- [x] Implement comment model/migration/services/API/UI threads.
- [x] TDD/implement trainer client overview + actor-aware attention queue.
- [x] TDD/implement in-app notification dedupe/preferences/read state.
- [x] Implement activity timeline + JSON/CSV export + sensitive audit.
- [x] Impact/UI/QA/security/performance gates và operations runbook.

## Done criteria

- [x] Bốn comment target resolve ownership server-side; draft Weekly không lộ cho trainer.
- [x] Comment create/edit/remove có revision, request idempotency, tombstone và privacy lifecycle.
- [x] Trainer overview reuse Today/Progress canonical và active-assignment IDOR check.
- [x] Một notification domain canonical, generic title/deepLink nội bộ, dedupe và preference opt-out.
- [x] Protected notification inbox có unread/read-all/pagination/preferences và noindex.
- [x] Activity Timeline có bounded range, JSON/CSV escaping, source IDs và minimal AuditLog.
- [x] Không email/SMS/push, voice/video, PDF export hoặc retention duration mới.

## Verification evidence

- Release G/Phase 6 targeted suites: 9 files, 35 tests; notification correction/deepLink tests PASS.
- Full client: 26 files, 158 tests; full server: 73 files, 326 tests.
- Client ESLint, production build, static prerender 8/8 và bundle budget: PASS.
- Secret scan, repository data-boundary scan và commercial/cross-layer contracts: PASS.
- UI targeted scan: không có banned gradient text, bounce, purple-blue, side-stripe hoặc touch target nhỏ.
- Playwright Chromium với deterministic mock API: 51/51 PASS, gồm Today mobile, Progress, notification
  keyboard dismissal/deepLink và F1 entitlement regression. Không tuyên bố staging/production.

## STOP conditions

- Cần gửi email/SMS/push thật hoặc thay đổi preference marketing ngoài in-app scope.
- Cần voice/video/media upload trước private-media gate.
- Cần hard-delete comment audit history hoặc expose private habit/note cho trainer.
- Cần retention duration/pseudonymization policy mới chưa được product owner duyệt.
