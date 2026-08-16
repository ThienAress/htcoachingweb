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

## Production recovery

- Require incident lead and database owner approval.
- Stop writes or place the app in maintenance mode before a point-in-time restore.
- Preserve the damaged database for forensics.
- Rotate credentials used during recovery.
- Re-enable traffic gradually and observe integrity counters and critical workflows.

No backup or restore drill was executed as part of the local code changes. This
document defines the required controlled procedure.
