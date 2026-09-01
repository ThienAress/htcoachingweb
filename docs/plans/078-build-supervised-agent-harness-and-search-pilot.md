# Plan 078: Build supervised agent harness and Search pilot

> **Hướng dẫn thực thi**: Chỉ triển khai contract/read-only pilot trong scope.
> Mỗi slice phải có mutation tests trước khi nối vào npm/CI. Nếu cần sửa runtime,
> Git state, external service hoặc production thì STOP.
>
> **Drift check**: đọc Plan 077, machine state/trace, QA skill, Search baseline và
> Git status trước mỗi patch; không ghi đè thay đổi ngoài ownership.

## Status

- **Priority**: P2
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: MED
- **Depends on**: 077
- **Category**: tests | perf | dx | tech-debt
- **Planned at**: 2026-08-30
- **Lifecycle**: DONE
- **Verification**: LOCAL FULL
- **Rollout**: NOT APPLICABLE
- **Owner**: root
- **Updated at**: 2026-08-31

## Why This Matters

P1 đã tạo inventory, trace, privacy gate và Search baseline nhưng agent vẫn phải tự
ghép context, QA evidence còn prose-only và file ownership chỉ được phối hợp bằng
hội thoại. P2 bổ sung các seam máy đọc, có giám sát và một Search candidate offline;
đây là bước học từ Hermes mà không nhập runtime tự trị hoặc mở quyền nguy hiểm.

## Current State

- `docs/plans/plan-state.json` và `docs/plans/traceability/077.json` cung cấp nguồn
  plan/requirement machine-readable đầu tiên.
- `.agents/skills/qa/SKILL.md` định nghĩa evidence bằng text nhưng chưa có JSON validator.
- `.agents/rules/workflow/task-orchestration.md` yêu cầu file ownership nhưng chưa có
  overlap evaluator/checkpoint contract.
- `scripts/search-quality/benchmark.mjs` đo baseline fixture v2 report-only:
  Recall@5/MRR `0.50`, Retrieved Precision@≤5 `0.458333` và expected no-result
  false-positive rate `0.50`.
- Spec canonical: `docs/specs/agent-harness-supervision-and-search-pilot.md`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| P2 focused contracts | `npm run test:agent-harness:p2` | exit 0 |
| Context manifest | `npm run context:build -- --plan 078` | JSON, exit 0 |
| Search pilot | `npm run search:pilot` | JSON comparison, thresholds pass |
| Agent validation | `npm run agents:validate` | exit 0 |
| Security | `npm run security:secrets` và `npm run security:data-boundaries` | exit 0 |
| Hygiene | scoped `git diff --check` | không có whitespace error mới |

## Scope

**In scope**:

- Spec/plan/index/machine state/trace của Plan 078.
- `.agents/scripts/context-build*.mjs`.
- `.agents/scripts/qa-evidence-contract*.mjs` và patch nhỏ trong `qa/SKILL.md`.
- `.agents/scripts/agent-supervision-contract*.mjs`.
- `scripts/search-quality/pilot*.mjs`.
- `package.json`, `.github/workflows/ci.yml` để đăng ký focused gates.

**Out of scope**:

- `client/`, `server/`, `e2e/`, product Search implementation và dependency install.
- Git add/commit/push, worktree creation/deletion, deploy hoặc dữ liệu thật.
- Background agent/daemon, external model/provider và production telemetry.
- Năm file hotfix observability/monitoring đã khóa.

## Steps

### Step 1: Build bounded context manifest

Tạo CLI đọc plan-state/trace/spec/plan, kiểm path containment và xuất stable JSON
gồm fingerprint, task/AC map cùng ordered repo-relative read set; không dump content.

**Behavior**: agent có một context contract trước khi implement thay vì search mù.

**Depends on**: Plan 077 artifacts.

**Verify**: context focused tests và CLI Plan 078.

### Step 2: Validate reusable QA evidence as JSON

Tạo closed-schema validator + working-tree fingerprint, mutation tests cho stale,
status/exit mismatch, false release-valid và sensitive metadata; link từ QA skill.

**Behavior**: pre-deploy/ship có thể kiểm schema/fingerprint thay vì tin prose, nhưng
JSON `SELF_ATTESTED` chỉ cho biết release eligibility và không tự cấp release authorization.

**Depends on**: Step 1 only for shared fingerprint vocabulary.

**Verify**: QA evidence focused tests.

### Step 3: Check leases and supervised run checkpoints

Tạo read-only evaluator cho lease overlap/expiry và state machine chỉ cho action
`read/search/test/report`; resume phải giữ context fingerprint và lease available.

**Behavior**: root phát hiện ownership conflict và checkpoint drift trước khi giao/tiếp tục agent.

**Depends on**: Step 1.

**Verify**: supervision focused tests, gồm adversarial transition/action/path cases.

### Step 4: Compare an offline Search pilot against baseline

Tạo pure-JS candidate cho accent/`đ`, token, typo nhỏ, synonym và cross-field;
chạy fixture có hard-negative, report baseline/pilot và enforce Recall/Retrieved Precision/MRR,
no-result/false-positive target P2 mà không sửa production filter.

**Behavior**: có bằng chứng Recall/Retrieved Precision/MRR định lượng để chọn rollout Search ở plan sau.

**Depends on**: Plan 077 Search baseline.

**Verify**: Search pilot tests + CLI report.

### Step 5: Integrate, review and record evidence

Nối scripts vào package/CI, validate trace/state, review ba axis và chạy toàn bộ
focused/security gates. Không nâng P2 thành production rollout.

**Behavior**: P2 có contract dùng lại được và failure mode được CI chặn.

**Depends on**: Steps 1-4.

**Verify**: P2 tests, `agents:validate`, security scans và scoped diff hygiene.

## Test Plan

- Context: stable ordering, invalid ID, traversal, missing artifact, no raw/absolute data.
- QA evidence: valid quick/full, stale fingerprint, exit/status mismatch, SKIP reason/risk,
  unknown/sensitive field và false release eligibility.
- Supervision: exact/ancestor overlap, expired lease, malformed path, invalid transition,
  forbidden action, resume fingerprint drift và input immutability.
- Search: metric targets gồm precision/false-positive, deterministic report, known
  miss classes, hard-negative, cross-field và no-hit safety.

## Done Criteria

- [x] `AC-001` đến `AC-012` có task + verification hợp lệ.
- [x] Context output bounded, repo-relative và deterministic.
- [x] QA evidence contract fail stale/false-eligible, chặn sensitive metadata và QA
  skill không gọi self-attested JSON là release authorization.
- [x] Lease/run contract chỉ read-only, chặn overlap/forbidden transition.
- [x] Search pilot đạt targets nhưng không thay product runtime.
- [x] P2 focused tests, validators và security gates pass trên final effective
  working-tree fingerprint.
- [x] Plan/index/machine state ghi final evidence và trạng thái thật.

## Verification Evidence

- Node `22.23.1`: governance/privacy suite `160/160` pass; integrated P2
  context/QA evidence/supervision/Search suite `107` pass với `2` POSIX-only skip
  hợp lệ trên Windows; context CLI Plan 077/078 và toàn bộ validator/security/Search
  CLI liên quan đều pass.
- Independent adversarial re-review kết luận PASS; regression đã phủ forged lease,
  Git repository override, hidden Markdown contract và stale/false release evidence.
- Product build/unit/E2E không thuộc plan vì P2 không đổi product runtime; Search
  production rollout cần một spec/plan riêng được phê duyệt sau này.

## STOP Conditions

- Cần đọc raw `.env`, database, prompt/content khách hàng hoặc production logs.
- Cần shell executor tùy ý, Git write, external write hoặc auto-deploy để demo.
- Search target chỉ đạt bằng cách sửa fixture/relevance judgment hoặc production code.
- QA evidence chỉ pass bằng cách cho phép stale fingerprint/false release eligibility.
- File ownership overlap với task khác không thể reconcile an toàn.

## Maintenance Notes

- Context pack là manifest read set, không phải bản sao source code.
- QA evidence JSON bổ sung prose human-readable; không thay quyền sở hữu của `$qa`
  và không phải trusted execution attestation.
- Lease registry/pilot state do supervisor cung cấp; evaluator không persist state.
- Checkpoint/resume giữ lease decision lịch sử như record self-attested; chỉ current
  decision được recompute từ current registry/proposal và evaluator không phải distributed lock.
- Search rollout, UI và dữ liệu thật phải có impact-check/spec/plan riêng.
- Context fingerprint chỉ bind plan/spec/verification read set, không bind toàn bộ
  implementation source; khi resume phải phối hợp thêm worktree fingerprint và lease.
