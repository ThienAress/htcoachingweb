# Production Backup Record

Date: 2026-08-17
Status: completed and locally verified
Base release candidate: `7b5b6177c655ff9cf13eb7135be1118b99ec364c`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260817T135121Z`
- Completed at: `2026-08-17T13:51:58.030Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup/verification: zero

## Integrity And Isolated Restore

- The logical archive completed with 69 collections and 3,925 documents.
- The archive SHA-256 was recorded only in the private manifest before release evidence was written.
- The archive was restored only to an isolated MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or the developer
  database.
- The isolated restore contained 69 collections and 3,925 documents.
- Canonical BSON data fingerprints matched source to restore.
- Canonical index fingerprints matched source to restore.
- The isolated MongoDB process and its temporary data directory were removed
  after verification.

## Encryption And Secret Handling

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- A cryptographically random 48-byte password was protected with Windows DPAPI.
- The encrypted archive passed an independent `7z t` integrity test.
- The DPAPI-protected key was recovered once and successfully retested against
  the encrypted archive.
- The plaintext archive, temporary URI and isolated restore were deleted after
  all verification gates passed.
- The archive, protected key, checksums, connection string and collection-level
  fingerprints remain outside Git under owner-only filesystem ACLs.

## Recovery Limitations

- This is a logical recovery point, not continuous or point-in-time recovery.
- It does not include writes made after the completion timestamp.
- The protected key currently depends on the same Windows owner profile.
- No independently recoverable off-device copy was verified in this release
  session, so disaster-recovery readiness remains false even though the release
  backup gate is satisfied.
- Application rollback should be attempted before database restore. Restoring to
  production requires a confirmed data-corruption incident and explicit owner
  approval under the backup/restore runbook.
