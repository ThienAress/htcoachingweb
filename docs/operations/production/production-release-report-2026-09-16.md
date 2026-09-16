# Production Release Report

Date: 2026-09-16
Release SHA: `89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`
Status: deployed; promotion and observation passed; final decision `KEEP`

## Scope

- Promote the Plan 090/090A HT Assistant and guarded Knowledge Base release only
  after exact-SHA staging acceptance.
- Preserve application runtime Node `22.23.1` and all existing auth/quota/data contracts.
- Use immutable rollback deploy IDs and a fresh independently recoverable logical backup.
- Perform no production database migration, re-embed, restore or PITR operation.

## Candidate And Staging Evidence

- Canonical CI run
  [35069144480](https://github.com/ThienAress/htcoachingweb/actions/runs/35069144480): success.
- Staging client deploy: Netlify `6aaa46f84d7024a5fb6abd6e`, exact release SHA.
- Staging server deploy: Render `dep-dal4eooae00c73fhi2k0`, exact release SHA.
- Candidate run
  [35069737462](https://github.com/ThienAress/htcoachingweb/actions/runs/35069737462): success.
- AC-008 passed all 9 flows with cleanup `verified=true`, `residue=0`.
- Signed AC-009 passed live KB/provider, provenance/citation, paced conversation
  isolation, Stop, injected provider-boundary failure followed by Retry/Edit,
  root/variant searches and request-cohort runtime binding. All nine receipts
  settled on one release SHA/runtime fingerprint; cleanup `residue=0`.
- Positive provider/KB behavior was not response-mocked.

## Recovery And Rollback Gate

- Backup ID: `production-logical-backup-20260916T055310Z`.
- Release readiness and isolated/off-device disaster recovery: passed.
- Production writes made by backup/verification: zero.
- Client rollback deploy ID: `6a9e7a095056d3f4716b86be`.
- Server rollback deploy ID: `dep-daf82d740ujc73a2mfr0`.
- `continuousRecoveryAvailable=false` remains explicit. The verified logical
  backup is not PITR; paid Atlas backup plus an isolated point-in-time restore
  drill require a separate owner/cost decision.

## Promotion And Production Identity

- Promotion gate
  [35070218108](https://github.com/ThienAress/htcoachingweb/actions/runs/35070218108): success.
- Production client deploy: Netlify `6aaa4bfd61cc19000835e129`, exact release SHA.
- Production server deploy: Render `dep-dal4ojjm8hqs73etisn0`, exact release SHA.
- Two temporary release-candidate refs were deleted only after confirming no
  open PR depended on them and all deploy/recovery evidence remained addressable
  by immutable IDs. The published Netlify deploy remained `ready` after deletion.

## Observation And Decision

- Production monitor
  [35074643825](https://github.com/ThienAress/htcoachingweb/actions/runs/35074643825): success.
- Observation gate
  [35074803868](https://github.com/ThienAress/htcoachingweb/actions/runs/35074803868): success.
- Window: `2026-09-16T08:05:22.173Z` to `2026-09-16T08:37:48.939Z`.
- Observed 9 HTTP requests, 0 HTTP errors, 0 server errors and 0 active alerts.
- Final decision: `KEEP`.

Historical NO-GO and provider incidents remain documented in Plan 090A. They are
not deleted or rewritten; this report records the later fresh evidence that
superseded them.
