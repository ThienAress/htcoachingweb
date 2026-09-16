# Plan 088: Add Codex session governor

## Status

- Priority: P1
- Complexity: MODERATE
- Lifecycle: DONE
- Verification: FOCUSED
- Rollout: NOT APPLICABLE
- Owner: root
- Planned at: 2026-09-09
- Updated at: 2026-09-09

## Why / Current state

User yêu cầu xây skill/rule, tham khảo toiuu.txt nhưng không copy nguyên tư vấn.
Root đã xác minh logo087 trong source. AGENTS chưa có footer/session policy;
handoff và context-build đã có, không tạo workflow trùng. Turn_context và token_count
đã quan sát trong rollout cục bộ; metadata là telemetry, không chứng minh backend
model routing hoặc ngữ cảnh live tuyệt đối. Dirty086/087 giữ nguyên.

## Scope

Follow-up được user yêu cầu ngày2026-09-09: cấu hình worker multi-model thực tế
và policy tự phân công có điều kiện. Thêm `.codex/agents/ht-*.toml`, helper
`worker-routing.mjs`, routing tests; rule/AGENTS/skill và spec tương ứng.
Không đặt root/default model global hoặc bỏ sandbox. Giữ khả năng host-specific
dispatch explicit model khi tool không hỗ trợ named agent. Không hứa config đã
hot-load trong task hiện tại. Verify TOML bằng Python tomllib có sẵn; focused
Node tests + một independent read-only worker smoke nếu công cụ cho phép.

AGENTS.md; `.agents/rules/workflow/session-governance.md`;
`.agents/skills/codex-session-governor/` (SKILL,agents/openai.yaml,script2 modules,
test,reference nguồn); workflow-map + inventory; spec này và registry/index088.
Không product code, config global, session raw writes, upstream installs hoặc Git writes.
Trước edits đọc status và preserve existing governance changes.

## Steps

### Step 1: Đo session metadata an toàn

Public seam helper inspectRollout+CLI exactID; RED synthetic tests thiếu feature,
GREEN bounded parser+identity/freshness. Read-only stat/head/tail, strict JSON scalar
allowlist output, skip payload/tool text. Verify Node --test helper test.

### Step 2: Model recommendation + rule/skill footer

Router pure function task/risk/complexity, static preference validated sources;
observed không gộp recommended. Native metadata đủ cho v1, không ledger raw.
Verify routing fixtures và live current-thread footer read-only; scope .agents repo.

### Step 3: Source review, forward-test và delivery

Đối chiếu docs/models/app-server/subagents và README các repo user nêu. Không
coi stars hay claim tiết kiệm token cộng đồng là benchmark project. Independent
forward-test theo skill-creator, không sửa repo. Root vet, fix meaningful findings.
Validate skill metadata bằng quick_validate (nếu runtime dependency đủ), agents
validator, secret/docs-privacy scans và diff check. Không chạy product build/tests
vì chỉ governance/helper; QA focused Node tests là evidence tương xứng.

## Done criteria / commands

- `node --test .agents/skills/codex-session-governor/scripts/session-governor.test.mjs` exit0.
- `node .agents/skills/codex-session-governor/scripts/session-governor.mjs --footer` exact envID hoặc unknown.
- `npm run agents:inventory` rồi `npm run agents:validate` exit0.
- `npm run security:secrets`, `npm run security:docs-privacy`, `git diff --check` pass in-scope.
- Evidence/sources + limitations delivered, current footer included.

STOP: requires user secret, scanning all transcript bodies, replacing global prompt,
modifying rollout/config or auto-created tasks. Permission deny must escalate explicitly,
not write around sandbox. No universal MB-quality guarantee or model-equivalence claim.

## Outcome

### Fix resume telemetry — 2026-09-09

Bug: helper chỉ match `-threadId.jsonl`, bỏ resume `-threadId_sessionId.jsonl`.
Probe filenames + allowlisted session_meta.id chứng minh phần mới cùng task đang
ghi, có model medium và token_count mới, trong khi phần cũ dừng ở11:07.
H1 app không ghi nữa bị bác bỏ; H2 sai discovery suffix được chứng minh;
H3 chỉ thiếu token parser không giải thích model+bytes frozen nên yếu hơn H2.
Hai regression RED (chọn phần cũ/bỏ candidate mới), GREEN sau bounded header
verification+selection. Thêm tests refresh size/model mỗi call, stale không xanh,
aggregate byte threshold. Không sửa/copy raw conversation hoặc Codex state database.
Footer trước final; không hứa post-final hook/realtime UI picker khi runtime chưa ghi.

Follow-up conditional routing hoàn tất: 5 role TOML parse/required-fields PASS;
22 Node tests PASS (telemetry15 + routing7); runtime nhận spawn explicit
gpt-5.6-luna/low và worker trả forward-test (model requested, chưa độc lập xác minh
backend model routing). Rule phân biệt tiny/substantial, user override, model
unavailable, security review, plan precision/ambiguity cao và write-role scope.
Không default/global root model change, không khẳng định hot-load native agents.
Sources chính thức Subagents xác nhận project instructions có thể yêu cầu
delegation và multiagent thường tăng tổng tokens; không hứa giảm quota/chi phí.

- Implemented repo-local skill, canonical rule, AGENTS footer, Node reader/router.
- 15 synthetic Node tests PASS; agents validator30 skills PASS; live exactID
  measured safely with4MiB tail, model configuration and recent input estimate.
- Independent forward-test: noID, explicit Luna/security conflict,205MB unknown
  context correctly stay permission-safe. Stale-model label issue fixed + regression.
- Skill-creator quick_validate.py NOT RUN successfully: bundled Python lacks PyYAML;
  no new dependency installed. Repo metadata validation passed independently.
- No hooks, global config, automatic model switch, ledger raw chat or product edits.
- Footer estimated before final, lower-bound counters scoped tail; no root cause
  guarantee for prior UI failure. Sources/reference describe what was and wasn't verified.
