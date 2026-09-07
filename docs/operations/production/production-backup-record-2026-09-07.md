# Production Backup Record

Date: 2026-09-07
Status: completed, locally verified and independently recovered off-device
Application context recorded by backup job: `4878db7b85bda7f19c95b19dc0bae979df0ae6c2`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260907T045540Z`
- Completed at: `2026-09-07T04:56:40.271Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup and verification: zero

## Pre-Backup GridFS Remediation

- The owner explicitly approved removal of six unreferenced `contracts.files`
  records and their six matching `contracts.chunks`, plus backfill of
  `metadata.contentType: application/pdf` on three referenced signed PDFs.
- A verified pre-change backup and isolated rehearsal guarded the operation.
- The production change ran in a MongoDB transaction with exact count and target
  guards. Post-transaction verification found three signed contracts, three
  referenced PDF files, three chunks and no GridFS findings.
- No application deploy, environment-setting change or unrelated production write
  was part of the remediation.

## Integrity And Local Isolated Restore

- Source fingerprints recorded immediately before and after the logical dump matched.
- The logical archive completed with 79 collections and 4,304 documents.
- Archive checksums, byte sizes and per-collection fingerprints remain only in
  the private manifest.
- The archive was restored only to a new MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or a developer database.
- The isolated restore contained the same 79 collections and 4,304 documents.
- Canonical BSON data and semantic index fingerprints matched source to restore.
- The restored GridFS snapshot contained three signed-contract references, three
  PDF files and three chunks; signatures, hashes, metadata and chunk layout passed
  with no orphan or legacy-content-type finding.
- The isolated MongoDB process, temporary database and plaintext archive were
  removed after verification.

## Encryption And Independent Key Custody

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- A cryptographically random 64-character recovery password remains locally
  protected by Windows DPAPI, while its portable copy is stored separately in
  Bitwarden as `HTCOACHING Production Backup Recovery - 2026-09-07 04:55 UTC`
  with master-password re-prompt enabled and verified.
- The recovery password was copied back from the saved Bitwarden item for the
  independent drill; it was not pasted into chat or written to logs.
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
- The off-device drill used the recovery password copied from the Bitwarden item.
  The local backup DPAPI recovery file was not used to decrypt the downloaded copy.
- The downloaded copy passed AES integrity and plaintext archive checks, then was
  restored to a new isolated MongoDB process bound only to `127.0.0.1:27019` with
  the TTL monitor disabled during fingerprint comparison.
- The independently restored copy contained 79 collections and 4,304 documents.
  Per-collection counts, canonical BSON data and semantic index fingerprints all
  matched the private source fingerprint.
- The off-device restore completed at `2026-09-07T05:11:56.5528169Z`.
- The drill received no production URI and performed zero production writes. The
  downloaded copy, plaintext archive, temporary database, MongoDB process,
  ciphertext, transient password transfer and one-time encrypted key bridge were
  removed; the cleanup gate passed with no recovery residue.

## Recovery Limitations

- This is a fresh logical release recovery point, not continuous or point-in-time
  recovery.
- It does not include writes made after the completion timestamp.
- The isolated restore runtime was MongoDB 8.2.6 while the production source was
  MongoDB 8.0.32. Data, collection, semantic-index and GridFS verification passed,
  but a same-version recovery runtime remains preferable for future drills.
- `continuousRecoveryAvailable=false` remains explicit because no paid Atlas
  snapshot/PITR capability was enabled.
- Restoring to production remains a separate incident operation requiring explicit
  owner approval under the backup/restore runbook.
