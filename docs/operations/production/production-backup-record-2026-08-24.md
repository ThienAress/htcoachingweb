# Production Backup Record

Date: 2026-08-24
Status: completed, locally verified and independently recovered off-device
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

## Encryption And Independent Key Custody

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- A cryptographically random 48-byte password was protected by Windows DPAPI in a
  separate local recovery file, while the portable recovery password was stored
  separately in Bitwarden as
  `HTCOACHING Production Backup Recovery - 2026-08-24` with master-password
  re-prompt enabled.
- The encrypted archive passed `7z t` before the plaintext archive was removed.
- No connection string, password, checksum, archive path or private fingerprint is
  recorded in Git.

## Independent Off-Device Recovery

- Only the encrypted `.7z` archive was uploaded to Google Drive account
  `hoangthiengym1999@gmail.com` under
  `My Drive/htcoachingweb/production-backups`. No key, connection string, checksum,
  private manifest or plaintext archive was uploaded beside it.
- The encrypted archive was downloaded again from Google Drive rather than read from
  the source backup path. Its SHA-256 and byte size matched the private manifest, and
  it passed an AES integrity test using the recovery password retrieved from the
  Bitwarden item. The local DPAPI recovery file was not used for this drill.
- The downloaded archive was restored to a new MongoDB 8.2.6 process bound only to
  `127.0.0.1:27019`. The TTL monitor was disabled during the snapshot comparison so
  expired TTL documents could not mutate the restored recovery point.
- The independently restored copy contained 71 collections and 4,323 documents.
  Per-collection counts, the canonical BSON data fingerprint and the semantic index
  fingerprint all matched the private source fingerprint exactly.
- The drill did not receive a production URI and performed zero production writes.
  The isolated MongoDB process, plaintext archive, temporary database and downloaded
  verification copy were removed after the comparison; the encrypted source archive,
  private manifest and local DPAPI recovery file were preserved.

## Recovery Limitations

- This is a fresh logical release recovery point, not continuous or point-in-time
  recovery.
- It does not include writes made after the completion timestamp.
- `continuousRecoveryAvailable=false` remains explicit because no paid Atlas
  snapshot/PITR capability was enabled.
- Restoring to production remains a separate incident operation requiring explicit
  owner approval under the backup/restore runbook.
