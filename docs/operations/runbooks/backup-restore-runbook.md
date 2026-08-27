# Backup And Restore Runbook

## Readiness policy

- `docs/operations/production/backup-readiness.json` is the machine-readable, secret-free pointer to the latest
  verified recovery evidence. It must never contain archive paths, connection strings, keys, checksums, or credentials.
- Run `npm run audit:backup-readiness` for a non-mutating status report.
- Run `npm run verify:backup-release` before a production release or data migration. It fails closed when the latest
  integrity-tested and restore-tested backup is older than 24 hours.
- Run `npm run verify:disaster-recovery` when reviewing workstation-loss readiness. It additionally requires an
  independently recoverable encrypted off-device copy.
- A historical backup record remains valid evidence for its release, but it is not a current recovery point.
- Continuous/point-in-time recovery availability is reported separately. A logical backup must not be described as
  continuous coverage.

## Off-device recovery gate

`offDeviceRecoveryVerified=true` chỉ hợp lệ khi tất cả điều kiện sau được
quan sát trên cùng backup ID:

1. Encrypted archive được copy tới destination khác workstation nguồn và
   destination có owner, retention, access policy rõ ràng.
2. Recovery key được custodian độc lập giữ; key không chỉ được
   bảo vệ bằng DPAPI/profile của workstation nguồn và không nằm cùng
   destination với archive.
3. Operator tải đúng off-device copy về một recovery environment, verify
   checksum/signature, decrypt và restore vào MongoDB cô lập.
4. Collection/document/index fingerprint của isolated restore khớp evidence nguồn;
   production không nhận bất kỳ write nào trong drill.

Không upload archive, key hoặc manifest riêng tư lên Git/public artifact.
Nếu chưa có destination và key custodian được owner phê duyệt, giữ
`offDeviceRecoveryVerified=false`.

### Canonical HTCOACHING off-device destination

- Google Drive owner bắt buộc: `hoangthiengym1999@gmail.com`.
- Destination: `My Drive/htcoachingweb/production-backups`.
- Operator phải xác minh email đầy đủ trên Google Drive account chip ngay trước
  mỗi upload. Nếu đang ở tài khoản khác, kể cả tài khoản gần giống
  `hoangthiengym99@gmail.com`, dừng trước khi chọn file.
- Chỉ encrypted `.7z` archive được upload. Recovery password nằm riêng trong
  Bitwarden; DPAPI key, private manifest, checksum, database URI và plaintext
  archive không được upload lên Drive.
- Off-device drill phải dùng recovery password tải/lấy lại từ Bitwarden. Local
  DPAPI key không được dùng thay cho bằng chứng independent key custody.

## PITR decision gate

Atlas Free không có Cloud Backup/PITR. Chỉ đổi
`continuousRecoveryAvailable=true` sau khi owner duyệt paid tier/backup policy,
Atlas hiển thị backup active, retention/oplog window được ghi lại và một
point-in-time restore đã pass trên target cô lập. Logical `mongodump` không
được dùng thay evidence này.

## Backup

1. Confirm the target cluster, database name, retention policy, encryption, and backup owner.
2. Prefer an Atlas on-demand snapshot. Record snapshot ID, cluster, timestamp, and application SHA.
3. If using mongodump, run it from an approved secure host with a least-privilege account.
4. Store output in encrypted storage; never commit archives or connection strings.
5. Verify backup completion and collection/document counts.
6. Complete an isolated restore/fingerprint comparison, create a secret-free evidence document, then update
   `backup-readiness.json`. Never set a verification flag from an untested assumption.
7. Create and independently recover the encrypted off-device copy before setting `offDeviceRecoveryVerified=true`.

## Restore drill

1. Restore into a new isolated staging cluster, never over an existing production database.
2. Use separate credentials and deny application traffic until verification completes.
3. Run schema/index verification, including npm run verify:phase4-indexes.
4. Compare critical counts and invariants: users, orders, check-ins, coaching days,
   contracts, deposits, wallet transactions, recipes, and Knowledge Base entries.
5. Run server integration tests and critical E2E against the restored environment.
6. Record restore duration, data recovery point, failed checks, and cleanup owner.

## Source repository recovery

1. Use an owner-selected directory outside this repository. A cloud-synced directory only counts as off-device after the artifact is visible and downloadable from a separate provider session or device.
2. Run `node scripts/source-backup.mjs --target-dir <external-directory>`. The command captures all Git refs, the tracked working-tree diff and non-ignored untracked files; ignored files and secrets are excluded.
3. The command performs `git bundle verify`, isolated clone, `git fsck`, worktree overlay restore and per-file SHA-256 comparison before publishing the backup directory.
4. Re-verify a copied package with `node scripts/source-backup.mjs --verify <backup-package-directory>`.
5. On Windows, register the weekly Sunday 03:00 task with `powershell -File scripts/register-source-backup-task.ps1 -TargetDirectory <external-directory>`. The installer requires a successful initial backup before registering the task.
6. GitHub Actions artifacts do not count as independent source recovery because GitHub is already the canonical repository provider.

The source backup manifest may contain source-relative paths and checksums. It must remain with the external backup package and must not be committed. Database connection strings, archives, keys and private database manifests remain prohibited from source backup packages because ignored files are excluded.

## Production recovery

- Require incident lead and database owner approval.
- Stop writes or place the app in maintenance mode before a point-in-time restore.
- Preserve the damaged database for forensics.
- Rotate credentials used during recovery.
- Re-enable traffic gradually and observe integrity counters and critical workflows.

A source archive restore drill was executed against an isolated temporary clone.
No database archive was restored into production, and no failed or unverified
database package is treated as recovery evidence.
