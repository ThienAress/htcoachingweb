# Production Backup Record

Date: 2026-08-24
Status: completed and locally verified; current backup not yet independently recovered off-device
Base release candidate: `9d419d464e1194c143a1276a75b058490d693a41`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260823T173906Z`
- Completed at: `2026-08-23T17:40:25.506Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup/verification: zero

## Integrity And Local Isolated Restore

- Source fingerprints recorded immediately before and after the logical dump matched.
- The logical archive completed with 71 collections and 4,323 documents.
- Archive checksum, byte size and per-collection counts are stored only in the
  private manifest.
- The archive was restored only to a new MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or a developer database.
- The isolated restore contained the same 71 collections and 4,323 documents.
- Canonical BSON data and semantic index fingerprints matched source to restore.
- The isolated MongoDB process, temporary database and plaintext archive were
  removed after verification.

## Encryption And Local Recovery

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- A cryptographically random 48-byte password was protected by Windows DPAPI in a
  separate local recovery file.
- The encrypted archive passed `7z t` before the plaintext archive was removed.
- No connection string, password, checksum, archive path or private fingerprint is
  recorded in Git.

## Off-Device Status

- This backup has not yet been copied to and recovered from an independent off-device
  destination, so `offDeviceRecoveryVerified=false` remains explicit.
- The independently recovered 2026-08-18 backup remains available as an older
  disaster-recovery point; it is not represented as the latest release recovery point.
- A separate destination and independent key custodian are still required before this
  backup can satisfy the disaster-recovery gate.

## Recovery Limitations

- This is a fresh logical release recovery point, not continuous or point-in-time
  recovery.
- It does not include writes made after the completion timestamp.
- `continuousRecoveryAvailable=false` remains explicit because no paid Atlas
  snapshot/PITR capability was enabled.
- Restoring to production remains a separate incident operation requiring explicit
  owner approval under the backup/restore runbook.
