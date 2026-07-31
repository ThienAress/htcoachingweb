# Production Backup Record

Date: 2026-07-23
Status: completed and independently verified
Approval: explicit owner approval in the release session

## Scope

- Environment: production
- Backup identifier: `production-logical-backup-20260723T080213Z`
- Backup type: MongoDB logical BSON archive produced by `mongodump --gzip`
- Production writes performed: zero

The Atlas cluster is on the Free tier and reports cloud backups as inactive, so
an Atlas on-demand snapshot is unavailable. This verified logical backup is the
pre-release recovery point for the current release. It does not provide
continuous or incremental backup.

## Evidence

The encrypted archive, protected recovery key and machine-readable manifest are
stored outside the Git repository in owner-approved local storage. Exact local
paths, service/database identifiers, checksums and key-recovery details remain
only in that private manifest and are intentionally excluded from this public
repository.

The archive uses AES-256 with encrypted headers. The encrypted archive checksum
matches the private manifest, and only the current owner account has file
access.

## Verification

1. The Render API returned the production `MONGO_URI` without printing it.
2. A hard database-name lock rejected the initial incorrect assumption and then
   required an exact match with the URI target before `mongodump` could run.
3. The temporary MongoDB config had a current-user-only ACL and was removed in a
   `finally` block.
4. `mongorestore --dryRun` completed with zero restored and zero failed
   documents.
5. `7z t` passed after encryption.
6. A separate process recovered the protected key and passed a second archive
   integrity check.
7. The plaintext `.archive.gz` was removed only after all checks passed.

## Limitations And Restore Gate

- The backup contains data only through `2026-07-23T08:02:34Z`. Later writes
  require a newer backup.
- Free-tier `mongodump` cannot use `--oplog`, so this is not a transactionally
  coordinated continuous snapshot.
- The protected key currently requires the same operating-system user profile.
  Before this can serve as disaster recovery for loss of the workstation,
  create an independently recoverable encrypted off-device copy.
- Do not restore over production without a confirmed corruption incident,
  explicit owner approval, a target-database lock, and a restore rehearsal on
  an isolated database.
