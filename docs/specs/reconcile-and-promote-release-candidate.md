# Đặc tả đối soát và promotion release candidate

## Mục tiêu

Gom đúng các thay đổi local đã được chấp thuận từ những task gần đây thành một release candidate
duy nhất dựa trên `origin/staging` mới nhất. Candidate chỉ được lên production sau khi toàn bộ QA
local, CI, live staging acceptance, backup/recovery gate và quan sát production cùng tham chiếu một
exact 40-character SHA.

## REQ-001 — Provenance và phạm vi candidate

- AC-001: Mọi file được đưa vào candidate phải ánh xạ được tới Plan 077–083 hoặc Plan 084;
  các thay đổi đã deploy từ task cũ không được đưa lại như thay đổi mới.
- AC-002: `.codex-worktrees/`, secret, credential, artifact tạm và file không xác định chủ sở hữu
  không được commit hoặc deploy.

## REQ-002 — Tích hợp và review trên nền staging mới nhất

- AC-003: Candidate phải chứa toàn bộ lịch sử `origin/staging` tại thời điểm khóa candidate và
  không còn conflict marker hay file unresolved.
- AC-004: Review Standards, Spec/Contract và Security/Operations không còn finding BLOCK/HIGH;
  Auth, Wallet, SEO và incident workflow phải giữ đúng các invariant/rule canonical.

## REQ-003 — QA local và recovery readiness

- AC-005: Client/server unit, E2E phù hợp, lint, release build, agent governance, SEO/UI,
  secret/privacy/data-boundary và ops tests đều pass trên cùng candidate fingerprint; SKIP phải có
  blocker và risk rõ, không được đổi thành PASS.
- AC-006: Backup-readiness audit và production release verification phải pass trước promotion;
  recovery evidence phải còn hiệu lực cho release window.

## REQ-004 — Staging acceptance trước production

- AC-007: GitHub CI, Netlify staging và Render staging phải cùng exact candidate SHA, ở trạng thái
  thành công/ready/live.
- AC-008: Live staging acceptance chỉ ghi vào database `htcoaching_staging`, dùng marker cụ thể,
  cleanup trong `finally` và xác minh residue bằng `0`; smoke Auth/Wallet/Profile/SEO không có lỗi chặn.

## REQ-005 — Production promotion và observation

- AC-009: Production approval gate phải dùng đúng candidate artifact, rollback deploy IDs tương
  thích Plan 082 và backup manifest đã xác minh.
- AC-010: Production chỉ deploy exact SHA đã pass staging; sau deploy phải quan sát read-only
  tối thiểu 30 phút và chỉ kết luận KEEP khi post-deploy gate pass.

## Ngoài phạm vi

- Không chạy migration/backfill production trong release này nếu chưa có approval riêng.
- Không tự sửa feature mới ngoài finding trực tiếp chặn candidate.
- Không rollback Auth về binary trước Plan 082.
