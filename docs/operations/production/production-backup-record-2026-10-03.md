# Production Backup Record

Date: 2026-10-03 (Asia/Saigon)
Status: downloaded-copy restore and independent Bitwarden key custody verified.

## Recovery point

- Database: `gym-app`, accessed through the existing read-only backup account.
- Backup ID: `production-logical-backup-20261003T032918Z-e241eacf9e4ea846`.
- Completed: `2026-10-03T03:31:10.803Z` (10:31:10 Asia/Saigon).
- Method: gzip BSON dump in an encrypted 7-Zip archive with encrypted headers.
- Verified: 83 collections, 4,557 documents; source-before, source-after and
  isolated-restored BSON/index/collection-option fingerprints matched.
- Archive integrity and decrypted dump verification passed; GridFS findings: zero.
- Production writes: zero. Run-owned plaintext and isolated MongoDB state were
  cleaned before the runner returned `LOCAL_VERIFIED`, exit 0.
- The runner's application SHA is the staging release context `32cf6e8`,
  not an attestation of the production application's deployment SHA.

The interrupted preceding attempt produced no archive or successful manifest.
It is excluded from recovery evidence. Existing backups were retained.

## Off-device copy

- The Drive account chip matched the full canonical owner email in the backup
  runbook immediately before upload to `My Drive/htcoachingweb/production-backups`.
- Only this backup's encrypted `.7z` was uploaded. Drive showed upload complete.
- The same archive was downloaded through Drive. Its byte size and SHA-256
  matched the private manifest; the off-device preflight returned `PREFLIGHT_PASS`.
- Sharing/access settings were not changed. Passwords, protected keys, private
  manifests and checksum values were not uploaded or included in this report.

## Downloaded-copy restore and independent custody

The owner confirmed saving the matching Bitwarden item. Session
`a9984854-bb79-4122-87a4-c2f3dfa977fa` returned `RESTORE_PASS` at
`2026-10-03T05:46:14.534Z` (12:46:14 Asia/Saigon).
The downloaded archive passed AES integrity, decrypted-dump comparison, isolated
restore, all source fingerprints and GridFS verification: 83 collections,
4,557 documents, zero findings. The receipt records cleanup verified, no
production connection or writes, and `localRecoveryDpapiUsed=false`.
No run-owned restore directories remain; the pre-existing local MongoDB process
was preserved.

The owner entered the password through the secure prompt and anonymous stdin
pipe. The helper labels the expected source `owner_entered_from_bitwarden`, but
explicitly requires owner attestation; its label alone does not prove a fresh
retrieval from the saved item. At `2026-10-03T11:12:37.216Z`, the owner completed
the secure custody helper and attested that the password used for this exact
drill was freshly retrieved from the saved Bitwarden item after master-password
re-prompt. Root reviewed the matching backup ID and drill session ID against the
successful downloaded-copy restore receipt. The source remains owner-attested;
the vault was not directly automated. All required recovery conditions are now
satisfied; `offDeviceRecoveryVerified=true`.
`continuousRecoveryAvailable=false`; no PITR was enabled.

The clipboard handoff helper reported a cleanup error when its session ended.
A subsequent in-memory comparison verified that the current clipboard no longer
contained this backup password. No unrelated clipboard value was printed or changed.

The private continuation helpers and secret-free local receipt are under
`.local-data/backup-20261003/`. Archive/key/private-manifest locations remain private.
The distinct KB snapshot-key custody gate also completed at the same timestamp.
No database restore needed to be repeated; staging KB work can now proceed.

## Validation

- Local backup/encryption/isolated restore/fingerprint/GridFS/cleanup: PASS.
- Downloaded archive preflight: PASS; no password read and no production connection.
- Owner-entered downloaded-copy restore: PASS at the timestamp above; independent
  key retrieval and master-password re-prompt attestation subsequently verified.
- Adapted owner-handoff PowerShell and Node syntax checks: PASS.
- Restore, incorrect-password rejection, tamper rejection, input privacy and disk
  capacity tests: 24/24 PASS outside the sandbox, exit 0. The initial sandbox run
  failed in a child process; it is not counted as a successful test run.
- Application build, full app tests and live AI acceptance were not rerun in this
  backup operation. This record does not authorize production deployment.
