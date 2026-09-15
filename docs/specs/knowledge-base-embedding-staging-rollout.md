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
  conversation A→B khi A đang stream, Stop và provider-failure behavior. Bảy chat
  attempts và hai admin Knowledge Base search tạo metrics phải có signed staging-only
  capability riêng, được runner preregister `issued`, backend CAS `issued → admitted`
  rồi chỉ ghi `settled` sau khi business persistence được acknowledge trên cùng boot UUID
  và exact Render SHA với hai metrics snapshots có timestamp/fingerprint/counters.
  Validator phải tự tính lại delta từ hai snapshot và chứng minh receipt failure của
  từng lane Retry/Edit đã `settled` trước khi recovery tương ứng được `admitted`.
  Receipt inventory phải song ánh với request inventory, mọi fallback delta bằng `0`, cleanup `residue=0`; restart,
  load-balancing, receipt thiếu/thừa/chưa settled hoặc identity mismatch đều fail closed.
  Đây là request-cohort proof riêng cho AC-009, không phải chứng nhận toàn Render chỉ có
  một instance và không được dựng `currentInstances=1` khi provider inventory không có.
  Hard-kill recovery phải revoke trước, chờ và inventory lại exact run; receipt
  `admitted` không terminal là manual blocker và không được xóa/đánh dấu settled.
  Runner phải ghi durable fixture-create journal `pending` trước KB POST và chỉ CAS
  `settled` sau response `201` đã validate đầy đủ. Journal thiếu/pending/malformed là
  `STAGING_AI_RECOVERY_FIXTURE_UNKNOWN`: giữ tombstone/fixtures và không cấp cleanup PASS.

## Quy tắc dừng

- Không có fresh backup/recovery evidence, authenticated staging account hoặc provider budget.
- Digest, source state, snapshot integrity, Atlas definition/status hoặc deploy SHA lệch.
- Bất kỳ bước nào cần production write hay làm lộ URI, key, raw vector hoặc private content.
