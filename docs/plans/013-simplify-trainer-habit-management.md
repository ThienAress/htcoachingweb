# Plan 013: Đơn giản hóa quản lý mục tiêu và thói quen của học viên

> **Hướng dẫn thực thi**: Giữ version nội bộ để bảo vệ concurrency và lịch sử,
> nhưng không hiển thị chi tiết kỹ thuật này trên UI. Dừng nếu update Habit yêu cầu
> hard-delete lịch sử hoặc nới ownership hiện có.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — mutation Habit chạm quyền trainer/admin và snapshot hoàn thành
- **Depends on**: 011, 012
- **Category**: feature
- **Planned at**: 2026-07-31
- **Status**: DONE / LOCAL VERIFIED

## Why This Matters

Sidebar HLV đang có nhóm Công cụ dư với luồng quản lý học viên. Wellness Target và
Habit phơi bày version kỹ thuật, trong khi Habit dùng pause/archive làm người dùng
không biết dữ liệu đã đi đâu. UI cần trở về hai thao tác nghiệp vụ rõ ràng: cập nhật
và xóa; backend vẫn phải bảo toàn lịch sử và optimistic concurrency.

## Current State

- `client/src/layouts/TrainerLayout.jsx`: hai nhóm Khách hàng và Công cụ.
- `TrainerWellnessTargetCard.jsx`: hiển thị `Phiên bản N`, nút luôn là `Lưu mục tiêu`.
- `TrainerHabitManager.jsx`: hiển thị `vN`, dùng `HabitDefinitionActions` để pause/archive.
- `coachingHabit.service.js`: create và status tạo immutable version; chưa có update definition.
- `CoachingHabit.commandType`: chỉ cho phép `create | status`.
- Archived Habit bị loại khỏi UI; completion cũ nằm trong Daily Journal snapshot.

## Scope

**In scope**:

- Bỏ nhóm Công cụ khỏi Trainer sidebar, giữ Khách của tôi và Lịch tập khách hàng.
- Ẩn version Wellness/Habit; đổi nút Wellness theo create/update state.
- Thêm update Habit definition có expectedVersion, requestId, ownership và transaction.
- UI Habit chỉ có Cập nhật/Xóa; Xóa dùng archived soft-delete.
- Cập nhật spec, API tests, client tests và tài liệu plan.

**Out of scope**:

- Hard-delete Habit/completion history hoặc migration dữ liệu thật.
- Thay đổi quyền trainer/admin, CSRF, limiter hay retention policy.
- Xóa các route của nhóm Công cụ; chỉ bỏ entry khỏi sidebar.
- Hiển thị màn hình lưu trữ hoặc khôi phục Habit.

## Steps

### Step 1: Chốt contract và test RED

Cập nhật spec canonical. Thêm integration tests cho update success, stale version,
ownership và admin trên active client; test UI presentation không còn version/pause/archive.

**Verify**: focused Vitest phải fail đúng vì endpoint/update UI chưa tồn tại.

### Step 2: Thêm mutation update Habit

Thêm `PUT /api/coaching-habits/:id`, validation, controller và service. Update tạo
immutable version kế tiếp, dùng `commandType: update`, giữ lineage/creator, kích hoạt
lại Habit paused và luôn giữ trainer-created visibility shared.

**Verify**: `npx vitest run src/controllers/__tests__/coachingHabit.integration.test.js`.

### Step 3: Đơn giản hóa UI

Thêm edit form prefilled cho Habit, action Cập nhật/Xóa có confirm xóa, query
invalidation và error/retry. Ẩn version Wellness/Habit và bỏ nhóm Công cụ.

**Verify**: focused client tests, ESLint client và Vite build.

### Step 4: Re-trace và cleanup

Tìm lại mọi consumer của status/version/commandType; kiểm tra backward compatibility,
schema indexes, syntax, debug logs và whitespace.

**Verify**: related server suites, `git diff --check`, client build.

## Test Plan

- Server: trainer/admin update đúng client, trainer ngoài scope bị 403, stale version 409,
  idempotent replay không tạo thêm revision, archived không update được.
- Client: button Wellness create/update, không render version; Habit actions chỉ còn
  Cập nhật/Xóa và edit payload đúng.
- Existing: create/status/completion/streak/privacy tests vẫn xanh.

## Schema Compatibility

`commandType` chỉ mở rộng enum bằng `update`. Document cũ dùng `create/status` vẫn hợp lệ;
không thêm required field, không đổi index, không cần migration hoặc backfill.

## Done Criteria

- [x] Sidebar HLV chỉ còn hai entry quản lý khách hàng (ngoài link Trang chủ).
- [x] Wellness không hiện version; target đã có dùng nhãn Cập nhật mục tiêu.
- [x] Habit không hiện version/pause/archive và chỉ có Cập nhật/Xóa.
- [x] Update đến học viên ngay qua latest version; xóa mềm không phá completion history.
- [x] Focused tests, client lint/Vite build và diff check pass.
- [x] `docs/plans/README.md` đánh dấu DONE sau verification.


## Verification Evidence — 2026-07-31

- Server Habit/Privacy/Streak/Daily Journal: 4 files, 19 tests pass.
- Client Wellness/Habit/workspace: 3 files, 16 tests pass.
- Focused client ESLint pass; server syntax checks pass.
- `npx vite build` pass (2,781 modules).
- Full `npm run build` compile thành công nhưng postbuild prerender 780 route timeout do bốn nguồn local ECONNABORTED; không phải lỗi bundle trong scope.
- `git diff --check` pass; không có debug marker mới.
## STOP Conditions

- Update yêu cầu hard-delete hoặc rewrite Daily Journal completion snapshot.
- Cần nới trainer/admin ownership hay bỏ CSRF/rate limit.
- Cần migration/backfill dữ liệu thật.
- Cùng verification fail ba vòng sau sửa có căn cứ.

## Maintenance Notes

- Version và immutable snapshots là internal contract, không phải UI copy.
- Nếu sau này cần khôi phục Habit đã xóa, xây archive screen riêng thay vì đổi soft-delete.
