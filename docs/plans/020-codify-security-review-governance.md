# Plan 020: Codify security review governance

> **Hướng dẫn thực thi**: Chỉ áp dụng các thay đổi skill/rule sau khi user phê duyệt rõ ràng drift audit
> tại `docs/audits/2026-08-02-security-workflow-skill-drift.md`. Không chạy Codex Security có tính phí,
> commit, push hoặc deploy trong bước draft.
>
> **Drift check**: Trước khi apply, đọc lại target skills/rules, `git status --short` và diff của Plan 019.
> Nếu target hoặc security contract đã đổi trong lúc chờ duyệt thì cập nhật draft và xin duyệt lại.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 019
- **Category**: security
- **Planned at**: 2026-08-02
- **Execution**: DONE / LOCAL VERIFIED — STAGING PENDING

## Why This Matters

Plan 019 đã sửa bốn lỗi Auth/F1 cụ thể, nhưng quy trình hiện tại chưa lưu threat model, coverage ledger
và guard chi phí Codex Security thành contract tái sử dụng. Plan này biến các bài học đó thành policy,
workflow và tooling repo-native mà không khiến mọi lần CI/deploy tự động phát sinh chi phí scan.

## Current State

- `.agents/rules/security/security.md`: có Auth, CSRF, JWT, ownership và dữ liệu nhạy cảm; chưa có
  security-review evidence contract hoặc risk-based Codex Security trigger.
- `.agents/skills/audit/SKILL.md` và `audit-playbook/SKILL.md`: bắt buộc evidence `file:line`, nhưng
  chưa xuất coverage ledger và proof-gap ledger.
- `.agents/skills/pre-deploy/SKILL.md` và `ship/SKILL.md`: chạy local gates đầy đủ, nhưng chưa phân biệt
  local security gates với Codex Security scan có cost.
- `.github/workflows/ci.yml`: đã chạy dependency audit, tests, build, secret scan và repository-boundary
  scan trên PR/push/schedule.
- Repository chưa có root `SECURITY.md`, Codex Security runbook hoặc wrapper fail-closed cho scope/cost.
- `docs/audits/security-audit-2026-08-02.md`: ghi nhận Codex Security CLI dừng ở preflight; findings được
  xác minh bằng local audit và regression tests.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Agent system | `npm run agents:validate` | exit 0 |
| Secret scan | `npm run security:secrets` | exit 0 |
| Data boundary | `npm run security:data-boundaries` | exit 0 |
| Wrapper tests | `node --test scripts/codex-security-scan.test.mjs` | exit 0 |
| Wrapper preflight | `npm run security:codex -- --working-tree --dry-run` | chỉ preflight, không bắt đầu paid scan |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Root `SECURITY.md` với threat model, invariants, reportable criteria, exclusions và severity context.
- Manual review của `.agents/rules/security/security.md`.
- Goad-approved updates cho `audit`, `audit-playbook`, `pre-deploy` và `ship` skills.
- `docs/operations/runbooks/codex-security-scan.md`.
- `scripts/codex-security-scan.mjs` và unit test; root `package.json` script.
- Plan/audit/index documentation liên quan.
- Plan 019 release: pre-deploy, staging verification và promote main sau khi mọi gate pass.

**Out of scope**:

- Tự động chạy paid Codex Security trong GitHub Actions.
- Deep/full codebase scan không có scope và cost approval rõ ràng.
- Thay đổi schema, migration, seed/cleanup hoặc dữ liệu staging/production.
- Thay đổi Auth/CSRF/JWT contract ngoài Plan 019.
- `.vscode/` và file user không liên quan.

## Steps

### 1. Phê duyệt instruction-drift audit

- Review GIỮ/XÓA/THÊM/VERIFY trong drift audit.
- Chỉ chuyển sang Step 2 sau khi user gửi approval rõ ràng ở message tiếp theo.

**Verify**: approval được ghi nhận; target/diff chưa drift đáng kể.

### 2. Tạo security context và bounded scan tooling

- Thêm root `SECURITY.md` và runbook vận hành.
- Wrapper mặc định chỉ cho working-tree/diff/path, có `--dry-run`, đặt max-cost thấp và yêu cầu cờ
  explicit cho full/deep/execute.
- Ghi rõ `--max-cost` là estimate guard, không phải hard billing cap.

**Verify**: wrapper unit tests + dry-run exit 0; không tạo scan trả phí trong verification.

### 3. Cập nhật rules và skills theo draft đã duyệt

- Manual patch security rule; không auto-overwrite.
- Thêm coverage ledger, candidate validation, proof gaps và risk-based scan trigger vào workflows.
- Không duplicate lint/mechanical checks đang thuộc CI.

**Verify**: `npm run agents:validate` và targeted `git diff` exit 0/đúng scope.

### 4. Re-trace Plan 019 và tạo release QA evidence

- Re-check OAuth state, refresh cookie-only contract, dev-login fail-closed và F1 assignment ownership.
- Chạy full release build, client/server tests và E2E khi môi trường đủ điều kiện.
- Chạy secret/data-boundary/dependency gates và quick security review với coverage ledger.

**Verify**: pre-deploy kết luận READY; ship kết luận GO hoặc GO WITH WARNINGS không có BLOCK/HIGH.

### 5. Push staging, verify rồi promote main

- Commit chỉ các file trong scope; không stage `.vscode/`.
- Push feature/staging theo lịch sử branch hiện tại, chờ CI và xác minh staging read-only.
- Chỉ promote/push main khi staging pass; xác minh deployment/health sau main.

**Verify**: remote main chứa commit đã duyệt; CI/deployment checks pass; không chạy migration hoặc ghi dữ liệu.

## Test Plan

- Wrapper parser rejects full/deep/execute thiếu explicit acknowledgement.
- Wrapper luôn truyền bounded target và max-cost mặc định; user override phải nằm trong giới hạn policy.
- `npm run agents:validate` kiểm tra frontmatter/references/commands của skills.
- Plan 019 targeted Auth/F1 tests, full server suite, client suite và release build.
- Staging OAuth callback guard và security smoke được kiểm tra read-only.

## Done Criteria

- [x] Drift audit được user approve rõ ràng.
- [x] Root `SECURITY.md`, runbook và bounded wrapper tồn tại, có test.
- [x] Rules/skills ghi coverage ledger, validation/proof gaps và trigger theo risk.
- [x] Không có automatic paid scan trong CI.
- [x] Plan 019 và Plan 020 pass pre-deploy/ship gates local.
- [ ] Staging pass trước main; main push thành công và health checks pass.
- [x] Không migration/seed/cleanup/production data write.
- [x] `.vscode/` được loại khỏi release scope local; kiểm tra lại staged diff trước commit.

## Local verification evidence

- Release build PASS: Vite build, prerender 784/784 routes và bundle budget.
- Client tests: 40 files, 223 tests passed.
- Server tests: 85 files, 382 tests passed.
- E2E: 61 tests passed.
- Ops/wrapper policy: 17 tests passed; Codex Security status `PREFLIGHT ONLY`, không chạy paid scan.
- Secret scan, repository data-boundary scan (0 violations), client/server dependency policy,
  agent validation (22 skills, 0 warnings) và `git diff --check`: PASS.
- Focused security re-trace không có candidate HIGH mới; AI/UI/SEO gates SKIP hợp lệ vì diff
  không chạm các surface đó.

## STOP Conditions

- User chưa phê duyệt drift audit theo checkpoint của `goad`.
- Wrapper cần bypass cost/scope guard để hoạt động.
- Verification fail ba vòng hoặc phát hiện BLOCK/HIGH mới.
- Cần thay đổi Auth/CSRF/JWT semantics, schema hoặc dữ liệu thật ngoài Plan 019.
- Staging/CI không pass hoặc remote branch đã diverge cần merge/rebase ngoài kế hoạch.

## Maintenance Notes

- `AGENTS.md` giữ routing/invariants; security detail nằm ở `SECURITY.md` và canonical security rule.
- Skills mô tả workflow; CI/scripts enforce các kiểm tra cơ học.
- Review lại threat model khi thêm entry point, external integration, auth/payment/wallet flow hoặc dữ liệu nhạy cảm.
