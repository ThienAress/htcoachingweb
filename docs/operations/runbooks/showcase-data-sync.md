# Showcase Data Sync Runbook

## Purpose and scope

This one-way sync makes the public `hoang-thien` trainer profile and its public
customer stories available for UI review in local or staging. It is deliberately
limited to the `trainers` and `customerstories` collections.

The production source is always `gym-app` and must authenticate with exactly the
single `read@gym-app` role and no write-capable privilege. The command never
deletes documents, never writes to the source, and never creates a plaintext
export.

Only one published trainer with the exact slug `hoang-thien` is accepted. Stories
must also be published. Direct stories use that trainer `_id`; because this
trainer is the head coach, legacy public stories with a null or missing
`trainerId` are included exactly as the public API does.

## Data boundary

- Trainer data is reduced to schema-backed public profile fields.
- Customer stories are reduced to public display fields.
- BSON `_id`, public timestamps, status and `trainerId` are retained.
- `orderId` is always replaced with `null`; no Order document or identifier is
  copied.
- Authentication, health, wallet, payment, order and private user collections
  are outside this workflow.
- Existing target records are upserted by `_id` inside one transaction. No other
  target data is removed.
- Apply mode creates a unique `{ slug: 1 }` index on each of the two target
  collections when an equivalent index is absent. This is the workflow's only
  schema side effect; it never drops or replaces an index.

## Credential and target prerequisites

The Windows runner decrypts `.local-data/account-sync-secret.dpapi` with the
existing `HTCoachingAccountSyncV1` DPAPI entropy. The payload supplies
`sourceUri`; the existing payload also supports staging through its `targetUri`.
Neither URI is printed.

Production and staging may intentionally live on the same physical Atlas
cluster. Isolation is enforced by database identity and effective privileges:
the source credential is read-only for `gym-app`, while every effective staging
target privilege must be confined to `htcoaching_staging`. Host equality alone
is therefore not treated as an environment boundary.

The runtime rejects:

- a source URI whose database is not exactly `gym-app`;
- a source principal other than exactly `read@gym-app`, or any write privilege;
- a local URI outside loopback or outside `htcoaching_local`;
- a staging URI outside `htcoaching_staging`;
- a staging principal unless it has exactly the approved scoped custom role or
  built-in `readWrite@htcoaching_staging`, with every privilege confined to
  `htcoaching_staging` and the required read, write and `listIndexes`/index-create
  capabilities;
- zero or multiple published trainers matching the pinned slug;
- target `_id`/slug collisions;
- apply mode without the target-specific confirmation.

## Dry-run and apply

Run from the repository root. Dry-run is the default and performs source reads,
target preflight reads, counts and fingerprinting with zero writes. Missing
unique slug indexes are reported as planned actions but are not created:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-showcase-data-sync.ps1 -Target local
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-showcase-data-sync.ps1 -Target staging
```

After reviewing the safe JSON summary, apply to the explicitly named target:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-showcase-data-sync.ps1 -Target local -Apply
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-showcase-data-sync.ps1 -Target staging -Apply
```

For local, the runner starts the existing hidden local MongoDB process when the
loopback port is not ready. For staging, the runner uses the encrypted
`targetUri`; it does not start local MongoDB.

## Verification and output

Apply mode performs transactional replacement by exact `_id`, reads every
written document back in the same transaction, and compares canonical BSON
fingerprints. Before that transaction it creates and verifies any missing unique
slug indexes. Duplicate target slugs or incompatible existing indexes fail with
stable metadata and no raw values. Re-running the same source graph is
idempotent.

Success output is intentionally limited to mode, target, the public trainer
slug, the trainer `_id` suffix, collection counts, total/written counts and a
fingerprint prefix. Index activity is reported only as counts. Failures emit only
stable error metadata, never documents, personal names, URIs or credentials.

Do not use this workflow as a production backup or restore mechanism. It is a
least-privilege presentation-data sync for UI review only.

The contract, runtime and focused test files intentionally keep their security
guards beside the two-collection workflow even where the test files exceed the
usual 300-line preference. The authorized change surface is fixed to these
modules, and splitting validation or privilege checks into unowned shared files
would weaken review traceability for this one-shot operational boundary.

## Last verified execution

On 2026-09-05, the guarded workflow completed dry-run, apply and post-apply
dry-run for both `local` and `staging`:

- each target matched one `hoang-thien` trainer and nine published customer stories;
- each apply wrote ten target documents and its post-apply dry-run wrote zero;
- both targets returned fingerprint prefix `979ebd9c920da78a`;
- public GET verification on both local and staging returned the published trainer
  plus all nine customer stories used by the profile UI;
- no target index needed creation, no plaintext export was created and the
  production source remained behind the exact read-only privilege check.
