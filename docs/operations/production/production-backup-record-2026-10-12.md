# Production backup verification — 2026-10-12

- Backup ID: production-logical-backup-20261012T164748Z-35213d0c60f3caa3.
- Application SHA: 04b9b9290ef06eb2358cf938a7db4632f3f9cf13.
- Source: production `gym-app`, read-only connection; production writes: 0.
- Local completion: 2026-10-12T16:49:34.292Z.
- Off-device restore completion: 2026-10-12T17:03:21.707Z.

## Verified recovery

The encrypted logical backup passed archive integrity and an isolated restore against its source
fingerprint: 84 collections and 4,438 documents. BSON/index fingerprints matched. Contract GridFS
verification had zero findings. Plaintext drill directories and owned MongoDB instances were cleaned.

The owner stated they completed the Bitwarden key custody and Google Drive transfer/download steps.
Account/transfer and key custody are **owner attestation**, not agent-observed browser evidence.
The downloaded archive was matched to the private manifest (byte size and SHA-256), then decrypted
using a password freshly entered by the owner from Bitwarden, without local DPAPI recovery in that
drill. The isolated restore passed fingerprints and GridFS; production was not connected by the drill.

## Operational note

The runner completed on the first attempt. The encrypted archive is 3,963,459 bytes.

## Recovery posture

Release recovery and independent off-device recovery are verified for this backup ID. Continuous
recovery/PITR remains unavailable. The canonical release gate evaluates freshness against completion
time; this record does not extend the 24-hour policy window. Private manifests, archive hashes,
recovery keys and database connection strings remain outside Git.
