# Production Backup Record

Date: 2026-09-19
Status: completed, locally verified and independently recovered off-device
Application context recorded by backup job: `89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260919T085432Z`
- Completed at: `2026-09-19T08:55:46.2197057Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup and verification: zero

## Integrity And Local Isolated Restore

- Source fingerprints recorded immediately before and after the logical dump matched.
- The logical archive completed with 83 collections and 4,255 documents.
- Archive checksums, byte sizes and per-collection fingerprints remain only in
  the private manifest.
- The logical archive was restored only to a new MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or a developer database.
- The isolated restore contained the same 83 collections and 4,255 documents.
- Canonical BSON data and semantic index fingerprints matched source to restore.
- The restored GridFS snapshot contained three signed-contract references, three
  PDF files and three chunks; signatures, hashes, metadata and chunk layout passed
  with no finding.
- The isolated MongoDB process, temporary database and plaintext archive were
  removed after verification.

## Encryption And Independent Key Custody

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- The portable recovery password is stored separately in Bitwarden under the
  backup identifier with master-password re-prompt enabled.
- The recovery password was copied back from the saved Bitwarden item for the
  independent drill; it was not pasted into chat or written to logs.
- The downloaded archive passed an AES integrity test using the Bitwarden copy.
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
- The off-device drill used the recovery password copied from the Bitwarden item.
  The local backup DPAPI recovery file was not used to decrypt the downloaded copy.
- The downloaded copy passed AES integrity and plaintext archive checks, then was
  restored to a new isolated MongoDB process bound only to `127.0.0.1:27019` with
  the TTL monitor disabled during fingerprint comparison.
- The independently restored copy contained 83 collections and 4,255 documents.
  Per-collection counts, canonical BSON data and semantic index fingerprints all
  matched the private source fingerprint.
- The independently restored GridFS snapshot contained three signed-contract
  references, three PDF files and three chunks, with zero finding.
- The off-device restore completed at `2026-09-19T09:32:10.0704358Z`.
- The drill received no production URI and performed zero production writes. The
  downloaded copy, plaintext archive, temporary database, MongoDB process and
  transient password transfer were removed; the cleanup gate passed with no
  recovery residue.

## Recovery Limitations

- This is a fresh logical release recovery point, not continuous or point-in-time
  recovery.
- It does not include writes made after the completion timestamp.
- `continuousRecoveryAvailable=false` remains explicit because no paid Atlas
  snapshot/PITR capability was enabled.
- Restoring to production remains a separate incident operation requiring explicit
  owner approval under the backup/restore runbook.
