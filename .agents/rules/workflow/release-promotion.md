---
name: release-promotion
description: Policy canonical cho promotion theo exact SHA, live staging acceptance có cleanup, recovery gate và production read-only observation.
---

# Release Promotion — Canonical Safety Policy

Policy này áp dụng cho mọi release HTCOACHINGWEB. Commands và cấu hình chi tiết
nằm tại `docs/operations/runbooks/release-promotion.md`; skills chỉ điều phối và
phải link về hai nguồn này, không tự định nghĩa contract khác.

## Release phases

1. **Local/CI readiness**: `$pre-deploy` + `$ship` có thể kết luận code đủ điều
   kiện deploy staging. Kết quả này không phải production approval.
2. **Staging deployment identity**: Netlify và Render deploy IDs phải được API
   provider xác minh cùng exact 40-character Git SHA và trạng thái ready/live.
3. **Live staging acceptance**: chỉ ghi dữ liệu tổng hợp vào exact database
   `htcoaching_staging`, dùng run marker, cleanup trong `finally` và residue `0`.
4. **Production promotion**: manual protected environment; candidate manifest
   phải nối CI, staging deploys, acceptance, current recovery evidence và hai
   rollback deploy IDs cho cùng SHA. Gate chỉ xác minh, không tự deploy.
5. **Post-deploy observation**: production chỉ GET/HEAD; exact production deploy
   IDs/SHA, monitor evidence và cửa sổ ít nhất 30 phút phải được giữ theo release.

## Invariants bắt buộc

- Production database/origin không bao giờ là target của write acceptance.
- `APP_ENV=staging`, exact `htcoaching_staging`, approved staging API origin và
  confirmation variable phải pass trước connect/request mutating.
- Cleanup chỉ dùng marker/ID/state baseline do chính run đăng ký; không query xóa
  rộng và không xóa seed/customer data.
- Acceptance chỉ PASS khi cleanup verifier báo `verified=true` và `residue=0`.
- CI SHA, client deploy SHA, server deploy SHA và candidate SHA phải giống hệt.
- Candidate recovery backup ID phải bằng manifest recovery hiện tại; release và
  off-device recovery đều ready. Không biến `continuousRecoveryAvailable=false`
  thành tuyên bố PITR.
- Missing, stale, unknown hoặc mismatched evidence luôn fail-closed.
- `GO` không tự cấp quyền commit/push/deploy/migration; authority vẫn theo
  `AGENTS.md` và yêu cầu rõ của user.

## Evidence lifecycle

- Evidence là artifact immutable theo từng workflow run, không phải report tháng
  cũ được sửa tay để tái sử dụng.
- Candidate artifact giữ tối thiểu 30 ngày và không chứa URI database, token,
  cookie, customer payload hoặc provider response raw.
- Một thay đổi code sau QA/candidate làm evidence cũ mất hiệu lực.
- Post-deploy evidence phải thuộc cùng candidate SHA và chỉ được tạo sau cửa sổ
  quan sát; rollback decision giữ manifest/incident riêng.

## Decision contract

- Trước staging: `GO FOR STAGING` hoặc `NO-GO`.
- Trước production: chỉ `GO` khi candidate release gate pass; nếu chưa có live
  staging evidence thì `NO-GO FOR PRODUCTION`, dù local QA xanh.
- Sau production: chỉ `KEEP` khi post-deploy gate pass; nếu monitor fail hoặc
  threshold breach thì theo rollback runbook.
