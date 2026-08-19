# Production Backup Record

Date: 2026-08-19
Status: completed and locally verified; current backup not yet independently recovered off-device
Base release candidate: `24a1aa9c9a150d43974cf2ed8195a942c3ad2f7b`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260819T043513Z`
- Completed at: `2026-08-19T04:37:33.508Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup/verification: zero

## Integrity And Local Isolated Restore

- The logical archive completed with 71 collections and 3,923 documents.
- Archive checksums and per-collection counts are stored only in the private manifest.
- The archive was restored only to a new MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or a developer database.
- The isolated restore contained the same 71 collections and
  3,923 documents.
- Canonical BSON data and semantic index fingerprints matched source to restore.
- The isolated MongoDB process, temporary database and plaintext archive were removed
  after verification.

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
- The independently recovered 2026-08-18 backup remains available as an older disaster
  recovery point; it is not represented as the latest release recovery point.
- Uploading the current encrypted archive and separately recovering its key requires a
  dedicated off-device handoff.

## Recovery Limitations

- This is a fresh logical release recovery point, not continuous or point-in-time
  recovery.
- It does not include writes made after the completion timestamp.
- `continuousRecoveryAvailable=false` remains explicit because no paid Atlas
  snapshot/PITR capability was enabled.
- Restoring to production remains a separate incident operation requiring explicit
  owner approval under the backup/restore runbook.
