# Production Backup Record

Date: 2026-08-12
Status: completed and independently verified
Base release candidate: `5b9e6c696bf8d5a8dfe8ea03f68c2d908399d1c8`

## Scope

- Environment: production
- Database target: `gym-app`
- Backup identifier: `production-logical-backup-20260812T105458Z`
- Completed at: `2026-08-12T10:55:16.6099507Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed by backup/verification: zero

## Integrity And Isolated Restore

- The logical archive completed with 62 collections and 3,865 documents.
- The archive SHA-256 was recorded in the private manifest before encryption.
- The archive was restored only to an isolated MongoDB process bound to
  `127.0.0.1:27019`; it was never restored over production or the developer
  database.
- The isolated restore contained 62 collections and 3,865 documents.
- Canonical BSON data fingerprints matched source to restore.
- Canonical index fingerprints matched source to restore.
- `mongorestore` reported 3,865 restored and zero failed documents.
- The isolated MongoDB process and its temporary data directory were removed
  after verification.

## Encryption And Secret Handling

- The archive was encrypted as an AES-256 7-Zip archive with encrypted headers.
- A cryptographically random 48-byte password was protected with Windows DPAPI.
- The encrypted archive passed an independent `7z t` integrity test.
- The plaintext archive was deleted only after restore, fingerprint, encryption,
  and encrypted-archive verification passed.
- The archive, protected key, checksums, connection string and collection-level
  fingerprints remain outside Git under owner-only filesystem ACLs.
- Temporary connection/config files and clipboard content were cleared after use.

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
