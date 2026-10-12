# Production logical backup — 2026-10-06

Backup ID: `production-logical-backup-20261006T043756Z-db2370a02cdb7bbc`.
Source database: `gym-app`; production application SHA verified by provider GET:
`89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`.
Recovery point completed at `2026-10-06T04:39:21.034Z`; independent recovery
review completed at `2026-10-06T04:58:24.288Z`.

- Creation verified exact host/database/TLS and read-only role/privilege allowlist
  before document reads. Source before/after fingerprints matched; zero production writes.
- AES archive integrity and authenticated restore of the decrypted encrypted
  archive passed: 83 collections, 4,388 documents, typed BSON, collection options
  and semantic index fingerprints matched. Contract GridFS: zero findings.
- Owner confirmed archive-only upload and download from Google Drive account
  `hoangthiengym1999@gmail.com`, destination `My Drive/htcoachingweb/production-backups`.
  Provider account/transfer evidence is owner-attested, not agent-observed.
- Owner confirmed password saved separately in the Bitwarden item named for this
  backup, master-password re-prompt enabled, and fresh retrieval for the drill.
  Independent custody/retrieval evidence is owner-attested; no password recorded.
- Off-device restore session `fc19b8ec-7877-4103-bd96-492af089bf9a` completed at
  `2026-10-06T04:50:48.092Z`, status `RESTORE_PASS`. Download size/checksum,
  AES integrity, decrypted dump, fingerprints, isolated restore and GridFS passed.
  `productionConnected=false`, `productionWrites=0`, `localRecoveryDpapiUsed=false`.
- Root rechecked download checksum/size against the private creation manifest,
  exact launch/session binding and counts. No run-owned restore directory or
  mongod process remained. Original manifest and restore receipt were preserved;
  owner-attestation and root-review receipts were recorded separately.
- Supplemental cleanup check at `2026-10-06T05:06:59.1007990Z` included all
  versioned mongod binary names and required commandline visibility: zero
  run-owned processes, restore directories and modern-package transient entries.

`offDeviceRecoveryVerified=true`; `continuousRecoveryAvailable=false`.
Logical backup is not an atomic snapshot, continuous recovery or PITR. The observed
source Mongo version was 8.0 and isolated verifier 8.2.6; this matched-fingerprint
drill is not a production version-upgrade certification. Archives, passwords,
DPAPI keys, private fingerprints and credentials remain outside tracked artifacts.
The earlier incomplete-format backup from this date is preserved but not used as
readiness evidence. This recovery gate does not authorize a production release.
