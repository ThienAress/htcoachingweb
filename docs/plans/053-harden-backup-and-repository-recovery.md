# Plan 053: Harden production backup and repository recovery

> **Hướng dẫn thực thi**: Thực hiện từng step và chỉ đánh dấu verification khi lệnh thật sự pass. Không restore đè production, không đưa credential/archive/checksum private vào Git, không mua hoặc nâng cấp dịch vụ trả phí nếu owner chưa xác nhận chi phí.
>
> **Drift check**: Chạy `git status --short`, `git rev-parse HEAD`, `npm run audit:backup-readiness` và kiểm tra GitHub branches trước khi thay đổi. Dừng nếu target production hoặc owner account không khớp facts bên dưới.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 020, 046, 052
- **Category**: security / operations
- **Planned at**: 2026-08-17
- **Status**: IN PROGRESS — GITHUB OWNER AUTH AND DATABASE CLOUD APPROVAL REQUIRED

## Why This Matters

Source code hiện chỉ có một remote GitHub, hai branch quan trọng chưa có bằng chứng protection, còn production database chỉ có logical backup đã cũ hơn policy 24 giờ. Bản backup database gần nhất phụ thuộc Windows DPAPI cùng workstation nên không bảo vệ được tình huống mất máy. Plan này tạo ba lớp độc lập: recovery point dữ liệu còn mới, repository không dễ bị force-push/xóa, và source archive có thể restore ngoài working copy hiện tại.

## Current State

- HEAD khi lập plan: `2276611fac870ec970c3c1dd43e9b7be37634dbc`; working tree đang dirty vì Chat UI và HT Fitness+ chưa commit, phải được snapshot mà không stash/commit/reset.
- `origin` là `https://github.com/ThienAress/htcoachingweb.git`; default branch public là `main`, local branch là `staging`.
- GitHub CLI đã cài nhưng device authorization chưa hoàn tất với owner `ThienAress`; browser hiện đăng nhập account `ThienHermec`, không có bằng chứng quyền admin để áp ruleset.
- `docs/operations/production/backup-readiness.json` trỏ tới logical backup hoàn tất `2026-08-12T10:55:16.609Z`; integrity và isolated restore pass nhưng `offDeviceRecoveryVerified=false`, `continuousRecoveryAvailable=false`.
- `npm run audit:backup-readiness` báo backup quá 24 giờ và chưa có bản off-device độc lập.
- MongoDB Atlas CLI xác nhận đang signed out. Render CLI đã xác minh owner email, workspace `tea-d1mahp2li9vc7399j8d0` và production service `srv-d70gd0fafjfc73csn9ag` (`htcoachingweb`, branch `main`) mà không in giá trị env.
- MongoDB Database Tools 100.17.0, 7-Zip 26.02 và MongoDB Community 8.2.12 portable đã sẵn sàng; Community ZIP khớp SHA-256 công bố bởi MongoDB.
- Source backup `htcoachingweb-source-20260817T102325Z` đã được tạo trong OneDrive sync directory và pass isolated clone, `git fsck`, overlay restore cùng fingerprint. OneDrive client đang chạy, nhưng chưa có retrieval từ provider session/device độc lập.
- `.github/workflows/ci.yml` có bốn check jobs: `client`, `server`, `secrets`, `e2e`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Readiness audit | `npm run audit:backup-readiness` | JSON secret-free; exit 0 in audit mode |
| Source backup test | `node --test scripts/source-backup.test.mjs` | All tests pass |
| Create source backup | `node scripts/source-backup.mjs --target-dir <off-device-sync-dir>` | Bundle/worktree archive and restore drill pass |
| Ops tests | `npm run test:ops` | Exit 0 |
| Secret boundaries | `npm run security:secrets && npm run security:data-boundaries` | Exit 0 |
| Workflow syntax/contracts | `npm run agents:validate` | Exit 0 |
| Diff integrity | `git diff --check` | Exit 0 |

## Scope

**In scope**

- Provider-neutral source backup/restore script covering committed refs plus dirty tracked/untracked source files allowed by Git.
- Windows scheduled-task installer targeting an owner-selected cloud-synced/off-device directory without storing its path in Git.
- Daily GitHub Actions readiness gate that reports stale database recovery evidence without accessing production secrets.
- GitHub protection for `main` and `staging`: no force-push/delete and required CI status checks, applied only from an owner session.
- Fresh production database backup, isolated restore, portable encryption/off-device verification and readiness evidence when production credentials are available.
- Decision gate for Atlas automated/continuous backup based on owner-approved cost.

**Out of scope**

- GitLab mirror, production database restore, migration/seed/cleanup, application deploy, commit or push.
- Storing database archives, source archives, credentials, private manifests, recovery keys or external paths in Git.
- Paid Atlas upgrade without explicit financial confirmation.

## Steps

### Step 1: Create verifiable source recovery archives

**Behavior**: One command creates a Git bundle of all refs, captures the current tracked diff and non-ignored untracked files, computes an archive checksum, restores into an isolated temporary directory, applies the worktree overlay and confirms source fingerprints. It fails closed when the target is inside the repository or verification differs.

**Blast radius**: `scripts/source-backup.mjs`, `scripts/source-backup.test.mjs`, `package.json`, backup/restore runbook.

**Depends on**: none.

**Verify**: focused script tests plus a real archive/restore drill into a temporary target.

### Step 2: Schedule source backup to independent storage

**Behavior**: A guarded PowerShell installer registers a weekly current-user task that calls the verified source backup script with an owner-selected target. No credentials or absolute owner path enter Git. A first manual run must pass before registration; sync status and recovery from the provider are recorded separately.

**Blast radius**: schedule installer, source recovery runbook and local Task Scheduler state.

**Depends on**: Step 1 and an available cloud-synced/off-device target.

**Verify**: inspect scheduled task action/trigger, run it once, then restore from the resulting archive. Do not mark independent cloud recovery until the artifact is visible/downloadable from another session/device.

### Step 3: Monitor database recovery freshness

**Behavior**: A daily/manual workflow runs the existing release and disaster-recovery gates and opens one deduplicated GitHub issue when recovery evidence is stale or not off-device recoverable. It never receives database credentials and cannot create a false verified record.

**Blast radius**: `.github/workflows/recovery-readiness.yml`, existing operations tests and runbook.

**Depends on**: none.

**Verify**: workflow contract/source test, YAML review, ops tests and secret scan.

### Step 4: Apply GitHub repository protection

**Behavior**: `main` and `staging` reject force-push and deletion. `main` requires pull-request flow and the stable CI contexts `client`, `server`, `secrets`, `e2e`; `staging` uses the same checks unless recent Actions evidence proves a context is not emitted for its merge flow. Admin bypass remains disabled where the account plan supports it.

**Blast radius**: live GitHub repository settings only; no Git refs are modified.

**Depends on**: owner/admin GitHub session and observed successful check context names.

**Verify**: GitHub rules UI/API shows active rules for both branches; a non-destructive ruleset evaluation confirms force-push/delete are blocked. Do not test by deleting or force-pushing a branch.

### Step 5: Refresh production backup and establish off-device recovery

**Behavior**: From an approved secure host, create a fresh Atlas snapshot when supported or encrypted logical `mongodump`; verify archive integrity, isolated restore, data/index fingerprints and collection/document counts. Store the encrypted archive off-device with a recovery key that does not depend solely on the original Windows profile, retrieve it independently, repeat integrity/restore verification, then update the secret-free evidence and readiness manifest.

**Blast radius**: private backup storage, temporary isolated MongoDB, production read traffic, new production evidence document and `backup-readiness.json`. Production writes remain zero.

**Depends on**: correct Atlas/Render owner access, database tools, target confirmation and independent key custody.

**Verify**: `npm run verify:backup-release` and `npm run verify:disaster-recovery` both exit 0. Continuous recovery is true only when Atlas actually reports the feature enabled.

### Step 6: Decide continuous recovery tier

**Behavior**: Confirm current Atlas tier and cost. Keep daily logical backup as the immediate RPO control; choose Flex for Atlas-managed snapshots or M10+ with Continuous Cloud Backup for point-in-time recovery. Any paid change requires owner confirmation at the final billing screen.

**Blast radius**: Atlas billing and backup policy only.

**Depends on**: Atlas owner login and explicit cost approval.

**Verify**: Atlas Backup page shows actual snapshot policy; for M10+, verify Point in Time Restore window. Update evidence from observed state, not intent.

## Test Plan

- Source backup rejects a target inside the repository and a missing Git repository.
- Clean and dirty fixture repositories restore branch/tag refs, binary tracked changes and non-ignored untracked files.
- Corrupted archive/checksum fails verification.
- Readiness workflow contains only read-only repository checkout plus issue reporting; no production secrets.
- Existing backup readiness tests continue to reject stale, unverified and secret-adjacent manifests.

## Done Criteria

- [x] Source archive captures refs and current non-ignored working tree, then passes isolated restore/fingerprint verification.
- [ ] Weekly local schedule exists and has one successful run to the selected sync directory.
- [ ] Independent source copy has been downloaded/read from a separate provider session or device and restore-tested (local OneDrive sync copy đã restore-test, nhưng chưa đủ điều kiện độc lập).
- [x] Daily recovery-readiness workflow is valid and ready to run after push.
- [ ] GitHub `main` and `staging` show force-push/delete protection and required CI checks.
- [ ] Fresh production database backup passes integrity and isolated restore verification.
- [ ] Database archive and portable recovery key pass independent off-device recovery.
- [ ] `verify:backup-release` and `verify:disaster-recovery` pass.
- [ ] Atlas continuous recovery status is documented accurately; any paid upgrade has owner approval.
- [ ] Ops tests, secret/data-boundary scans, agent validation and `git diff --check` pass.
- [x] `docs/plans/README.md` reflects the current truthful status.

## Local Verification Evidence

- `npm run test:source-backup`: `4/4` tests passed after fixture restore, target-boundary and corruption checks.
- `npm run test:ops`: `31/31` operations tests passed.
- Source backup `htcoachingweb-source-20260817T102325Z` của dirty `staging` working tree đã hoàn tất isolated clone, `git fsck`, overlay restore và file fingerprint comparison trong OneDrive sync directory.
- Workflow YAML parsed successfully with the installed `js-yaml` dependency; both PowerShell files passed parser validation.
- Scheduled Task chưa được đăng ký vì owner chưa xác nhận lịch chạy. OneDrive source copy đã có nhưng chưa được xem là off-device verified cho tới khi tải lại từ session/device độc lập.
- Live GitHub rules vẫn pending vì device flow chưa xác thực owner `ThienAress`. Atlas signed out; Render production target đã được xác minh. Thử nghiệm fresh logical backup đã fail closed ở bước kiểm tra encrypted archive, mọi plaintext/package chưa xác minh đã được xóa và readiness manifest không bị cập nhật sai.

## STOP Conditions

- Production target/database cannot be proven as `gym-app`, or available account differs from the recorded owner environment.
- Backup would require printing/copying a connection string, token, archive password or recovery key into chat/Git.
- Isolated restore cannot be guaranteed; never restore into production or the developer database.
- Browser session lacks GitHub/Atlas/Render owner privileges.
- Atlas asks for a paid upgrade or billing confirmation not explicitly approved by the owner.
- Cloud sync visibility cannot be verified independently; retain `offDeviceRecoveryVerified=false`.

## Maintenance Notes

- Git bundles cover repository history; worktree overlays are included specifically because this project may have reviewed but uncommitted work. Ignored files and secrets remain excluded.
- A GitHub Actions artifact is not treated as independent source backup because it shares the same provider as the canonical repository.
- The daily readiness workflow detects stale evidence; it does not manufacture backups.
- Logical backups reduce RPO only at their schedule frequency. They are not equivalent to Atlas point-in-time recovery.
