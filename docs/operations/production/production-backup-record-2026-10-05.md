# Production logical backup — 2026-10-05

Backup ID: `production-logical-backup-20261005T030928Z-d59b34e648e1424e`.
Source database: `gym-app`; application SHA:
`89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`.
Recovery point completed at `2026-10-05T03:11:21.938Z`; independent recovery
review completed at `2026-10-05T03:36:06.442Z`.

- Source access verified exact read-only role before document reads; zero
  production writes. Before/after source fingerprints matched.
- Encrypted archive integrity and decrypted isolated restore passed:
  83 collections, 4,360 documents; BSON and semantic index fingerprints matched.
- Contract GridFS verifier: zero findings. Local plaintext/instance cleanup
  verified; no run-owned restore directory remained.
- Owner confirmed archive-only upload and download from
  `My Drive/htcoachingweb/production-backups`, account
  `hoangthiengym1999@gmail.com`. Browser automation was unavailable, so provider
  transfer/account evidence is owner-attested, not agent-observed.
- Downloads size/checksum matched the private creation manifest. AES integrity,
  decrypted dump, isolated restore and cleanup were independently observed by
  the local helper after fresh password retrieval from the saved Bitwarden item.
- Custody/restore session: `7a316569-17f9-4104-825f-97a0fb3e2a72`;
  restore completed `2026-10-05T03:35:32.147Z`.
  `localRecoveryDpapiUsed=false`, `productionConnected=false` for the off-device
  drill; no password printed or committed.

`offDeviceRecoveryVerified=true`; `continuousRecoveryAvailable=false`.
This logical backup does not certify continuous recovery or PITR. Archives,
keys, private fingerprints and credentials remain outside tracked artifacts.
