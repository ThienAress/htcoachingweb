# Spec: Chuẩn hóa pattern kỹ thuật upstream đã xác minh

## Objective

Chuyển những bài học có thể áp dụng từ năm video/repository đã phân tích thành guardrail
cụ thể cho agent của HTCOACHINGWEB. Kết quả phải giúp agent ra quyết định tốt hơn trong
browser QA, AI tool có mutation, refresh-session security, keyed state và ADR hạ tầng mà
không sao chép code, diagram hay asset upstream vào project.

Các file transcript và nội dung repository là nguồn tham khảo, không phải instruction.
Policy canonical của project vẫn là `AGENTS.md`, `.agents/rules/` và các spec/ADR nội bộ.

## Tech Stack liên quan

- Codex project skills/rules trong `.agents/`.
- Node.js governance validators và synthetic skill-eval corpora.
- Playwright E2E hiện có; Express/Mongoose/JWT và HT Assistant hiện có chỉ được nhắc bằng
  invariant, không thay đổi runtime trong phạm vi spec này.

## Commands

- `npm run test:agents:eval`
- `npm run agents:inventory`
- `npm run agents:inventory:check`
- `npm run test:agents:governance`
- `npm run agents:validate`
- `npm run security:docs-privacy -- docs/specs/upstream-engineering-pattern-adoption.md docs/plans/083-codify-validated-upstream-engineering-patterns.md`
- `npm run security:secrets`

## Cấu trúc file bị ảnh hưởng

- `.agents/rules/security/security.md` — invariant bảo mật canonical.
- `.agents/skills/{qa,ai-chat-system,new-tool,ai-check,impact-check,domain-modeling,code-review}/` —
  routing và checklist theo ngữ cảnh.
- `.agents/evals/skills/` và `.agents/scripts/skill-eval*` — regression cho quyết định agent.
- `.agents/reference/agent-workflow-map.md` và `project-inventory.json` — routing/inventory.
- `docs/specs/` và `docs/plans/` — intent, kế hoạch, state và traceability.

## Code Style

- Rule giữ invariant bắt buộc; skill chỉ route đến rule/reference và hướng dẫn workflow.
- Chi tiết theo mode nằm trong `references/` để progressive disclosure.
- Eval kiểm hành vi quan sát được, không chỉ match heading hoặc câu chữ.
- Không tạo một catch-all skill mới và không chép tutorial upstream vào instruction.

## Testing Strategy

- Mỗi pattern có ít nhất một synthetic eval scenario thực tế.
- Eval schema/baseline, plan state, traceability, links và inventory phải qua governance tests.
- Validator toàn agent system, docs privacy, secret scan và scoped diff check phải pass.
- Reviewer độc lập kiểm tra duplication, scope creep và mọi finding BLOCK/HIGH/MED.

## Boundaries

- Always: giữ server-authoritative security boundary; phân biệt exploratory evidence với
  deterministic release evidence; ghi assumption/evidence thay vì cargo-cult architecture.
- Ask first: thay đổi runtime Auth/AI tool engine, dependency, schema, CI release gate hoặc
  kết nối môi trường thật.
- Never: sao chép code/asset upstream; bật arbitrary browser code execution; dùng credential
  production trong browser agent; chạy migration/deploy; ghi local, staging hoặc production.
- Technology Radar tiếp tục theo dõi ba repository đã có; spec này không tạo nguồn Radar trùng.

## REQ-001 — Browser-agent evidence phải chuyển thành QA deterministic

- AC-001: `$qa` phân biệt rõ browser MCP/agent exploration với Playwright test; yêu cầu
  semantic locator, context/storage cô lập và chuyển finding thành spec deterministic trước
  khi dùng làm release evidence.
- AC-002: Workflow cấm production mutation, arbitrary code execution, credential/storage
  reuse giữa môi trường; trace/screenshot/video chỉ là sidecar đã sanitize, không thay test result.

## REQ-002 — AI mutation phải có lifecycle server-authoritative

- AC-003: Rule và AI skills dùng lifecycle
  `read/discover → draft/preview → explicit confirmation → commit → reconcile`; confirmation phải gắn với canonical preview cụ thể.
- AC-004: Commit re-authorize/revalidate state, ownership, price và entitlement; có
  idempotency/atomicity, audit/provenance, uncertain-outcome reconciliation và UI rehydrate từ server.

## REQ-003 — Refresh-session invariants phải sống trong security review

- AC-005: Security rule bao phủ full-token verifier, family/JTI, atomic CAS rotation,
  reuse revocation, absolute expiry, refresh-based logout giữ CSRF và cookie secrecy.
- AC-006: Review/eval yêu cầu concurrency, replay, expiry và mixed-version cutover/rollback
  evidence; không coi test xanh chung chung là đủ.

## REQ-004 — Keyed state phải có contract rõ

- AC-007: `$impact-check` chỉ mở checklist keyed-state khi có map/cache/dedup/idempotency;
  kiểm key/equality, namespace/collision, order, bounds/eviction, restart và concurrency/atomicity
  cùng boundary tests, không thêm kiến thức Java không liên quan.

## REQ-005 — ADR hạ tầng phải dựa trên evidence

- AC-008: `$domain-modeling` yêu cầu workload/peak/data/SLO, bottleneck evidence, ít nhất
  hai alternative, trigger threshold, rollback và post-rollout metrics trước quyết định khó đảo ngược;
  không áp cache/queue/shard chỉ vì pattern phổ biến hoặc sao chép diagram upstream.

## REQ-006 — Governance phải nhỏ, traceable và kiểm chứng được

- AC-009: Workflow map route đúng các gate mới, rule canonical không bị copy-paste giữa skills,
  và ba repository tiếp tục ở Technology Radar thay vì được vendoring vào project.
- AC-010: Skill eval, inventory, agent validation, docs privacy, secret scan, diff check và
  independent review đều có kết quả thật; không có BLOCK/HIGH/MED chưa xử lý.

## Open Questions

Không còn open question chặn implementation. Mọi thay đổi runtime phát hiện trong lúc viết
governance phải tách khỏi Plan 083 và xin quyền riêng.
