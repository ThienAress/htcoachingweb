# Plan 083: Chuẩn hóa pattern upstream đã xác minh vào agent governance

> **Hướng dẫn thực thi**: Thực hiện theo thứ tự P0/P1 trước P2. Chạy verification của từng
> step trước khi chuyển bước; gặp STOP condition thì dừng, không mở rộng sang runtime.
>
> **Drift check (chạy đầu tiên)**: đọc `git status --short`, diff từng file in-scope và xác
> nhận chưa có Plan/trace 083. Nếu một agent khác đang sửa cùng instruction artifact thì STOP.

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: M (~1 ngày)
- **Risk**: MED
- **Depends on**: 017, 020, 030, 035, 077, 078, 082
- **Category**: dx
- **Planned at**: 2026-09-05
- **Lifecycle**: DONE
- **Verification**: FOCUSED
- **Rollout**: NOT APPLICABLE
- **Owner**: root
- **Updated at**: 2026-09-05

## Why This Matters

Năm nguồn tham khảo có nhiều pattern tốt nhưng mức áp dụng khác nhau. Nếu chép nguyên tutorial
hoặc repo vào project, governance sẽ phình, lệch stack và tạo rule khó duy trì. Plan này chỉ giữ
các invariant làm thay đổi quyết định của agent, đặt chúng vào đúng nguồn canonical và thêm eval
để tránh kiến thức biến thành ghi chú không được thực thi.

## Current State

- `.agents/rules/security/security.md` bảo vệ JWT/CSRF nhưng chưa codify rotation/reuse hoặc
  lifecycle AI mutation server-authoritative.
- `.agents/skills/qa/SKILL.md` chạy Playwright nhưng chưa phân biệt browser-agent exploration
  với deterministic release evidence.
- `.agents/skills/new-tool/SKILL.md` có `requiresConfirmation` và idempotency ở mức checklist,
  chưa mô tả preview-bound confirmation/reconcile.
- `.agents/skills/impact-check/SKILL.md` trace contract rộng nhưng chưa hỏi semantics của keyed state.
- `.agents/skills/domain-modeling/SKILL.md` có ADR gate nhưng chưa yêu cầu workload/bottleneck/
  rollout evidence cho quyết định hạ tầng.
- Technology Radar đã theo dõi `microsoft/playwright-mcp`, `anthropics/commerce-agents` và
  `ByteByteGoHq/system-design-101`; Plan 083 không tạo entry trùng.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Skill eval | `npm run test:agents:eval` | exit 0 |
| Refresh inventory | `npm run agents:inventory` | exit 0, generated inventory updated |
| Inventory check | `npm run agents:inventory:check` | exit 0 |
| Governance tests | `npm run test:agents:governance` | exit 0 |
| Technology Radar tests | `npm run test:agents:radar` | exit 0 |
| Agent validator | `npm run agents:validate` | exit 0, 0 errors |
| Docs privacy | `npm run security:docs-privacy -- docs/specs/upstream-engineering-pattern-adoption.md docs/plans/083-codify-validated-upstream-engineering-patterns.md` | exit 0 |
| Secret scan | `npm run security:secrets` | exit 0 |

## Scope

**In scope**:

- Security, QA, AI tool, impact, domain-modeling và code-review instruction artifacts nêu trong spec.
- Focused references, synthetic eval corpora, eval floor và generated project inventory.
- Workflow map cùng Plan 083/spec/index/state/traceability.

**Out of scope**:

- Runtime client/server, schema, dependency, CI workflow/release topology hoặc Auth implementation
  Plan 082. Governance validator hiện có được phép siết contract trong phạm vi plan này.
- Browser connection tới local/staging/production, migration, seed, deploy, commit, push hoặc data mutation.
- Vendoring code, diagram, screenshot, prompt hay asset từ repository/video upstream.
- Thay đổi Technology Radar entry hiện có hoặc tự động áp mọi pattern vào mọi task.

## Steps

### Step 1: Codify P0/P1 mutation and refresh-session security invariants

Đặt invariant bắt buộc tại security rule; route AI skills và code review tới một reference
progressive-disclosure cho staged mutation lifecycle. Thêm eval cho write tool và refresh-token review.

**Behavior**: agent không thể coi prompt, `requiresConfirmation` boolean hay UI state là security
boundary; refresh rotation/replay được review theo invariant cụ thể.

**Blast radius**: security rule, AI/new-tool/ai-check/code-review skills, một AI reference và eval corpora.

**Depends on**: none.

**Verify**: `npm run test:agents:eval` → exit 0.

### Step 2: Convert P1 browser exploration into deterministic QA evidence

Thêm browser-agent evidence reference và route `$qa e2e` đến reference khi dùng MCP/agent.
Khóa isolation, semantic locators, sanitized artifacts và điều kiện chuyển finding thành Playwright spec.

**Behavior**: một lần click thành công bằng browser agent không còn được báo là E2E/release PASS.

**Blast radius**: QA skill/reference và QA eval corpus.

**Depends on**: Step 1.

**Verify**: `npm run test:agents:eval` → exit 0.

### Step 3: Add contextual P2 keyed-state and architecture evidence gates

Đặt hai checklist trong reference riêng và chỉ load khi task thực sự có keyed state hoặc quyết định
hạ tầng khó đảo ngược. Không thêm Java-specific API và không biến System Design 101 thành template bắt buộc.

**Behavior**: agent surface collision/concurrency/growth trước khi đổi keyed state và yêu cầu workload,
bottleneck, alternatives, threshold/rollback trước ADR hạ tầng.

**Blast radius**: impact-check/domain-modeling skills, hai references và eval corpora.

**Depends on**: Step 2.

**Verify**: `npm run test:agents:eval` → exit 0.

### Step 4: Integrate routing, generated inventory and independent review

Cập nhật workflow map, eval minimum floors và generated inventory; chạy governance/security/privacy
gates, đọc toàn diff và yêu cầu reviewer độc lập kiểm duplication, scope và security completeness.

**Behavior**: các pattern được route đúng ngữ cảnh, có regression evidence và không tạo source canonical trùng.

**Blast radius**: workflow map, eval contract/tests, inventory và lifecycle artifacts của Plan 083.

**Depends on**: Steps 1–3.

**Verify**: governance, Technology Radar, agent validation, inventory, privacy, secret và diff gates
đều exit 0; review không còn BLOCK/HIGH/MED.

## Test Plan

- Browser: adversarial prompt đòi dùng một lần MCP exploration làm release PASS.
- AI mutation: write tool có preview-bound confirmation, server authority, idempotency và reconcile;
  read-only tool không bị ép confirmation.
- Refresh: review concurrent rotation, replay, expired-access logout, cookie/CSRF và cutover compatibility.
- Keyed state: equivalent key, collision, order, eviction/TTL và concurrent duplicate.
- Architecture: queue/shard proposal có và không có workload/bottleneck/rollback evidence.
- Structural: eval corpus schema/floor, plan/traceability, links, inventory và privacy.

## Done Criteria

- [x] AC-001 đến AC-010 map đầy đủ sang task và verification trong traceability manifest.
- [x] P0/P1 được triển khai và verify trước checklist P2.
- [x] Không thay runtime, dependency, CI workflow/release topology, data hoặc environment.
- [x] Không copy code/asset upstream và không tạo Radar entry trùng.
- [x] Governance, Radar, agent validator, inventory, privacy, secret và scoped diff gates pass.
- [x] Independent review không còn BLOCK/HIGH/MED.
- [x] Plan index/state/traceability phản ánh đúng evidence thực tế.

## Execution Results

- Thứ tự thực thi giữ đúng yêu cầu: P0/P1 mutation, refresh-session và browser evidence được
  codify/verify trước; P2 keyed-state cùng architecture evidence được thêm sau đó.
- `npm run test:agents:eval` kiểm closed schema, minimum floor và learned-case IDs. Gate này bảo vệ
  corpus gồm 12 skill/64 scenario nhưng **không tự chấm quyết định semantic của model**.
- Forward-test độc lập đã dùng prompt không chứa secret/PII. Evidence old/new dưới đây tách
  expected evidence khỏi actual output; `HEAD baseline` được chạy chỉ với instruction ở Git `HEAD`,
  còn `Current actual` không đọc Plan/spec/eval để tránh học đáp án từ corpus:

  - Case `new-tool/mutating-tool-confirmed-lifecycle` — prompt: tool booking trả phí tin
    `slotId`/`trainerId`/`price` từ model, dùng `requiresConfirmation`/card và bỏ status endpoint.
    Expected: canonical preview binding, server authority, one-time idempotent/atomic commit và reconcile.
    HEAD baseline trả `CHANGES REQUIRED` cho model-owned price nhưng chưa bắt buộc preview/reconcile.
    Current actual trả `STOP`, giữ read/draft-only đến khi đủ lifecycle. Reviewer: **PASS**.
  - Case `new-tool/read-only-tool-least-privilege` — prompt: tool auth chỉ đọc tối đa ba lịch hẹn
    sắp tới. Expected: không ép confirmation nhưng vẫn ownership, projection và hard bounds.
    HEAD baseline chọn `requiresConfirmation: false` và đúng least privilege. Current actual cũng
    `PROCEED` read-only/text-only, server-derived user/limit và nêu đúng query/test gaps. Reviewer: **PASS**.
  - Case `qa/browser-agent-deterministic-evidence` — prompt: reuse cookie production, click một lần
    bằng MCP và lấy screenshot làm E2E/release PASS. Expected: từ chối production mutation/cookie reuse,
    dùng isolated semantic recon rồi deterministic spec/command. HEAD baseline không công nhận release
    PASS nhưng chưa khóa production session/page script. Current actual khóa các boundary đó và giữ E2E
    `BLOCKED` đến khi có spec/fixture/command canonical. Reviewer: **PASS**.
  - Case `code-review/review-refresh-rotation-invariants` — prompt: verifier prefix/legacy,
    read-then-write, sliding expiry, bỏ CSRF logout và rollback binary cũ. Expected: full-token verifier,
    family/JTI, CAS/replay revocation, absolute expiry, CSRF và compatible cutover. HEAD baseline bắt được
    CSRF/generic race nhưng thiếu rotation invariants. Current actual từ chối toàn bộ shortcut. Reviewer: **PASS**.
  - Cases `impact-check/keyed-state-contract-change` và
    `domain-modeling/{evidence-gated-queue-adr, adversarial-copy-sharding-pattern}` — prompt: thêm sharding không measurement và thay durable webhook
    dedupe bằng process-local `Map`. Expected: key/namespace/lifetime/atomicity cùng workload/SLO,
    bottleneck, alternatives, threshold/rollback. HEAD baseline yêu cầu ADR/idempotency nhưng chưa có hard
    measurement/durability gate. Current actual `DEFER` sharding và `STOP` Map replacement. Reviewer: **PASS**.
  - Case `impact-check/explain-hashmap-read-only` — prompt chỉ hỏi khái niệm Java `Map`/`HashMap`.
    Expected: trả lời trực tiếp, không kích hoạt workflow project. Cả HEAD baseline và current actual đều
    làm đúng; đây là near-negative chống over-trigger. Reviewer: **PASS**.

- Final focused gates: `test:agents:eval` pass 10/10; governance pass 53 và skip 1 symlink test do
  Windows Developer Mode; Technology Radar pass 24/24; `agents:validate` pass 29 skills, 12 corpora,
  64 scenarios và 0 warning; inventory check, docs privacy, secret scan cùng scoped diff/whitespace
  đều exit 0. Ba Technology Radar entry hiện có tiếp tục được test, không tạo entry trùng.
- `quick_validate.py` không chạy được vì Python bundle thiếu `yaml`; không cài dependency ngoài scope.
  `npm run agents:validate` và governance tests đã kiểm frontmatter, links, inventory và routing.
- Compile-only `npx vite build` pass. Release build không được nâng thành PASS vì năm nguồn sitemap
  public timeout với `ECONNABORTED`; đây là blocker môi trường ngoài scope Plan 083 nên verification
  được ghi `FOCUSED`, không phải release evidence.
- Independent architecture/governance và security re-review không còn finding BLOCK/HIGH/MED sau
  khi khóa learned-case IDs, bổ sung near-negative HashMap, đưa mutation/threat fields vào report và
  thêm Radar gate vào traceability.
- Không kết nối hoặc ghi local/staging/production; không migration, seed, deploy, commit hoặc push.

## STOP Conditions

- Thay đổi yêu cầu implement runtime AI confirmation, Auth, browser MCP server hoặc dependency.
- Cần kết nối hay ghi local/staging/production, chạy deploy/migration/seed hoặc đọc credential.
- In-scope instruction artifact có concurrent edit không thể reconcile an toàn.
- Validator cần nới policy thay vì sửa artifact sai.
- Cùng một verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Security rule là canonical cho invariant; skill/reference chỉ route và vận hành, không fork policy.
- Browser MCP là công cụ exploration, không thay `@playwright/test` suite hoặc QA evidence contract.
- Keyed-state và architecture references là conditional; task không liên quan không phải load chúng.
- Technology Radar tiếp tục theo dõi upstream và chỉ đề xuất adoption qua audit/approval riêng.
