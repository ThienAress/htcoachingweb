# Runbook: one-way single-account environment sync

## Boundary

This operation pulls an allowlisted business-data graph for one owner-approved test
account from production `gym-app` into `htcoaching_staging` or loopback-only
`htcoaching_local`. The identity is provided at runtime and must match the digest pinned
in the contract. The tool has no production write, target-to-source, delete, arbitrary
email, financial/wallet, contract, AI-memory, or conversation path.

Authentication fields are removed from the production user document. Existing target
authentication fields are preserved so staging and local continue to use their own
login credentials.

## Required secrets

- `ACCOUNT_SYNC_EMAIL`: exact owner-approved account identity.
- `PRODUCTION_ACCOUNT_SYNC_READONLY_URI`: MongoDB credential restricted to read access
  on production `gym-app`.
- `STAGING_ACCOUNT_SYNC_URI`: staging-only write credential for the GitHub workflow.

Never substitute the production application write credential for the read-only source
credential. Never store URI values in the repository, task arguments, artifacts, or
logs. The CLI verifies the authenticated source at runtime and accepts only the exact
built-in role `read@gym-app`; an environment declaration alone is not sufficient.

## Staging schedule

`.github/workflows/single-account-sync.yml` runs hourly and can be dispatched manually.
It performs a dry-run before apply and uses a concurrency lock. Configure the three
repository or environment secrets above before enabling the first run. GitHub scheduled
workflows execute from the default branch, so the schedule is active only after the
workflow has passed review and landed there. A scoped `push` trigger on `staging`
validates the workflow and performs one pull when its sync implementation changes;
this does not replace the hourly default-branch schedule.

## Local schedule

Provision `.local-data/account-sync-secret.dpapi` once on each Windows workstation.
The protected payload contains `ACCOUNT_SYNC_EMAIL` and
`PRODUCTION_ACCOUNT_SYNC_READONLY_URI`; Windows DPAPI encrypts it for the current OS
user, and `.local-data/` is ignored by Git. Never copy this file to another Windows
account or machine because it cannot be decrypted there. The Windows task runs only
while that user session, local MongoDB and the PC are available.

Dry-run and apply manually before registration:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-single-account-sync.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-single-account-sync.ps1 -Apply
```

Register the hourly pull task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-single-account-sync-task.ps1
```

The task command contains only the runner path and `-Apply`; the runner decrypts the
DPAPI payload inside process memory and clears the plaintext byte buffer before exit.
A named mutex and Task Scheduler `IgnoreNew` policy prevent overlapping runs. If port
`127.0.0.1:27017` is unavailable, the runner starts the project-pinned MongoDB 8.2.6
runtime in a hidden process using the existing `mongodb-memory-server` dependency and
persistent `.local-data/mongodb` dbPath.

## Failure handling

Missing/incorrect identity, URI/database mismatch, non-loopback local host, duplicate
source user, target `_id` conflict, unavailable MongoDB or fingerprint mismatch all fail
closed. Inspect only the safe error code and collection counts. Do not print raw URI,
documents, health/financial fields, conversation content or full user IDs.

Target writes and their fingerprint reads run in one MongoDB transaction. Local MongoDB
therefore runs as the one-node replica set `rs0`; any failure rolls back the full graph
for that run instead of leaving a partially updated account. Target authentication is
read inside that same transaction, so a concurrent token rotation or logout wins over
any stale preflight snapshot.

If staging already contains a document with the same unique business key but a different
`_id`, the sync reports `ACCOUNT_SYNC_TARGET_UNIQUE_CONFLICT` plus only the collection
and index field names. Do not add automatic deletion. Reconcile that exact target record
only after proving it belongs to the pinned account; production remains canonical.

The first version intentionally does not mirror production deletes. Any tombstone or
retention behavior requires a separate spec and owner approval.
