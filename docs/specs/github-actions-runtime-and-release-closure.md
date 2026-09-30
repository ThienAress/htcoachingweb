# GitHub Actions runtime and release closure

## Mục tiêu

Loại warning action runtime deprecated mà không đổi application runtime Node 22,
đồng thời đóng release evidence AC-009 và dọn các release-candidate refs đã hết
vai trò. Continuous recovery phải tiếp tục phản ánh capability thật, không được
suy từ logical backup.

## REQ-001 — Nâng action runtime mà không đổi application runtime

- AC-001: Mọi `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`,
  `actions/download-artifact` và `actions/github-script` trong workflow phải dùng
  major Node-24-compatible đã duyệt; security-sensitive workflow tiếp tục pin
  immutable SHA. `.node-version`, `.nvmrc` và package engine vẫn là `22.23.1`;
  năm file sitemap/generated local không bị task sửa.
- AC-002: Contract test phải fail khi action bị downgrade, `github-script` vượt
  major 8, setup-node không còn đọc `.node-version`, cache policy trở lại implicit
  hoặc application Node rời `22.23.1`.

## REQ-002 — Dọn operations state theo evidence bất biến

- AC-003: Backup readiness audit phải tiếp tục tách logical/off-device recovery
  đã verify khỏi Atlas PITR. `continuousRecoveryAvailable` chỉ được bật sau owner
  approval cho paid policy và isolated point-in-time restore drill PASS.
- AC-004: Chỉ hai remote release-candidate refs đã nêu trong Plan 091 được xóa,
  sau khi xác minh không có open PR và deploy/recovery artifacts vẫn truy cập được
  bằng immutable SHA, deploy ID, run ID hoặc artifact ID.

## REQ-003 — Đóng release và bàn giao có kiểm chứng

- AC-005: Plan 090/090A và production release report phải ghi exact release SHA,
  staging identity, AC-008/AC-009 candidate, promotion, production deploy,
  observation `KEEP`, rollback IDs và PITR limitation. Ops tests, agent validation,
  secret/data-boundary scans và diff hygiene phải pass; không commit/push
  implementation khi chưa có Git request riêng.

## Ngoài phạm vi

- Nâng app lên Node 24 hoặc đổi Docker/Netlify/Render application runtime.
- Mua Atlas tier, bật paid backup, restore hoặc ghi production database.
- Build client làm thay đổi sitemap/generated local đang thuộc user.
