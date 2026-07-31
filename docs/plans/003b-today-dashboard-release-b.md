# Plan 003B: Daily Journal, wellness quick log và privacy lifecycle

> Release B chỉ thêm dữ liệu nhật ký ngày của chính khách hàng. Không upload media,
> không ghi đè CoachingDay/WorkoutPlan và không cấp quyền trainer mutation.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — dữ liệu wellness riêng tư, concurrency và retention
- **Depends on**: 003A implemented/verified
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Assumptions đã được duyệt

1. Spec và master Plan 003 đã được duyệt; yêu cầu "tiếp tục" cho phép thực thi Release B.
2. Schema hoàn toàn additive. Không có document cũ cần backfill.
3. Migration chỉ create/verify indexes, có safety guard và chỉ chạy trong memory test.
4. Retention mặc định 365 ngày đã được duyệt nhưng enforcement fail-closed; chỉ record
   có deadline canonical mới là candidate.
5. Production write cần explicit TODAY_JOURNAL_WRITES_ENABLED=true.

## Contract

### Models

- DailyJournal: unique client/date; wellness bounded; private/shared note; lifecycle,
  revision, trainer snapshot, retention deadline.
- DailyJournalRevision: append-only field diff; unique journal/revision và
  actor/requestId để chống request lặp.
- Không tạo model command thứ ba; revision record giữ fingerprint/idempotency metadata.

### API

- GET /api/daily-journals/:dateKey
- PUT /api/daily-journals/:dateKey
- POST /api/daily-journals/:dateKey/submit
- POST /api/daily-journals/:dateKey/corrections
- GET /api/daily-journals/:dateKey/revisions?page=1&limit=20
- GET /api/daily-journals/:dateKey/timeline
- GET /api/daily-journals/privacy/export?page=1&limit=50
- DELETE /api/daily-journals/privacy
- GET /api/daily-journals/trainer/clients/:clientId/:dateKey

Mutation payload dùng expectedRevision, UUID requestId và patch allowlist.
Correction bắt buộc reason. Identity client luôn lấy từ auth.

### Access và thời gian

- Client đọc own-history kể cả inactive.
- Client chỉ ghi khi có active approved Order còn buổi và HLV được resolve.
- Edit window: hôm nay và 7 ngày trước theo Asia/Ho_Chi_Minh; ngày tương lai bị chặn.
- Trainer chỉ đọc khi quan hệ Order hiện tại khớp; admin read được audit.
- Responses chứa journal/revision đặt Cache-Control: private, no-store.

### Privacy

- Self-export phân trang và không trả fingerprint/internal metadata.
- Self-delete xóa journal + revision trong transaction, giữ audit tối thiểu.
- Admin retention endpoint dry-run mặc định; enforcement cần env + explicit actor.
- Retention sweep re-check active approved Order trước khi xóa để chống deadline cũ sau renewal.
- Order mutation đã commit không trả 500 chỉ vì retention sync phụ lỗi; hệ thống phát metric,
  structured log và high-severity alert theo operations runbook.
- Admin user deletion inventory gồm cả hai collection mới.

## Tasks

- [x] Tạo model/index/migration và verify duplicate client/date.
- [x] Tạo access policy, pure patch/diff helpers và domain transaction service.
- [x] Test create/update, replay, request reuse, stale revision, submit/correction.
- [x] Tạo validation/controller/routes với protect, CSRF và mutation limiter.
- [x] Test self/trainer ownership, edit-window, privacy export/delete/retention.
- [x] Bổ sung journal + timeline optional vào Today contract v1.
- [x] Tạo WellnessCard bằng RHF + Zod với saved/error/conflict/pain safety states.
- [x] Chạy targeted/full tests, lint/build và security gates.

## Verification commands

- cd server && npx vitest run src/controllers/__tests__/dailyJournal.integration.test.js
- cd client && npx vitest run src/pages/today-dashboard/__tests__/wellness.test.js
- npm run test:unit:client
- npm run test:unit:server
- npm run lint --prefix client
- npm run build --prefix client
- npm run security:secrets
- npm run security:data-boundaries
- npm run check:commercial-contracts

## Verification result — 2026-07-29

- Targeted server integration: 45/45 pass; lifecycle/privacy follow-up: 18/18 pass.
- Full client unit: 135/135 pass.
- Full server unit/integration: 249/249 pass.
- Full client ESLint: pass.
- Vite production compile, static prerender 8/8 và bundle budget: pass.
- Secret scan, repository data-boundary scan và commercial contract scan: pass.
- UI quality check scoped Today Dashboard: pass sau khi bổ sung validation announcements.
- E2E authenticated viewport: chưa chạy vì không có dev servers/session test đang hoạt động.
- Không chạy migration, backfill, retention enforcement, deploy hoặc production write.

## Stop conditions

- Cần backfill hoặc xóa dữ liệu production.
- Không thể xác định active trainer bằng Order canonical.
- Idempotency hoặc revision không thể giữ trong cùng transaction.
- Retention enforcement cần suy đoán ngày kết thúc coaching.
- Cần expose private note cho trainer hoặc log raw wellness payload.

## Done criteria

- [x] Mutation fail closed khi flag tắt, thiếu CSRF, ngoài edit window hoặc stale revision.
- [x] Request lặp không tạo revision lặp; requestId reuse khác payload trả 409.
- [x] Trainer không thể ghi và không đọc client ngoài assignment.
- [x] Export/delete/retention có integration test.
- [x] Today UI báo saved/error/retry/conflict đúng và không chẩn đoán y tế.
- [x] Không có migration/backfill/production write được thực thi.
