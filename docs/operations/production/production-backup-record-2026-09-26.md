# Production Backup Record

Date: 2026-09-26
Status: completed, locally verified and independently recovered off-device

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260926T041427Z`
- Completed at: `2026-09-26T04:15:49.261Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup and local verification: zero

## Local Integrity And Restore

- Source fingerprints recorded before and after the logical dump matched.
- The encrypted archive passed AES integrity testing and contains 83 collections
  and 4,094 documents.
- The logical archive was restored only to a MongoDB process bound to
  `127.0.0.1:27019`, never over production or a developer database.
- Collection counts, document counts, canonical BSON hashes and semantic index
  hashes matched the source fingerprint after the isolated restore.
- The restored GridFS snapshot contained three signed-contract references,
  three PDF files and three chunks. Its verifier reported zero findings.
- The temporary plaintext archive and isolated MongoDB process were removed.

## Independent Off-Device Recovery

- Only the AES-256 encrypted `.7z` archive was uploaded to the canonical
  `hoangthiengym1999@gmail.com` Google Drive account under
  `My Drive/htcoachingweb/production-backups`.
- A copy downloaded from that Drive account matched the private manifest's
  byte size and SHA-256. The checksum and archive path remain outside Git.
- The owner saved the portable recovery password in Bitwarden as
  `HTCOACHING Production Backup Recovery - 2026-09-26`, with master-password
  re-prompt enabled. The owner then copied the password from the saved item for
  the independent drill; the local DPAPI key was not used to decrypt this copy.
- The downloaded archive passed AES integrity testing, then was extracted and
  restored into a new isolated MongoDB process bound to `127.0.0.1:27019` with
  the TTL monitor disabled during fingerprint comparison.
- The independent restore contained 83 collections and 4,094 documents.
  Per-collection counts, canonical BSON hashes and semantic index hashes matched
  the private source fingerprint. GridFS validation reported zero findings.
- The off-device drill completed at `2026-09-26T04:34:39.191Z`. It received no
  production URI and performed zero production writes.
- The downloaded copy, plaintext archive, temporary database, MongoDB process
  and transient clipboard password were removed. A separate residue check found
  no recovery temp directory or isolated MongoDB listener.

## Recovery Limitations

- This logical backup does not cover writes after its completion timestamp.
- `continuousRecoveryAvailable=false`: Atlas snapshot/PITR was not enabled.
- A production restore remains a separate incident operation requiring explicit
  owner approval under the backup/restore runbook.
