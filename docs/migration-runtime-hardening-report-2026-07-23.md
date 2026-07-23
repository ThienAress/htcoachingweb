# Migration and Runtime Hardening Report

Date: 2026-07-23
Branch: staging
Candidate: `aba22a1`
Production decision: NO-GO until the owner-controlled gates are complete

## 1. Scope

This change closes the remaining migration and runtime safety findings from the
final production-readiness review. It changes operational preconditions only;
it does not execute a migration, modify staging fixtures, or write production
data.

## 2. Six migration and job controls

1. Phase 1, 2, and 3 now require their own explicit confirmation variable.
2. Every Phase 1-9 migration requires `APP_ENV` to be exactly `staging` or
   `production`.
3. Every migration requires `MIGRATION_TARGET_DATABASE` and rejects a MongoDB
   URI whose database name differs from that exact lock.
4. Production migrations additionally require a real Atlas snapshot identifier,
   a release approval identifier, and the exact production confirmation phrase.
5. The Phase 7 connected-database assertion runs before the empty
   `TrainingSlotClaim.deleteMany({})` rebuild can execute.
6. Background jobs now start only when `BACKGROUND_JOBS_ENABLED=true`.
   Missing, invalid, or false values disable jobs; production startup also
   rejects a missing/invalid value.

The connected Mongoose database is checked again after connection and before
any migration function is called. This prevents a URI/parser assumption from
bypassing the configured target lock.

## 3. Required migration contract

Every migration command requires:

    APP_ENV=staging|production
    MIGRATION_TARGET_DATABASE=<exact database name in MONGO_URI>
    CONFIRM_PHASE...=yes

Phase confirmation variables:

- Phase 1: `CONFIRM_PHASE1_INTEGRITY_MIGRATION`
- Phase 2: `CONFIRM_PHASE2_AI_KB_MIGRATION`
- Phase 3: `CONFIRM_PHASE3_CONTENT_MIGRATION`
- Phase 4: `CONFIRM_PHASE4_INDEX_MIGRATION`
- Phase 6: `CONFIRM_PHASE6_FINANCIAL_MIGRATION`
- Phase 7: `CONFIRM_PHASE7_SCHEDULE_MIGRATION`
- Phase 8: `CONFIRM_PHASE8_F1_MIGRATION`
- Phase 9: `CONFIRM_PHASE9_PRIVACY_MIGRATION`

Staging is additionally locked to `htcoaching_staging`.

Production additionally requires all of the following:

    CONFIRM_PRODUCTION_MIGRATION=production
    MIGRATION_BACKUP_SNAPSHOT_ID=<real Atlas snapshot identifier>
    MIGRATION_APPROVAL_ID=<owner-approved release/change identifier>

Snapshot and approval values shorter than eight characters or known placeholder
values are rejected. These values are one-run release evidence; do not store
them in source control.

No production migration is authorized by this report. The owner must approve
the exact phase list and real-data operation after the snapshot is complete.

## 4. Dependency and runtime controls

- DOMPurify is pinned to `3.4.12`.
- Node is pinned to `22.23.1` in `.node-version`, `.nvmrc`, all package
  manifests, and every GitHub Actions workflow.
- The pinned Node release is the patched Node 22 LTS line used for this release
  candidate.
- Root, client, and server dependency audits report zero vulnerabilities.
- Compatible transitive fixes updated `body-parser`, `brace-expansion`, and
  `js-yaml` in the client development lock graph.

The local workstation used Node `22.15.1`, so npm correctly emitted an engine
warning. CI and hosting must use the pinned `22.23.1`; a green CI run is the
runtime-version proof for release.

## 5. Verification evidence

- Migration/background/production-readiness targeted tests: 15/15 passed.
- Full server suite: 31 files, 148/148 tests passed.
- Full client suite: 7 files, 94/94 tests passed.
- Client ESLint: passed.
- Runtime logging policy: passed.
- Root/client/server dependency audit: zero vulnerabilities.
- Secret scanner: passed.
- Repository data-boundary scanner: zero violations.
- Operations monitoring tests: 3/3 passed.
- Static production build and bundle budget: passed, 8/8 prerender routes.
- Strict staging-backed release build: passed, 24/24 prerender routes.
- Chromium, Firefox, and WebKit E2E: 135/135 passed.
- `git diff --check`: passed.
- GitHub CI run `29982481091`: server, client, secrets, and E2E passed for
  candidate `aba22a1`.
- Post-deploy live staging health: 7/7 passed.
- Post-deploy live staging security smoke: 7/7 passed.

The build-generated staging sitemap was restored and was not committed.
The post-deploy checks completed at `2026-07-23T05:37:49Z` and included
HTTP 200 for Blog, Recipe list, Recipe taxonomy, liveness, and readiness.

## 6. Files changed

Migration/runtime safety:

- `server/src/config/migrationSafety.js`
- `server/src/config/backgroundJobs.js`
- `server/src/config/productionReadiness.js`
- `server/server.js`
- Phase 1, 2, 3, 4, 6, 7, 8, and 9 migration entrypoints
- migration, background-job, and production-readiness tests

Runtime/dependency pinning:

- `.node-version`, `.nvmrc`
- root, client, and server package manifests and lockfiles
- CI, nightly E2E, staging-security, and production-monitor workflows

Commits:

- `9c992ce fix(ops): fail closed on migrations and jobs`
- `aba22a1 chore(runtime): pin patched Node and DOMPurify`

## 7. Remaining owner and production gates

These are intentionally still open:

- owner confirms revocation of the suspected Google App Password and completes
  the GitHub cached-ref incident actions;
- owner creates and records the real Atlas on-demand snapshot;
- owner names deploy/rollback responsibility and approves the exact migration
  list, or explicitly approves a no-migration release;
- external alert delivery is wired and one test alert reaches the owner;
- staging-to-main merge and production server/client deployment are explicitly
  approved;
- production health, logs, 5xx, integrity metrics, CSP, and RUM are observed for
  the complete release window.

Until these gates are complete, `staging` is the validated candidate and
`main`/production remain unchanged.
