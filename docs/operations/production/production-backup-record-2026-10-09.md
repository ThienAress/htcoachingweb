# Production backup verification — 2026-10-09

- Backup ID: production-logical-backup-20261009T091027Z-08183a4cec69ca0b.
- Application SHA: 89ac30fc31aa49628b89b308ae4b53ad9c4c8c55.
- Source: production `gym-app`, read-only connection; production writes: 0.
- Local completion: 2026-10-09T09:11:50.008Z.
- Off-device restore completion: 2026-10-09T09:21:40.060Z.
- Root verification: 2026-10-09T09:22:39.611Z.

## Verified recovery

The encrypted logical backup passed archive integrity and an isolated restore against its source
fingerprint: 83 collections and 4,343 documents. BSON/index fingerprints matched. Contract GridFS
verification had zero findings. Plaintext drill directories and owned MongoDB instances were cleaned.

The owner confirmed completing the prescribed canonical Drive transfer and Bitwarden key custody
steps. Account/transfer and key custody are **owner attestation**, not agent-observed browser evidence.
The downloaded archive was independently checked against the private manifest, then decrypted using
a password freshly entered by the owner from Bitwarden, without local DPAPI recovery in that drill.
The second isolated restore passed fingerprints and GridFS; production was not connected by the drill.

The helper initially retained an old local download path. That preflight failed before password input;
the path was corrected to the owner's Downloads directory and preflight then passed. The failed attempt
is not counted as restore evidence.

## Recovery posture

Release recovery and independent off-device recovery are verified for this backup ID. Continuous
recovery/PITR remains unavailable. The canonical release gate evaluates freshness against completion
time; this record does not extend the 24-hour policy window. Private manifests, archive hashes,
recovery keys and database connection strings remain outside Git.
