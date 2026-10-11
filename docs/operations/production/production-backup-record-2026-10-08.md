# Production logical backup — 2026-10-08 (local verified)

Backup ID: `production-logical-backup-20261008T080231Z-131f9f0f9e1040c4`.
Exact source database `gym-app`; production application SHA verified through
provider GET: `89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`.
Completed at `2026-10-08T08:03:52.778Z`.

- Source credential role/privilege allowlist required read-only before reads.
- Before/after typed BSON and semantic index/collection fingerprints matched.
- Encrypted7z integrity, decrypt, isolated authenticated restore and fingerprints
  passed:83collections,4.347documents. Contract GridFS:zero findings.
- Production writes:0. Plaintext/config/transient restore instance cleaned;
  recovery residue:0. Encrypted archive/private receipt retained only locally.
- Recovered local DPAPI key was retested against archive integrity, no secret
  printed. This does not prove Bitwarden custody or off-device recovery.
- `offDeviceRecoveryVerified=false`; `independentKeyCustodyVerified=false`;
  `continuousRecoveryAvailable=false`.
- Drive upload/download and fresh password retrieval from Bitwarden are pending.
  Readiness pointer remains unchanged until same-backup recovery drill is complete.

Prepared owner handoff and independent drill in local release resume folder;
only encrypted archive is eligible for upload. No application code/deploy changed.

## Independent recovery finalized — 2026-10-08T08:22:23.752Z

Owner confirmed correct canonical Drive account/destination, archive-only upload
and download, separate Bitwarden item with master-password re-prompt, and fresh
password retrieval. Account/transfer/key custody are owner-attested, not agent UI
observations. No secret was provided in chat or printed.

Exact restore session `1bd8408e-e344-4942-8737-2b311529cac2` completed at
`2026-10-08T08:20:14.794Z`, status `RESTORE_PASS`. Root rechecked the downloaded
archive size/SHA256, launch/session/backup/time bindings and source manifest.
AES, decrypted dump, isolated typed BSON/semantic index/collection fingerprints
and GridFS PASS:83collections,4.347documents; GridFS findings0.

`productionConnected=false`, `productionWrites=0`, `localRecoveryDpapiUsed=false`.
No run-owned restore directories or mongod processes remain. The owner-retained
encrypted download is preserved; all run-owned temporary copies/plaintext/config
and instances are cleaned. Original creation/restore receipts remain unchanged;
independent custody/transfer/root verification receipts are recorded separately.

`offDeviceRecoveryVerified=true`; `continuousRecoveryAvailable=false`.
Readiness pointer now references this backup. This supersedes the pending
local-only status above; it does not imply PITR or a production application deploy.
