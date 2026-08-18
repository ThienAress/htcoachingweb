# Production Backup Record

Date: 2026-08-18
Status: completed, locally verified and independently recovered off-device
Base release candidate: `ffe11a72fc05acbc55e08b332b8a37aa236c091f`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260818T033437Z`
- Completed at: `2026-08-18T03:34:58.343Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup/verification: zero

## Integrity And Local Isolated Restore

- The logical archive completed with 69 collections and 3,925 documents.
- The archive SHA-256 was recorded only in the private manifest.
- The archive was restored only to an isolated MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or the developer
  database.
- The isolated restore contained 69 collections and 3,925 documents.
- Canonical BSON data and semantic index fingerprints matched source to restore.
- The isolated MongoDB process, temporary data and plaintext archive were removed
  after verification.

## Encryption And Independent Key Custody

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- A cryptographically random 48-byte password was protected locally with Windows
  DPAPI while the portable recovery copy was stored separately in Bitwarden as
  `HTCOACHING Production Backup Recovery - 2026-08-18`.
- Only the encrypted `.7z` archive was uploaded to Google Drive under
  `htcoachingweb/production-backups`; no recovery key, connection string,
  fingerprint or private checksum was uploaded beside it.
- The encrypted archive passed `7z t` before upload.

## Independent Off-Device Recovery

- The encrypted archive was downloaded again from Google Drive rather than read
  from the original private backup path.
- The downloaded archive SHA-256 and byte size matched the private encrypted
  archive manifest.
- The recovery password was copied back from the Bitwarden vault. The off-device
  drill did not decrypt or read the local DPAPI key.
- The downloaded archive passed an AES integrity test, was extracted, and was
  restored to a new MongoDB process bound to `127.0.0.1:27019`.
- The restored copy contained 69 collections and 3,925 documents. Its canonical
  BSON data fingerprint, semantic index fingerprint and per-collection counts all
  matched the previously recorded private fingerprint.
- The off-device restore did not reconnect to production and performed zero
  production writes. The isolated MongoDB process and temporary plaintext restore
  files were removed after the drill.

## Recovery Limitations

- This remains a logical recovery point, not continuous or point-in-time recovery.
- It does not include writes made after the completion timestamp.
- `continuousRecoveryAvailable` remains false because no paid Atlas snapshot/PITR
  capability was enabled or inferred.
- Application rollback should be attempted before database restore. Restoring to
  production requires a confirmed data-corruption incident and explicit owner
  approval under the backup/restore runbook.
