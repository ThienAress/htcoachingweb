# Plan 091: Modernize GitHub Actions and close release operations

> **Hướng dẫn thực thi**: Giữ application runtime ở Node `22.23.1`; chỉ nâng
> runtime nội bộ của official GitHub Actions. Mọi thao tác Atlas phải read-only
> nếu chưa có owner approval cho paid tier. Không commit/push thay đổi code trong plan này.
>
> **Drift check**: Bắt đầu từ branch `codex/plan-090a-ac009-v2-recovery` tại
> `99f12f1fd35110ef445ec780ce568640ba1fb43f`. Nếu workflow actions hoặc release
> evidence đổi trước khi patch, re-inventory và cập nhật contract test trước khi tiếp tục.

## Status

- **Priority**: P1
- **Complexity**: COMPLEX
- **Effort**: M
- **Risk**: MED — CI supply chain, remote branch cleanup và recovery capability
- **Depends on**: 090A production release closure
- **Category**: tech-debt | tests | operations
- **Planned at**: 2026-09-16
- **Lifecycle**: DONE
- **Verification**: FOCUSED
- **Rollout**: NOT APPLICABLE
- **Owner**: root
- **Updated at**: 2026-09-16

## Why This Matters

Official GitHub Actions cũ chạy trên deprecated action runtime và tạo warning dù
application đã pin đúng Node 22. Release AC-009 cũng cần được đóng bằng evidence
production cuối cùng, dọn branch candidate đã hết vai trò và ghi đúng giới hạn PITR
của Atlas mà không biến logical backup thành continuous recovery.

## Current State

- `.node-version`, `.nvmrc` và root `package.json#engines.node` đều là `22.23.1`.
- 12 workflow còn dùng `checkout@v4`, `setup-node@v4`, `upload-artifact@v4`,
  `download-artifact@v4` hoặc `github-script@v7`; hai workflow security-sensitive
  đang pin immutable SHA.
- Official tags được resolve ngày 2026-09-16: checkout `v5.1.0`, setup-node
  `v5.0.0`, upload-artifact `v6.0.0`, download-artifact `v7.0.0`, github-script
  `v8.0.0`.
- `docs/operations/production/backup-readiness.json` phải giữ
  `continuousRecoveryAvailable=false` cho tới khi paid Atlas backup active và một
  isolated PITR restore drill PASS.
- Hai remote branch candidate đã được dọn là
  `codex/production-candidate-89ac30fc-0916` và
  `codex/production-candidate-89ac30fc-20260916-release`.
- Netlify production primary branch là `main`; published deploy hiện tại là
  immutable deploy `6aaa4bfd61cc19000835e129` của release SHA `89ac30fc...`.
  Bốn GitHub release runs đều có `headBranch=staging`, exact SHA và artifact ID
  riêng; không có open PR từ hai candidate branch.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Workflow contracts | `node --test scripts/release-workflows.test.mjs .github/scripts/incident-remediation-contract.test.mjs` | exit 0 |
| Operations suite | `npm run test:ops` | exit 0 |
| Agent docs | `npm run agents:validate` | exit 0 |
| Secret scan | `npm run security:secrets` | exit 0 |
| Boundary scan | `npm run security:data-boundaries` | exit 0 |
| Backup audit | `npm run audit:backup-readiness` | current logical/off-device evidence PASS; continuous recovery reported separately |
| Remote proof | `git ls-remote --heads origin <exact-ref-1> <exact-ref-2>` | only exact candidate refs are returned before deletion, none after |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- 12 workflows containing the five official actions in the inventory.
- `scripts/release-workflows.test.mjs` and
  `.github/scripts/incident-remediation-contract.test.mjs`.
- Read-only Atlas/recovery audit and exact deletion of two obsolete remote candidate refs.
- Plan 090A closure, plan indexes/state and traceability for this plan.

**Out of scope**:

- `.node-version`, `.nvmrc`, package engines, Docker images, Netlify/Render runtime.
- Purchasing/upgrading Atlas, enabling a paid backup policy or running any restore/mutation.
- Commit/push of the working-tree implementation.
- User-owned local files:
  `client/public/sitemap-content.xml`, `client/public/sitemap-core.xml`,
  `client/public/sitemap-recipes.xml`, `client/public/sitemap.xml`,
  `client/src/generated/systemDependencyManifests.json`.

## Steps

### Step 1: Upgrade official action runtimes without changing application Node

Move tag-based uses to `checkout@v5`, `setup-node@v5`, `upload-artifact@v6`,
`download-artifact@v7` and `github-script@v8`. Move immutable uses to exact SHAs
for the resolved official releases. Add `package-manager-cache: false` to each
setup-node step so v5 automatic caching cannot silently change behavior; existing
explicit `cache: npm` remains explicit.

**Behavior**: GitHub no longer emits Node-20 action-runtime warnings while project
commands continue to execute under `.node-version` Node `22.23.1`.

**Verify**: focused workflow contracts pass and repository search finds no superseded major.

### Step 2: Enforce the runtime contract

Update the immutable-SHA assertions and add a repository-wide contract covering
all affected workflow files, required action majors, Node 22 project pins and
explicit setup-node cache policy.

**Behavior**: a future downgrade, accidental `github-script@v9`, application Node
upgrade or implicit v5 cache opt-in fails locally and in CI.

**Verify**: `node --test scripts/release-workflows.test.mjs .github/scripts/incident-remediation-contract.test.mjs` exits 0.

### Step 3: Verify recovery state without paid or production mutations

Run the canonical backup readiness audit and inspect provider evidence available
without writing production. If Atlas is still Free or backup inactive, retain
`continuousRecoveryAvailable=false` and record the paid owner-decision plus isolated
PITR drill as the remaining non-blocking capability gap.

**Behavior**: release documentation distinguishes verified logical/off-device
recovery from unavailable continuous/PITR coverage.

**Verify**: `npm run audit:backup-readiness` exits 0 and no recovery flag is promoted without evidence.

### Step 4: Remove only obsolete remote release-candidate refs

Re-fetch/read the exact two refs, prove neither is the GitHub/Netlify primary
branch and that the published deploy plus rollback/recovery evidence are keyed
by immutable IDs/SHA rather than branch continuity, then delete only those two
remote refs.

**Behavior**: stale release refs are gone without affecting staging, production or rollback evidence.

**Verify**: exact pre/post `git ls-remote --heads` evidence and deploy configuration proof.

### Step 5: Close AC-009 documentation and deliver reviewed evidence

Append production closure to Plan 090A without deleting historical NO-GO chronology;
record release SHA, candidate/promotion/monitor/observation and provider deploy IDs.
Synchronize README, machine state and traceability, run proportional QA, review the
full in-scope diff and confirm the five protected local files are unchanged by this plan.

**Behavior**: canonical documentation reports the shipped release and remaining
non-blocking PITR gap accurately.

**Verify**: operations tests, agent validation, security scans and `git diff --check` exit 0.

## Test Plan

- Contract tests enumerate every affected official action and reject old majors.
- Immutable workflow tests require exact new SHA plus version comment.
- Node runtime assertions cover `.node-version`, `.nvmrc` and package engines.
- Setup-node assertions require `node-version-file: .node-version` and explicit
  `package-manager-cache: false` while allowing existing explicit npm cache inputs.
- No client release build is run because this task changes no client runtime and
  its lifecycle would rewrite the five protected generated files.

## Verification Evidence — 2026-09-16

- Official release tags were resolved directly from each `actions/*` repository;
  all 71 affected uses match the approved major or immutable release SHA.
- Node `22.23.1` operations suite: `119/119` PASS. The first run correctly found
  one stale Docker checkout SHA assertion; it was updated and the full suite passed.
- `npm run agents:validate`: PASS, 17 manifests / 77 requirements / 178 acceptance
  criteria checked.
- `npm run security:secrets`: PASS. `npm run security:data-boundaries`: PASS,
  zero violations.
- `npm run audit:backup-readiness`: PASS with `releaseReady=true`,
  `disasterRecoveryReady=true`; the separate warning
  `CONTINUOUS_RECOVERY_UNAVAILABLE` remains accurate.
- Exact remote pre-check returned both candidate refs at release SHA `89ac30fc...`;
  post-delete check returned no ref. Published Netlify deploy `6aaa4bfd...`
  remained `ready`, and candidate artifact `10435961917` remained available.
- Root review found no BLOCK/HIGH/MED/LOW issue. Application Node/Docker/provider
  runtime pins have no diff. Client build was intentionally not run because it
  could rewrite the five protected local files.

## Done Criteria

- [x] All affected actions are on the requested Node-24-compatible major/runtime.
- [x] Application Node remains exactly `22.23.1` in all canonical pins.
- [x] Focused contracts and `npm run test:ops` pass.
- [x] Backup audit passes and PITR status is evidence-accurate.
- [x] Only the two named obsolete remote refs are deleted.
- [x] Plan 090A contains immutable production closure evidence.
- [x] Agent/security/diff hygiene gates pass.
- [x] Five protected sitemap/generated files have no task-authored delta.
- [x] No commit or implementation push is performed without a separate Git request.

## STOP Conditions

- Atlas remediation requires a paid tier purchase, production write or restore.
- Either candidate ref is a primary/default branch, has an open PR or is required
  to address the published deploy/release artifacts by immutable ID.
- Verification fails three times after evidence-based fixes.
- A required fix would modify any protected local file.

## Maintenance Notes

- Major tags remain the existing trust model for ordinary workflows; security-sensitive
  workflows retain immutable SHA pins and human-readable release comments.
- Action runtime upgrades are independent from the Node runtime used by project scripts.
- Revisit continuous recovery only through the backup runbook paid-policy and isolated-drill gate.
