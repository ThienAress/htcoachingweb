# Plan 003C: Lưu và version hóa meal plan từ nguồn Food canonical

> Release C chỉ persist output tự động của `useMealGenerator`. Không thay thuật toán tạo
> meal, không persist custom food chưa có nguồn server xác minh và chưa gắn plan vào ngày.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — dữ liệu dinh dưỡng, immutable history, IDOR và retention
- **Depends on**: 003B implemented/verified
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Assumptions đã được duyệt

1. Master spec/Plan 003 đã được duyệt và user yêu cầu tiếp tục tự động tới khi hoàn tất.
2. `SavedMealPlan` là collection mới; không có document cũ cần backfill.
3. Migration chỉ create/verify indexes, có safety guard và chỉ chạy trong memory test.
4. Chỉ Food có `_id` hợp lệ được persist. Server đọc Food canonical rồi tự tính snapshot
   macros/calories; mọi total client gửi lên đều bị bỏ qua.
5. Mỗi revision là một document immutable. Daily assignment ở Release D sẽ reference đúng
   document/version, nên archive hoặc revise template không đổi history.
6. Mutation cần active approved Order, trainer assignment canonical và
   `TODAY_MEAL_PLAN_WRITES_ENABLED=true`; own read/privacy delete vẫn dùng được khi inactive.
7. Không migration, retention enforcement hoặc production write trong implementation local.

## Contract

### Model `SavedMealPlan`

- Ownership: `ownerId` lấy từ auth.
- Versioning: `lineageKey` UUID + `version`; unique owner/lineage/version và chỉ một latest.
- Lifecycle: `active`, `superseded`, `archived`; nội dung meals/totals không update tại chỗ.
- Bounded payload: 1–6 meals, tối đa 8 foods/meal, amount 1–1000g.
- Snapshot: Food ID, label, amount và canonical macro contribution; totals do server tính.
- Privacy: `retentionExpiresAt`, self export/delete, admin retention sweep và user deletion.

### API

- `POST /api/saved-meal-plans`
- `GET /api/saved-meal-plans?page=1&limit=20&status=active`
- `GET /api/saved-meal-plans/:id`
- `POST /api/saved-meal-plans/:id/revisions`
- `POST /api/saved-meal-plans/:id/archive`
- `GET /api/saved-meal-plans/privacy/export?page=1&limit=50`
- `DELETE /api/saved-meal-plans/privacy`
- `POST /api/ops/privacy/saved-meal-plans/retention`

Mutation payload dùng UUID `requestId`; create/revise idempotent theo owner/requestId.
Archive chỉ áp dụng latest active version thuộc owner. Responses private đặt `no-store`.

## Tasks

- [x] Viết integration tests RED cho canonical recalculation, IDOR, idempotency và versioning.
- [x] Tạo model/index migration cùng verification không backfill.
- [x] Tạo normalize/snapshot/version command services theo MVC layering.
- [x] Tạo validation/controller/routes với protect, CSRF, active coaching và limiter.
- [x] Thêm export/delete/retention, active-Order re-check, audit/metrics và user inventory.
- [x] Bổ sung Food ID vào generator output và pure client payload adapter.
- [x] Thêm save/list/revise/archive UI states trên Meal Plan bằng service + TanStack Query.
- [x] Chạy impact re-trace, UI check, full QA/build/security gates.

## Done criteria

- [x] Tampered totals không ảnh hưởng dữ liệu lưu; Food thiếu/không hợp lệ bị reject.
- [x] Request replay không tạo plan/version trùng; requestId reuse khác payload trả 409.
- [x] User không đọc/sửa plan người khác; mutation fail closed khi flag/CSRF/access thiếu.
- [x] Revise tạo document mới; version cũ giữ nguyên và vẫn đọc được.
- [x] Export/delete/retention có integration tests và active client không bị retention xóa.
- [x] Save qua API, không dùng localStorage làm nguồn dữ liệu chính.
- [x] Không chạy migration, backfill, deploy hoặc production write.

## Verification evidence — 2026-07-29

- Targeted backend: 5 files, 31 tests pass.
- Full client: 20 files, 137 tests pass.
- Full server: 54 files, 258 tests pass.
- Client ESLint pass.
- Production build, static prerender 8/8 và bundle budget pass; có warning navigation timeout cho `/`
  sau khi route đã render, không phải lỗi build.
- Secret scan, repository data boundaries, commercial contracts và `git diff --check` pass.
- UI check scoped cho Saved Meal Plan pass; không có finding HIGH/MED.
- E2E cross-device chưa chạy vì không có hai browser session/dev servers trong gate local.

## STOP conditions

- Cần tin macro/totals client hoặc custom food không có canonical server source.
- Cần sửa thuật toán meal generator ngoài mapper output.
- Cần backfill/xóa dữ liệu thật hoặc nới active coaching/ownership policy.
- Không thể giữ versioning + idempotency trong transaction.
