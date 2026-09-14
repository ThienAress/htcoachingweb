# Knowledge Base Embedding Staging Rollout

## Mục tiêu

Đưa Knowledge Base staging từ `legacy-symmetric-v1` sang
`question-answering-v1`, kiểm chứng Atlas Vector Search và giữ rollback đầy đủ,
không ghi production hoặc thay đổi model/quota.

## Phạm vi

- Target duy nhất: `htcoaching_staging`.
- Re-embed root question và mọi question variant bằng provider thật.
- Snapshot vector state cũ phải được mã hóa, lưu ngoài repository và readback trước write.
- Atlas root/nested indexes và Render env chỉ bật sau data verification.
- Fresh production backup chỉ được đọc production và phục vụ release safety gate.
- Final acceptance và authenticated HT Assistant smoke chạy trên staging.

Ngoài phạm vi: production re-embed/index/env, chỉnh nội dung Knowledge Base,
quota/model/auth hoặc relabel vector cũ thành version mới.

## REQ-001 — Re-embed phải staging-only, chống drift và rollback được

- AC-001: Preflight mặc định chỉ đọc, từ chối mọi target ngoài `staging`, exact
  database khác `htcoaching_staging`, và không gọi embedding provider, tạo snapshot
  hoặc ghi MongoDB.
- AC-002: Apply yêu cầu confirmation riêng, reviewed 64-character plan digest,
  encrypted snapshot directory/key; digest được recompute trước provider/write và
  snapshot phải decrypt-readback trước transaction.
- AC-003: Mỗi mutation dùng content/vector-state compare-and-set; provider failure
  xảy ra trước snapshot/write; post-state xác minh count, 768 dimensions và exact
  `question-answering-v1` version.

## REQ-002 — Release và infrastructure cutover phải có evidence chính xác

- AC-004: Guardrail code qua focused/server/security/agent gates, PR merge vào
  `staging`, và GitHub CI, Netlify, Render cùng trỏ tới exact merge SHA.
- AC-005: Backup gate dùng recovery point production mới hơn 24 giờ, encrypted
  archive được recover độc lập từ canonical Google Drive/Bitwarden, isolated restore
  khớp fingerprint và production nhận zero writes.
- AC-006: Atlas root/nested definitions đúng dimension, similarity, filters và
  `nestedRoot`; chỉ set từng Render staging env sau index/query tương ứng PASS.

## REQ-003 — Live acceptance phải giữ fallback và trải nghiệm chat

- AC-007: Re-embed apply/rollback đều có preflight, idempotency, encrypted snapshot
  ID/digest và post-verification; rollback từ chối content hoặc target-vector drift.
- AC-008: Chín staging acceptance flows PASS trên final deploy SHA và cleanup báo
  `residue=0`.
- AC-009: Authenticated live smoke chứng minh citations/source rendering, Retry/Edit,
  conversation A→B khi A đang stream, Stop và provider-failure behavior; root/variant
  fallback metrics không có regression blocking.

## Quy tắc dừng

- Không có fresh backup/recovery evidence, authenticated staging account hoặc provider budget.
- Digest, source state, snapshot integrity, Atlas definition/status hoặc deploy SHA lệch.
- Bất kỳ bước nào cần production write hay làm lộ URI, key, raw vector hoặc private content.
