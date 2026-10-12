# Production Backup Record

Date: 2026-10-01
Status: completed, integrity checked and recovered from the off-device download
Application context recorded by the backup job: `89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`

## Recovery point

- Database: `gym-app`.
- Backup ID: `production-logical-backup-20261001T041228Z-d607abd5da8ef5f1`.
- Logical backup completed: `2026-10-01T04:13:57.494Z` (11:13:57 Asia/Saigon).
- Method: gzip MongoDB BSON dump inside an encrypted 7-Zip archive with encrypted headers.
- Local source-before, source-after and restored fingerprints matched in the original private manifest.
- Verified contents: 83 collections and 4,558 documents.
- Checksums, detailed collection fingerprints, credentials and archive locations remain private.

## Off-device copy and key custody

- Canonical destination: Google Drive account `hoangthiengym1999@gmail.com`,
  `My Drive/htcoachingweb/production-backups`.
- Account and folder evidence comes from the preceding operator conversation supplied by the owner:
  its Google account accessibility observation showed the full canonical email before the upload flow.
  The owner subsequently confirmed uploading the encrypted archive and downloading it again.
  This session verified the downloaded bytes; it did not independently revisit Drive after browser access was blocked.
- The downloaded archive matched the private manifest in both size and SHA-256. Only the encrypted archive was
  designated for Drive; the password, local protected key and private manifest were excluded from upload.
- The owner saved/updated the matching Bitwarden item, following the instruction to enable master-password re-prompt,
  and confirmed entering a freshly copied password into the secure local prompt. Provider-side save/re-prompt state
  was owner-operated and was not independently inspected by the agent.
- The successful drill received the password through an anonymous stdin pipe after a masked PowerShell prompt.
  It did not read the local DPAPI recovery key. No password was printed, passed in argv, or written to the receipt.
- Provider actions and password retrieval have owner-attested provenance; archive and restore checks have local
  execution evidence. Earlier local-key diagnostic runs are explicitly excluded from independent recovery evidence.

## Successful independent restore

- Final session: `c1986268-fe93-4747-a276-8618b7e936ce`.
- Completed: `2026-10-01T14:32:17.850Z` (21:32:17 Asia/Saigon), status `RESTORE_PASS`.
- AES archive integrity and decrypted BSON size/hash checks passed.
- A fresh MongoDB process bound only to loopback used random SCRAM credentials, a random port, process/listener identity
  checks and a unique recovery database. The TTL monitor was disabled during comparison.
- All 83 collections and 4,558 documents matched the source: collection counts, per-collection counts, canonical BSON,
  semantic indexes including key order, and collection options.
- The GridFS verifier passed with zero findings. The source manifest records three signed contracts, three PDF files
  and three chunks; the recovered data matched its fingerprints before the verifier ran.
- The drill had no production URI, made no production connection and performed zero production writes.
- The run-owned encrypted working copy, plaintext dump, temporary MongoDB data and process were removed. A follow-up
  filesystem/process check found zero remaining drill directories or MongoDB processes.
- The owner's original encrypted download and original backup/key were retained. They are not plaintext or run-owned
  scratch files. No existing backup was deleted.

## Failure resolved before certification

Earlier password handoff/input attempts failed and did not produce successful evidence. The owner updated the saved
Bitwarden password. A later attempt passed decryption but failed during index creation on drive C, which had only about
230 MiB free. Running the same restore against an ACL-restricted workspace on drive D succeeded with every comparison intact.
The helper now uses D for temporary restore work and checks disk headroom before extracting plaintext. No index or
fingerprint check was bypassed. Twenty-four focused helper tests passed, including restore, incorrect-password rejection,
cleanup, secret input and storage-capacity boundaries.

## Scope and limits

- `offDeviceRecoveryVerified=true` records this particular downloaded-copy drill, with the provenance stated above.
- `continuousRecoveryAvailable=false`: no continuous backup/PITR was enabled. New writes after the original recovery
  point are not covered; the readiness age uses the original backup time, never the later drill time.
- This evidence verifies database archive recovery. Full application integration/E2E, a new deployment, Cloudinary
  media recovery and provider retention enforcement were not tested in this operation.
- Repository readiness is a backup gate, not authorization to deploy or restore over production.
- Keep the existing owner-controlled archive retention/access policy; this operation did not change sharing or retention.

## Handover validation

- `npm run audit:backup-readiness`, `npm run verify:backup-release` and `npm run verify:disaster-recovery`:
  passed at review time; backup age approximately 10.37 hours, both readiness flags true, no backup blocker.
- `npm run security:data-boundaries`: passed, zero violations. Documentation diff whitespace check passed.
- Full `npm run security:secrets`: blocked (exit 1) before scanning by existing `.ci-verify/` and `.stage-clone/`
  entries that the repository path validator rejects. Those unrelated directories and scanner rules were preserved.
  The three changed delivery documents were separately checked using the canonical secret-pattern matcher.
- After verification, the clipboard was cleared only when it matched this backup's recovery password.
