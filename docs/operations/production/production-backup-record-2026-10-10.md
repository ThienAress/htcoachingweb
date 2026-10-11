# Production backup verification — 2026-10-10

- Backup ID: production-logical-backup-20261010T150213Z-497b7a71f8c15151.
- Application SHA: 89ac30fc31aa49628b89b308ae4b53ad9c4c8c55.
- Source: production `gym-app`, read-only connection; production writes: 0.
- Local completion: 2026-10-10T15:03:24.988Z.
- Off-device restore completion: 2026-10-10T15:14:20.451Z.

## Verified recovery

The encrypted logical backup passed archive integrity and an isolated restore against its source
fingerprint: 83 collections and 4,343 documents. BSON/index fingerprints matched. Contract GridFS
verification had zero findings. Plaintext drill directories and owned MongoDB instances were cleaned.

The owner confirmed completing the prescribed canonical Drive transfer and Bitwarden key custody
steps. Account/transfer and key custody are **owner attestation**, not agent-observed browser evidence.
The downloaded archive was independently checked against the private manifest (byte size and SHA-256
matched the original archive), then decrypted using a password freshly entered by the owner from
Bitwarden, without local DPAPI recovery in that drill. The isolated restore passed fingerprints and
GridFS; production was not connected by the drill.

## Recovery posture

Release recovery and independent off-device recovery are verified for this backup ID. Continuous
recovery/PITR remains unavailable. The canonical release gate evaluates freshness against completion
time; this record does not extend the 24-hour policy window. Private manifests, archive hashes,
recovery keys and database connection strings remain outside Git.
