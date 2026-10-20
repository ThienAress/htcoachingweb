# Production backup verification — 2026-10-20

- Backup ID: production-logical-backup-20261020T060109Z.
- Application SHA: 794391baf1f35248be0ddafd45af80e8a3e08f28.
- Source: production `gym-app`, read-only connection; production writes: 0.
- Local completion: 2026-10-20T06:02:07.920Z.
- Off-device restore completion: 2026-10-20T06:12:42.215Z.

## Verified recovery

The encrypted logical backup passed archive integrity and an isolated restore against its source
fingerprint: 85 collections and 4,543 documents. The source fingerprint taken before and after the
dump matched. Contract GridFS verification had zero findings (4 signed contracts, 4 files, 4 chunks).
Plaintext drill directories and owned MongoDB instances were cleaned.

The owner stated they completed the Bitwarden key custody and Google Drive transfer/download steps.
Account/transfer and key custody are **owner attestation**, not agent-observed browser evidence.
The downloaded archive was matched to the private manifest, decrypted using the recovery password
read from Bitwarden through the owner's clipboard (`recoveryPasswordSource: bitwarden`, local DPAPI
not used), and restored into an isolated MongoDB; fingerprints and GridFS matched and production
was not connected by the drill.

## Operational notes

- The encrypted archive is 3,910,995 bytes.
- Node on the owner's workstation resolved DNS through the Cloudflare WARP local resolver, which refused
  `SRV` queries, so the first attempt failed with `querySrv ECONNREFUSED` before any dump. The run that
  produced this backup preloaded public DNS servers for Node only; nothing was changed on the workstation.
- `mongorestore` printed a warning that the archive came from MongoDB 8.0.34 while the isolated restore
  runs 8.2.6; the restore reported 0 failed documents and the fingerprints matched.
- The off-device drill scripts need PowerShell 7 (`pwsh`); Windows PowerShell 5.1 lacks the key-export API.

## Recovery posture

Release recovery and independent off-device recovery are verified for this backup ID. Continuous
recovery/PITR remains unavailable. The canonical release gate evaluates freshness against completion
time; this record does not extend the 24-hour policy window. Private manifests, archive hashes,
recovery keys and database connection strings remain outside Git.
