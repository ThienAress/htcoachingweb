# Production backup verification — 2026-10-11

- Backup ID: production-logical-backup-20261011T164740Z-c1b923bd14b49f4f.
- Application SHA: 1f919b71f819a55ad52e0f256fca402ec8406d3f.
- Source: production `gym-app`, read-only connection; production writes: 0.
- Local completion: 2026-10-11T16:49:23.555Z.
- Off-device restore completion: 2026-10-11T16:54:16.688Z.

## Verified recovery

The encrypted logical backup passed archive integrity and an isolated restore against its source
fingerprint: 83 collections and 4,351 documents. BSON/index fingerprints matched. Contract GridFS
verification had zero findings. Plaintext drill directories and owned MongoDB instances were cleaned.

The owner stated they completed the Bitwarden key custody and Google Drive transfer/download steps.
Account/transfer and key custody are **owner attestation**, not agent-observed browser evidence.
The downloaded archive was matched to the private manifest (byte size and SHA-256), then decrypted
using a password freshly entered by the owner from Bitwarden, without local DPAPI recovery in that
drill. The isolated restore passed fingerprints and GridFS; production was not connected by the drill.

## Operational note

The first two runner attempts ended with `CHILD_EXIT_NONZERO` during the dump phase before any archive
existed; the third attempt passed. Direct `mongodump` diagnostics with the runner's environment
filtering, closed stdin and a path containing spaces all exited 0, so the failure was treated as
transient. No partial archive, key or manifest from the failed attempts was retained.

## Recovery posture

Release recovery and independent off-device recovery are verified for this backup ID. Continuous
recovery/PITR remains unavailable. The canonical release gate evaluates freshness against completion
time; this record does not extend the 24-hour policy window. Private manifests, archive hashes,
recovery keys and database connection strings remain outside Git.
