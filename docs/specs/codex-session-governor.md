# Spec: Session Governor cho Codex trong HTCOACHINGWEB

## Scope

Yêu cầu ngày 2026-09-09: footer sau mỗi lượt trả lời cuối trong project, đo
dung lượng log thật, khuyến nghị tiếp tục/chuyển task, model ghi nhận và đề xuất
model theo mức khó/rủi ro. Không thay runtime app/client/server, không cài framework
upstream, không sửa config global, không tạo task tự động hoặc rewrite session.

Đây là governance primitive, không phải feature của HT Assistant.
Skill `codex-session-governor`, rule canonical `.agents/rules/workflow/session-governance.md`.
AGENTS chỉ routing ngắn; helper Node built-ins, không thêm dependency.

## REQ-001 — Đo đúng đối tượng, chi phí bounded

- AC-001: dùng exact thread ID từ runtime hoặc user, xác minh session_meta.id;
  không lấy newest session, không đọc database auth/config/token hay message body.
- AC-002: stat bytes (MB=1e6, MiB=2^20), tối đa32 candidate headers64KiB
  cùng threadId (kể cả tên resume có hậu tố), chọn phần có mtime mới nhất sau
  xác minh identity; tail4MiB của phần được chọn tối đa; skip
  oversized line256KiB; báo coverage và số record bị bỏ. Không full JSONL rescan.
  MB footer tổng các phần đã xác minh (physical log, có thể gồm nội dung lặp),
  context/model chỉ từ phần mới. Mỗi call khám phá/stat lại; footer có giờ đo và
  nguồn cũ không được kết luận xanh. Không có post-final hook; đối soát ở lượt sau.
- AC-003: metadata model/effort từ turn_context; context estimate chỉ dùng
  last_token_usage.input_tokens/model_context_window gần nhất, timestamp/scope
  rõ; không dùng cumulative tokens hoặc trừ cached tokens. Stale/switch/compaction
  chưa có sample mới → unknown, không giả số đo live.

## REQ-002 — Footer và recommendation trung thực

- AC-004: footer ngắn có MB, model metadata, continue/checkpoint/new-task/unknown;
  trước khi phát final nên chạy đúng1 lần, không polling/hook bắt buộc.
- AC-005: thresholds local heuristic: context estimate >=70% hoặc log>=50MB
  hoặc >=3 compactions canonical trong15phút → checkpoint; >=85% hoặc log>=200MB
  hoặc symptom history-broken do user/agent quan sát → khuyên task mới tại điểm an toàn.
  Không coi total compactions/interrupted là lỗi. Missing telemetry là unknown,
  tín hiệu rủi ro đã thấy vẫn được ưu tiên; MB không là capacity/context/causal proof.
- AC-006: thiếu ID, ambiguous/mismatched log, lỗi IO, remote task không có local
  rollout → unknown có reason an toàn, không crash/print nội dung log.

## REQ-003 — Model routing không giả execution

- AC-007: lookup rõ/low risk → Luna low; implementation thường → Terra medium;
  planning/debug/architecture phức tạp → Sol high/xhigh; critical/security →
  Astra high/xhigh theo preference của user. Unknown category/risk phải chặn input.
- AC-008: recommended khác observed; không tự switch root/model, tạo thread,
  delegate việc trivial chỉ để giảm model, hoặc downgrade explicit user selection.
  Verify available model/effort từ host trước dispatch. Ultra không mặc định mọi plan.
- AC-009: model history chỉ từ turn_context metadata trong vùng scan có scope;
  worker model phải có execution metadata riêng (không suy ra từ spawn request).
  Không tự tạo ledger raw chat hoặc tự học policy từ vài pass tự khai; v1 read-only.

## REQ-004 — Integration và verification

- AC-010: AGENTS/footer rule, skill metadata, workflow catalog, inventory đồng bộ;
  synthetic Node tests cho identity, partial tail, malformed/truncated lines,
  stale context/model switch, compaction freshness, thresholds, privacy và router.
- AC-011: sources được đối chiếu, phân biệt official guidance/community hypothesis;
  không copy upstream prompt/config/hook; skill forward-test read-only độc lập.

## Boundaries

## Follow-up: conditional multi-model workers (approved 2026-09-09)

User cho phép cấu hình điều phối worker theo phần việc, không đổi root đang chọn.
Recommendation là input cho root; root chỉ dispatch nếu phần việc độc lập, đủ
lớn, context gọn và có verification + ownership. Tiny/sequential/root-already-has-
answer phải root xử lý. Runtime cấm delegation hoặc không có model phù hợp →
không spawn, báo giới hạn; không fallback model mà im lặng.
Complex plan có precision high/ambiguity high/verification low hoặc risk high
ưu tiên Astra; không gắn mọi planning mặc định Sol hoặc luôn Ultra.
Named worker `.codex/agents/ht-*` có model/effort cụ thể, không thay model gốc.
Model unavailable/effort unsupported cần lựa chọn an toàn đã nêu; không auto-loop.
Không coi tổng token nhiều model là tiết kiệm mặc định. Claim actual phải theo
execution telemetry, không theo file TOML hay requested spawn.

Không hứa chữa được bug UI hoặc kéo dài chất lượng vô hạn. Current footer được đo
trước final nên chưa gồm chính final sắp ghi. Footer là instruction best-effort,
không runtime hook đảm bảo chạy khi app crash/turn bị hủy.
Đề xuất handoff tái dùng skill hiện có chỉ khi user đồng ý/chủ động chuyển phase.
Không tự xóa/compact/repair/archive session; không gửi raw log lên web/provider.

## REQ-005 — Conditional multi-model delegation

- AC-012: tiny/sequential/no-verification/no-permission root tự làm; eligible
  workstream có explicit dispatch plan và bounded context, không đổi root model.
- AC-013: precision/ambiguity/verification/risk nâng plan khó sang Astra; user
  worker override được giữ trừ conflict security cần hỏi; unavailable không fallback im lặng.
- AC-014: năm custom role TOML có model/effort rõ, read-only cho exploration/
  planning/review, implementer không nới sandbox; syntax/schema fields kiểm độc lập.
