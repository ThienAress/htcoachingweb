# Production Backup Record

Date: 2026-09-03
Status: completed, locally verified and independently recovered off-device
Application context recorded by backup job: `cef86b385f31e2a179dd5636e314f4cdf633999c`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260903T043759Z`
- Completed at: `2026-09-03T04:39:51.744Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup and verification: zero

## Integrity And Local Isolated Restore

- Source fingerprints recorded immediately before and after the logical dump matched.
- The logical archive completed with 79 collections and 4,155 documents.
- Archive checksums, byte sizes and per-collection fingerprints remain only in
  the private manifest.
- The archive was restored only to a new MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or a developer database.
- The isolated restore contained the same 79 collections and 4,155 documents.
- Canonical BSON data and semantic index fingerprints matched source to restore.
- The isolated MongoDB process, temporary database and plaintext archive were
  removed after verification.

## Encryption And Independent Key Custody

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- A cryptographically random recovery password remains locally protected by
  Windows DPAPI, while its portable copy is stored separately in Bitwarden as
  `HTCOACHING Production Backup Recovery - 2026-09-03` with master-password
  re-prompt enabled and verified.
- The encrypted archive passed an AES integrity test before the plaintext source
  archive was removed.
- No connection string, password, checksum, archive path or private fingerprint is
  recorded in Git.

## Independent Off-Device Recovery

- Only the encrypted `.7z` archive was uploaded to Google Drive account
  `hoangthiengym1999@gmail.com` under
  `My Drive/htcoachingweb/production-backups`. No key, connection string, checksum,
  private manifest or plaintext archive was uploaded beside it.
- The encrypted archive was downloaded again from Google Drive rather than read
  from the source backup path. Its SHA-256 and byte size matched the private
  manifest.
- The off-device drill used the recovery password copied from the Bitwarden item
  through a one-time localhost RSA-OAEP/SHA-256 bridge. The local backup DPAPI
  recovery file was not used to decrypt the archive.
- The downloaded copy passed AES integrity and plaintext archive checks, then was
  restored to a new isolated MongoDB process bound only to `127.0.0.1:27019` with
  the TTL monitor disabled during fingerprint comparison.
- The independently restored copy contained 79 collections and 4,155 documents.
  Per-collection counts, canonical BSON data and semantic index fingerprints all
  matched the private source fingerprint.
- The drill received no production URI and performed zero production writes. The
  downloaded copy, plaintext archive, temporary database, MongoDB process,
  ciphertext, transient password transfer and one-time encrypted key bridge were
  removed; the cleanup gate passed with no recovery residue.

## Recovery Limitations

- This is a fresh logical release recovery point, not continuous or point-in-time
  recovery.
- It does not include writes made after the completion timestamp.
- `continuousRecoveryAvailable=false` remains explicit because no paid Atlas
  snapshot/PITR capability was enabled.
- Restoring to production remains a separate incident operation requiring explicit
  owner approval under the backup/restore runbook.
