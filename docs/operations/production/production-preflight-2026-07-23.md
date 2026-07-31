# Production Preflight Report

Date: 2026-07-23
Source branch: `staging`
Current code candidate: `639755b`
Decision: `NO-GO` until the owner explicitly approves the bounded Phase 8
production data change and the exact migration phase list

## Completed controls

- Render production service `srv-d70gd0fafjfc73csn9ag` now has 41 environment
  variables prepared through the authenticated Render API.
- The update did not trigger a deploy. The active deploy remained
  `dep-d9fhqjnaqgkc739h5r3g`.
- `MONGO_URI` and `REFRESH_SECRET` matched their pre-update hashes.
- `JWT_SECRET`, `LOG_HASH_SECRET`, and `OPS_METRICS_TOKEN` were generated with
  cryptographically secure random bytes. Their values were not printed.
- Production CORS contains only the canonical custom domain and the production
  Netlify domain. Localhost was removed.
- Private F1 storage and CSP enforcement are configured. Background jobs and
  F1 retention enforcement remain disabled.
- Bank and F1 consent variables match the validated staging values.
- GitHub Actions secret `PRODUCTION_OPS_METRICS_TOKEN` was synchronized and its
  metadata was verified without reading the stored value back.
- Strict production-readiness validation passed with 0 errors and 0 warnings.

The JWT rotation is only applied when the next server deploy starts. Existing
sessions can require a new login after that deploy. No account or application
record is deleted by the rotation.

## Staging evidence

- CI run `30031620632` passed all four jobs for `639755b`.
- Render staging deploy `dep-d9h5c0mpbkes73e54it0` became live at the exact
  candidate SHA.
- Staging Health and Security run `30031620921`, attempt 2, passed after that
  Render deploy was live, eliminating the initial deployment race.
- CI run `30020318399` passed for `be5e038`.
- Staging Health and Security run `30020317867`, attempt 2, passed after the
  Render deployment became live.
- Direct staging health passed all 7 public checks.
- Direct staging security smoke passed all 7 checks.
- The protected RUM baseline endpoint returned HTTP 200 with 16 samples in 14
  groups and about 22 hours of coverage. `baselineReady=false` is expected
  until the seven-day window is complete.
- `git merge-tree --write-tree origin/main origin/staging` completed without a
  conflict. The result matches the current staging tree.

## Isolated F1 dry-run

The encrypted production backup
`production-logical-backup-20260723T080213Z` was restored only to
`mongodb://127.0.0.1:27019/htcoaching_f1_dryrun`.

- 12 F1 collections and 14 total documents were restored with 0 restore
  failures.
- MongoDB reported a cross-minor restore warning (`8.0.28` to `8.2.6`). The
  application-level schema check then validated all 13 documents represented
  by current Mongoose models with 0 invalid documents.
- The retention sweep ran with `enforce=false`: 0 candidates and 0 queued.
- The full F1 collection fingerprint was identical before and after the
  dry-run.
- The reusable command is `npm run dry-run:f1-local`. Its script refuses every
  host, port, or database outside the exact isolated local target and also
  requires `ALLOW_LOCAL_F1_DRY_RUN=true`.

## Phase 8 production data gate

The snapshot contains 3 legacy F1 media records with no provider, status, or
private storage key. They contain legacy non-Cloudinary URL/public-id forms,
but the referenced local source files are absent. Phase 8 therefore fails
closed with 3 blocking missing-media sources.

The broader Phase 8 verifier reports 11 expected pre-migration issues:

- 3 public legacy media references;
- 1 missing F1 counter seed;
- 4 AI reports missing integrity metadata;
- 3 result predictions missing integrity metadata.

The metadata issues and counter can be backfilled deterministically. The three
missing media sources cannot be reconstructed from the database alone.

Candidate `639755b` implements the preserve-as-failed strategy without
weakening the default guard:

- Phase 8 still fails closed by default when a legacy source is missing.
- The only accepted override is the explicit `mark_failed` strategy; unknown
  values, including `delete`, are rejected.
- `mark_failed` also requires an integer approved count. Missing approval or a
  count different from the live preflight stops before any write.
- The bounded update preserves each media record and its relationships, marks
  it `failed`, records `PHASE8_MEDIA_SOURCE_MISSING`, clears the dead public
  URL/public ID, and never deletes a customer, intake, assessment, or artifact.
- An atomic filter prevents the migration from overwriting a media record that
  obtains a private storage key between preflight and update.

The production snapshot was restored again only to
`mongodb://127.0.0.1:27019/htcoaching_f1_migration_preflight`. The guarded local
command `npm run preflight:phase8-local` requires the exact host, port and
database, `ALLOW_LOCAL_PHASE8_MIGRATION_PREFLIGHT=true`, and all expected
media/consent/artifact backfill counts.

Local migration proof:

- the guard rejected a different database target;
- first run marked exactly 3 missing media records failed, backfilled 1 legacy
  consent, 4 AI reports and 3 result predictions, and ended with 0 verifier
  issues;
- second run modified 0 media, consent, report, forecast, or prediction records
  and again ended with 0 issues;
- all F1 document identities were unchanged and public legacy references fell
  to 0;
- focused integration tests passed 9/9 and the full server suite passed 158/158;
- secret scan, repository data-boundary scan, and runtime logging checks passed.

## Required owner approval

Before merge or production migration, the owner must explicitly confirm that
the three localhost media references are unavailable test artifacts and approve
the `mark_failed` operation against exactly those three records. The approval
must record:

- approval ID `PROD-PHASE8-20260723-001`;
- backup ID `production-logical-backup-20260723T080213Z`;
- exact target database `gym-app`;
- exact approved migration phase list;
- permission to mark exactly 3 media records failed, clear their dead URL and
  public ID, seed the F1 counter, backfill 1 legacy consent, 4 reports and 3
  predictions, and create the reviewed Phase 8 indexes;
- one-run `PHASE8_MISSING_MEDIA_STRATEGY=mark_failed` and
  `PHASE8_EXPECTED_MISSING_MEDIA_COUNT=3` values.

No production database write, F1 deletion, merge, or production deploy was
performed by this preflight. The code is validated on staging, but the real data
operation still requires the separate approval above.

## Files changed

- `server/src/scripts/localF1RetentionDryRun.js`
- `server/src/scripts/localPhase8MigrationPreflight.js`
- `server/src/migrations/20260720-phase8-f1-private-integrity.js`
- `server/src/controllers/__tests__/phase8.f1-integrity.integration.test.js`
- `server/package.json`
- production release documentation listed in the corresponding release commit
