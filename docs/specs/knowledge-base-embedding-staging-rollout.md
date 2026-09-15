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
  Runner phải ghi durable fixture-create journal trước KB POST. Journal v2 bind exact
  request ID và canonical payload digest; chỉ CAS `terminal/created` sau response `201`
  đã validate đầy đủ, hoặc `terminal/rejected` khi exact request ID nhận
  `400 / KNOWLEDGE_QUERY_SENSITIVE` từ guard trước write. Timeout, 5xx, response JSON lỗi,
  request-ID mismatch và mọi rejection khác vẫn là unknown. Journal thiếu/pending/malformed là
  `STAGING_AI_RECOVERY_FIXTURE_UNKNOWN`: giữ tombstone/fixtures và không cấp cleanup PASS.
  Manual recovery cho journal v2 terminal phải tải exact failed-run artifact nhưng không
  nhận request ID hoặc tạo operator proof; CLI tự xác minh terminal journal cùng
  run/SHA/marker/request/payload binding trong staging trước mọi delete. Journal v2 pending
  vẫn fail closed dù operator có một Render request ID.
  Journal v1 legacy pending chỉ được recovery bằng manual workflow trên environment staging,
  exact failed-run artifact và một Render application-log finish record đã verify qua provider API;
  evidence phải ghi rõ `operator_attested_render_application_log`, không được đổi journal thành created.
  Ngoại lệ compatibility hiện tại chỉ áp dụng incident run `69095c11-7fc9-4047-9414-1b39a2d188e2`,
  SHA `aa2d031d4420ba96d3e34e6fa87fba23e246755a`, workflow run `34961418907` và request
  `1cba3e75-db0d-40dc-aa88-186ab6901fe9`. Provider GET exact deploy dưới exact service phải
  khớp ID/SHA/completion chronology; không suy full active interval từ deploy detail.
  Mọi record/label malformed, duplicate hoặc không khớp trong response query đều fail closed.
  Operator attestation không được áp dụng journal v2 pending, kể cả request ID khớp.
  Recovery report v2 giữ proof method cùng canonical evidence digest; prior report v1 hợp lệ
  vẫn được đọc, nhưng không được nâng thành operator proof. Retry workflow chỉ dùng prior report
  từ immutable artifact của exact successful manual staging recovery run/attempt đã verify provenance,
  rồi quiescence/inventory/cleanup lại; missing journal không có verified report vẫn là manual blocker.

## Quy tắc dừng

- Không có fresh backup/recovery evidence, authenticated staging account hoặc provider budget.
- Digest, source state, snapshot integrity, Atlas definition/status hoặc deploy SHA lệch.
- Bất kỳ bước nào cần production write hay làm lộ URI, key, raw vector hoặc private content.
