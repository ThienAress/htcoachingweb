# Plan 077: Harden agent evidence and measure Search quality

> **Hướng dẫn thực thi**: Follow plan step by step, giữ product runtime read-only.
> Chạy verification của từng slice trước khi chuyển bước. Nếu cần nới quyền Git,
> production hoặc sửa file hotfix đã khóa thì STOP.
>
> **Drift check**: kiểm tra Git status và diff của mọi file in-scope trước mỗi patch;
> giữ nguyên thay đổi user có sẵn trong `docs/README.md` và `docs/plans/README.md`.

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: MED
- **Depends on**: 017, 030, 035
- **Category**: security | tests | dx | tech-debt
- **Planned at**: 2026-08-30
- **Lifecycle**: DONE
- **Verification**: LOCAL FULL
- **Rollout**: NOT APPLICABLE
- **Owner**: root
- **Updated at**: 2026-08-31
- **Residual privacy incident**: forward snapshot/candidate gate không rewrite Git
  history; base/remote history vẫn có bốn metadata findings cần authorization riêng.

## Why This Matters

Agent governance hiện có instruction tốt nhưng một số nguồn reference đã stale,
plan state chưa machine-readable, eval chủ yếu kiểm schema và scanners chưa bắt PII
trong handoff. Search cũng chưa có judged-query benchmark nên mọi lựa chọn Fuse/regex/
vector đều thiếu baseline định lượng. Plan này tạo các gate deterministic trước khi
mở rộng autonomy hoặc thay behavior Search production.

## Current State

- `.agents/reference/project-guide.md:595-606` hardcode inventory test dễ stale.
- `.agents/skills/plan-template/SKILL.md:195-211` nêu enum hẹp trong khi
  `docs/plans/README.md` có status free-form ghép lifecycle/verification/rollout.
- `.agents/evals/skills/README.md:3-10` xác nhận eval hiện không gọi model/API.
- `scripts/check-secrets.mjs` và `scripts/check-repository-boundaries.mjs` không có
  category PII tài liệu.
- `client/src/pages/ExercisesPage/exerciseLibraryFilters.js:1-18` là baseline
  normalization + substring cho Search Exercise Library.
- Spec canonical: `docs/specs/agent-harness-reliability-and-search-quality.md`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused governance tests | `npm run test:agents:governance` | exit 0 |
| Agent contracts | `npm run agents:validate` | exit 0 |
| Docs privacy | `npm run security:docs-privacy` | exit 0 |
| Search benchmark | `npm run search:benchmark` | exit 0, JSON report |
| Existing security | `npm run security:secrets` và `npm run security:data-boundaries` | exit 0 |
| Hygiene | `git diff --check` | không có whitespace error mới |

## Scope

**In scope**:

- `docs/specs/agent-harness-reliability-and-search-quality.md`
- `docs/plans/077-harden-agent-harness-evidence-and-search-quality.md`
- `docs/README.md`, `docs/plans/README.md`, machine-readable plan/trace manifests
- Handoff tracked có finding PII đã xác minh
- `.agents/reference/project-guide.md`
- `.agents/skills/plan-template/SKILL.md`
- `.agents/evals/skills/*.json` mới cho workflow critical
- `.agents/scripts/*inventory*`, `*plan-state*`, `*traceability*` và tests tương ứng
- `scripts/*docs-privacy*`, `scripts/search-quality/**` và tests tương ứng
- `package.json`, `.github/workflows/ci.yml` để nối gate

**Out of scope**:

- `client/`, `server/`, `e2e/` runtime và product Search implementation.
- Dependency install, schema/migration, production/staging mutation.
- Năm file observability/monitoring hotfix đã khóa.
- Commit, push, deploy hoặc thay đổi release.

## Steps

### Step 1: Chặn PII trong handoff bằng scanner không echo dữ liệu

Thêm scanner/test, redact finding tracked đã biết và nối gate vào package/CI.

**Behavior**: tài liệu mới chứa email/path cá nhân fail trước khi được tracked; output
đủ actionable nhưng không tái lộ raw value.

**Depends on**: none

**Verify**: focused privacy tests + `npm run security:docs-privacy`.

### Step 2: Tạo inventory, plan-state và traceability contracts

Thêm contract machine-readable backward compatible, bỏ mutable count khỏi reference,
thêm manifest Plan 077 và mutation tests.

**Behavior**: agent/CI phát hiện inventory stale, plan state sai schema và AC chưa có
task/test thay vì dựa vào prose.

**Depends on**: Step 1

**Verify**: focused governance tests + `npm run agents:validate`.

### Step 3: Mở rộng eval critical workflows

Thêm corpora cho feature-spec, plan-template, impact-check, schema-change, code-review
và qa với case positive/negative/adversarial, không đổi model runtime.

**Behavior**: inventory eval phản ánh các workflow critical thay vì chỉ bốn corpus.

**Depends on**: Step 2

**Verify**: `npm run test:agents:eval` + `npm run agents:validate`.

### Step 4: Tạo benchmark Search tiếng Việt offline

Thêm judged fixtures, metric implementation và baseline report cho Exercise Library.
Không sửa function production; benchmark phải cho thấy cả điểm mạnh lẫn no-hit/typo gap.

**Behavior**: quyết định Search sau này có Recall@5/Retrieved Precision@≤5/MRR,
no-result/false-positive và latency baseline deterministic để so sánh.

**Depends on**: none

**Verify**: focused benchmark tests + `npm run search:benchmark`.

### Step 5: Re-trace, review và QA tích hợp

Đối chiếu `REQ/AC → task → test`, đọc toàn diff theo Standards/Spec/Security,
chạy gates liên quan và cập nhật evidence/status trung thực.

**Depends on**: Steps 1-4

**Verify**: governance tests, agent validation, security scans, benchmark và
`git diff --check` đều pass.

## Test Plan

- Privacy: personal email/path fail, placeholder allowlist pass, output redacted.
- Plan/inventory: deterministic ordering, invalid enum/duplicate/missing file fail.
- Traceability: uncovered must-have AC và missing test path fail; Plan 077 pass.
- Agent eval: toàn bộ corpus mới pass contract hiện có.
- Search: known ranking fixture cho Recall@5/Retrieved Precision@≤5/MRR/no-result;
  repeated run identical.

## Done Criteria

- [x] `AC-001` đến `AC-013` đều được trace tới task và verification.
- [x] Không còn mutable test count trong `project-guide` làm source canonical.
- [x] Scanner không echo PII và handoff đã biết được redact.
- [x] Agent eval critical coverage được mở rộng, không giảm corpus cũ.
- [x] Search baseline chạy offline, deterministic và không đổi product behavior.
- [x] Tất cả focused/integration gates của plan pass trên final effective
  working-tree fingerprint.
- [x] `docs/plans/README.md` và machine state phản ánh trạng thái thật.

## Verification Evidence

- Node `22.23.1`: governance/privacy suite `160/160` pass; integrated
  context/supervision/Search suite `107` pass, `2` platform skip hợp lệ trên Windows;
  Agent validation, inventory, context Plan 077/078, privacy/secrets/data-boundaries,
  Search CLI, syntax và diff hygiene đều pass.
- Independent adversarial re-review kết luận PASS sau khi xác minh parser Markdown
  fail-closed, traceability containment, Git provenance và 10 nhóm regression đối kháng.
- Privacy scanner chỉ đảm bảo current candidate/snapshot. Bốn metadata findings trong
  base/remote Git history chưa được xóa; không được diễn giải forward gate là history remediation.
- Scope vẫn khóa ở các path Agent Harness P1/P2 đã inventory, không có file product
  hoặc hotfix.

## STOP Conditions

- File in-scope có thay đổi đồng thời không thể reconcile an toàn.
- Scanner chỉ có thể xanh bằng cách allowlist dữ liệu cá nhân thật.
- Trace gate yêu cầu rewrite toàn bộ historical plans thay vì migration tương thích.
- Benchmark cần dữ liệu production/khách hàng hoặc dependency mới.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Historical plan prose được giữ; machine manifest mới là seam cho automation tiếp theo.
- Search pilot chỉ được chọn sau khi có target metric và authorization boundary riêng.
- P2 `context:build`, QA evidence JSON, worktree lease và supervised state machine sẽ
  dùng plan riêng sau khi Plan 077 ổn định.
- History rewrite/force-push không thuộc plan này; cần incident plan, release freeze,
  remote coordination và authorization rõ ràng trước mọi mutation.
