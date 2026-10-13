# Production Backup Record

Date: 2026-10-04 (Asia/Saigon)
Status: downloaded-copy restore and independent Bitwarden key custody verified.

## Recovery point

- Backup ID: `production-logical-backup-20261004T034034Z-29a11f694327901d`.
- Database: `gym-app`, read through the existing read-only backup account.
- Completed: `2026-10-04T03:41:38.092Z` (10:41:38 Asia/Saigon).
- Method: gzip BSON dump in an encrypted 7-Zip archive with encrypted headers.
- Verified: 83 collections, 4,547 documents; archive integrity, decrypted dump,
  isolated restore, source BSON/index fingerprints and GridFS all passed.
- Production writes: zero. Existing backups were retained.

## Off-device copy

The full canonical Drive owner account was checked immediately before upload to
the destination specified in the backup runbook. Only the encrypted archive was
uploaded; Drive showed completion. The same archive was downloaded through Drive
UI and its size and SHA-256 matched the private manifest. Passwords, protected
keys, private manifests and checksum values were not uploaded or recorded here.
Sharing settings were not changed.

## Downloaded-copy restore and independent custody

Session `5d8f2978-bbea-4db5-a730-a7cc46f7371b` returned `RESTORE_PASS` at
`2026-10-04T10:04:46.437Z` (17:04:46 Asia/Saigon). The downloaded copy passed AES
integrity, decrypted-dump comparison, isolated restore, source fingerprints and
GridFS verification: 83 collections, 4,547 documents, zero findings.

The matching custody receipt was written at `2026-10-04T10:04:46.6386057Z`.
The owner attested that the matching Bitwarden item was saved with master-password
re-prompt and its Password was freshly retrieved for this drill. The password was
entered through a hidden prompt and anonymous stdin pipe; local DPAPI was not used
for the restore. The source is **owner-attested Bitwarden**, not direct vault
inspection. Rejected confirmation inputs from preceding attempts did not run a
restore or establish custody evidence.

Root cross-checked the transfer, custody, exact session, successful restore and
private manifest at `2026-10-04T10:07:53.062Z`. Counts and downloaded archive
matched. Cleanup was verified: no run-owned restore directory or MongoDB process
remained. The initial sandbox process query was denied and was not counted as
verification; the subsequent permitted read-only query passed. The owner-managed
downloaded encrypted archive was preserved; run-owned temporary copies, plaintext
and isolated MongoDB state were cleaned. Production was not connected during the
off-device drill and received zero writes.

All independent recovery conditions are satisfied:
`offDeviceRecoveryVerified=true`. `continuousRecoveryAvailable=false`; no PITR
or production deployment is authorized by this record.

## Validation

- Local encryption/integrity/isolated restore/fingerprints/GridFS: PASS.
- Drive transfer and downloaded-copy size/hash preflight: PASS.
- Owner-entered downloaded-copy restore and matching custody receipt: PASS.
- Root receipt/manifest/session/boundary/cleanup verification: PASS.
- Custody helper synthetic regression: 60/60 PASS; PowerShell parser PASS.
- Application build and tests were not repeated for this documentation update.
