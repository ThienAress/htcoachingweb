# Plan 003F: Weekly Check-in và Progress Hub

> Release F triển khai Phase 4 Task 4.1–4.3. Task 4.4 F1 baseline linking vẫn là STOP riêng:
> không sửa F1Customer, không tạo linking migration và không auto-link bằng email trong release này.

## Status

- **Priority**: P1
- **Effort**: XL
- **Risk**: HIGH — weekly health data, trainer IDOR, derived denominator và privacy lifecycle
- **Depends on**: Phase 3 implemented/verified
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Weekly Check-in contract

- Một `WeeklyCheckin` cho mỗi `clientId + weekStartDateKey` (Monday, Asia/Ho_Chi_Minh).
- Client fields: optional weight/waist, energy/adherence rating, wins, challenges và note có bounds.
- Lifecycle: `draft | submitted | reviewed`; submitted client fields chỉ sửa qua correction có reason.
- Trainer review nằm namespace riêng; trainer không sửa client fields.
- Optimistic `revision`, UUID request idempotency và append-only `WeeklyCheckinRevision`.
- Client write chỉ cho current/previous week trong 7-day weekly window; future/older week fail closed.
- Trainer read/review cần active managed-client relationship tại backend.
- New collections có migration index/no-backfill, export/delete/retention và user-deletion inventory.

## Progress read model

- `GET /api/progress?days=7|30|90` cho client.
- `GET /api/progress/trainer/clients/:clientId?days=7|30|90` cho active trainer.
- Read-only service dùng cùng canonical formula cho cả hai role.
- Metrics: schedule/workout completion, meal/habit compliance, wellness averages và weight trend.
- Mỗi compliance metric trả numerator, denominator, percent hoặc `null`; không có assignment/data thì
  denominator không bị biến thành zero-compliance.
- Range bounded 90 ngày, timezone Việt Nam và `formulaVersion` rõ ràng.
- Không suy luận y khoa, không dùng F1 baseline khi chưa có explicit link.

## Progress UI

- Protected lazy route `/progress`, `<SEO noindex />`, không sitemap/prerender.
- Filters 7/30/90 ngày.
- Metric visualization có table/text alternative; không dùng ảnh progress trong MVP.
- Link tự nhiên từ Today Dashboard; loading/empty/error/retry và responsive đầy đủ.

## Tasks

- [x] TDD WeeklyCheckin lifecycle, idempotency, correction, review isolation, week boundary và IDOR.
- [x] TDD WeeklyCheckin privacy/migration/retention/user deletion.
- [x] Implement models, migration, services, controller/routes, validation, limiter, audit/metrics/ops.
- [x] TDD pure progress calculations cho missing/rest/partial weeks và 7/30/90 ranges.
- [x] Implement shared client/trainer progress read model và bounded API contract.
- [x] Implement `/progress` UI, accessible alternatives và Today internal link.
- [x] Impact re-trace, UI check, full QA/build/security gates.

## Done criteria

- [x] One check-in/week/client; stale/replayed commands không duplicate hoặc mất dữ liệu.
- [x] Trainer review không thể mutate client-owned fields; inactive/other trainer nhận 403.
- [x] Weekly revisions, export/delete/retention và migration no-backfill có tests.
- [x] Denominator chỉ gồm task/plan/habit thực sự áp dụng; missing data trả null/not available.
- [x] Client/trainer dùng cùng formula; trainer scope loại habit client-private để không leak aggregate.
- [x] `/progress` private/noindex, không sitemap/prerender và có accessible text/table alternative.
- [x] Không sửa F1 schema/linking, không chạy migration/deploy/retention enforcement/production write.

## Verification evidence

- Targeted server: 4 files, 15 tests; targeted client: 2 files, 7 tests.
- Full client: 23 files, 148 tests; full server: 62 files, 290 tests.
- Client ESLint, production build, static prerender 8/8 và bundle budget: PASS.
- Secret scan, repository data-boundary scan, commercial/cross-layer contracts: PASS.
- UI code audit không có pattern bị cấm trong Progress surface.
- E2E authenticated browser chưa chạy vì không có dev servers/session; API ownership, CSRF mutation,
  loading/error/retry, noindex và route protection đã được integration/static/build gates kiểm chứng.

## STOP conditions

- Cần F1 baseline để tính metric cốt lõi hoặc cần auto-link bằng email.
- Cần để trainer sửa trực tiếp client weekly answers.
- Cần denominator dựa trên missing data giả định bằng zero.
- Cần unbounded range/query hoặc lưu progress counters mutable.
