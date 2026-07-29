# Plan 003H: Privacy, performance và staged rollout hardening

> Release H hoàn tất Phase 6 sau Release G. Đây là release hardening: không mở rộng sản phẩm,
> không auto-link F1, không chạy migration/retention/production write trong quá trình implement local.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — cross-collection deletion, range query plans, trainer cache và rollout
- **Depends on**: 003G implemented
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / LOCAL VERIFIED — STAGING PENDING

## Scope đã triển khai

- Gom dữ liệu Today/Progress/Collaboration vào một deletion orchestrator có transaction và audit tối thiểu.
- Notification mới giữ retentionExpiresAt null; coaching-end đồng bộ deadline đã duyệt,
  sweep vẫn dry-run/fail-closed tới khi có explicit enforcement flag và admin actor.
- Hard-delete Journal/Weekly/CoachingDay/WorkoutPlan cascade comment revisions và
  notification cùng transaction; admin user deletion rollback toàn bộ khi một bước lỗi.
- Thêm index cho Training Schedule day range, Workout Plan client/status/date và Habit progress history.
- Migration Phase 6 chỉ tạo/verify index, documentsModified bằng 0.
- Read-only explain verifier + 90-day load smoke với P95/payload/query budgets khai báo trước.
- Bound Activity/Progress range loaders để tránh load toàn lịch sử.
- Reset cả active lẫn inactive trainer-private query cache khi trainer overview trả 403;
  current overview bị remove/reset fail-closed và có guard chống purge loop; logout tiếp tục
  queryClient.clear().
- Hợp nhất hai trainer overview endpoint về cùng privacy-filtered read model; client-created
  private habit không xuất hiện ở bất kỳ overview nào.
- Chuẩn hóa trainer access cho cả legacy role và TrainerSubscription còn hiệu lực; subscription
  hết hạn bị thu hồi ngay, dual-scope user/trainer vẫn giữ actor đúng ngữ cảnh.
- Runbook định nghĩa rollout cohort, threshold rollback và feature-flag rollback.

## Tasks

- [x] Re-audit privacy inventory và hợp nhất admin user-deletion path.
- [x] TDD deletion inventory qua các privacy integration suites.
- [x] Trace range queries và thêm index-only migration backward-compatible.
- [x] Tạo explain/index verifier, load smoke và payload budgets.
- [x] Bound Activity/Progress readers; không tạo N+1/populate history.
- [x] Purge active/inactive trainer-sensitive cache và current overview sau 403; xóa toàn bộ
  query cache khi logout.
- [x] Regression test hai trainer overview endpoint không lộ private habit.
- [x] Regression test access matrix legacy trainer/active-expired subscription/dual-scope actor.
- [x] Viết operations runbook, rollout order và rollback thresholds.
- [x] Full client/server QA, lint, build, security và boundary gates.

## Verification evidence

- Phase 6 targeted privacy/index/explain/load suite PASS; migration verifier không backfill.
- Full client 28 files/161 tests và full server 74 files/329 tests: PASS.
- ESLint, production build, prerender 8/8, bundle budget, secrets, data boundaries và contracts: PASS.
- Operations tests 11/11 và Playwright Chromium deterministic mock API 57/57: PASS;
  staging rollout chưa chạy do chưa có target duyệt.
- Không chạy migration, retention enforcement, seed, deploy hoặc production write.

## STOP conditions

- Không chạy migration, staging seed, retention enforcement hoặc production write nếu chưa xác nhận target.
- Retention mặc định 365 ngày đã được duyệt trong spec/Release B; không đổi duration,
  pseudonymization hoặc audit retention ngoài policy, và không bật enforcement khi chưa có
  target, env guard cùng admin actor được duyệt.
- Không auto-link F1 bằng email và không sửa F1 schema trong release này.
- Không bật cohort nếu migration verifier, performance gate hoặc full QA chưa PASS.
