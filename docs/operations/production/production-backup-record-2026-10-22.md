# Production backup verification — 2026-10-22

- Backup ID: production-logical-backup-20261022T060744Z.
- Application SHA: c67007522fce0834269833cc61fbc76ad8eafd4d.
- Source: production `gym-app`, read-only connection; production writes: 0.
- Local completion: 2026-10-22T06:08:51.624Z.
- Off-device restore completion: 2026-10-22T06:16:54.361Z.

## Verified recovery

The encrypted logical backup passed archive integrity and an isolated restore against its source
fingerprint: 86 collections and 4,597 documents. The source fingerprint taken before and after the
dump matched. Contract GridFS verification had zero findings (4 signed contracts, 4 files, 4 chunks).
Plaintext drill directories, the downloaded copy and owned MongoDB instances were cleaned
(`cleanupVerified: true`).

The owner stated they completed the Bitwarden key custody and Google Drive transfer/download steps.
Account/transfer and key custody are **owner attestation**, not agent-observed browser evidence.
The downloaded archive was matched to the private manifest (size and SHA-256), decrypted using the
recovery password read from Bitwarden through the owner's clipboard (`recoveryPasswordSource:
bitwarden`, local DPAPI not used), and restored into an isolated MongoDB; fingerprints and GridFS
matched and production was not connected by the drill.

## Operational notes

- The encrypted archive is 3,960,563 bytes.
- The first attempt of the day failed with `querySrv ECONNREFUSED` because Node resolved DNS through the
  Cloudflare WARP local resolver, which refuses `SRV` queries; the run that produced this backup preloaded
  public DNS servers for Node only. A second backup folder created by that first attempt is empty and unused.
- The off-device drill scripts need PowerShell 7 (`pwsh`) and are run by absolute path.

## Recovery posture

Release recovery and independent off-device recovery are verified for this backup ID. Continuous
recovery/PITR remains unavailable. The canonical release gate evaluates freshness against completion
time; this record does not extend the 24-hour policy window. Private manifests, archive hashes,
recovery keys and database connection strings remain outside Git.
