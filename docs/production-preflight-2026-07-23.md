# Production Preflight Report

Date: 2026-07-23
Source branch: `staging`
Candidate before this report: `be5e038`
Decision: `NO-GO` until the Phase 8 legacy-media blocker is resolved

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

## Phase 8 blocker

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

## Required owner decision

Before merge or production migration, choose one evidence-backed disposition:

1. Recover the three original media files from a trusted backup, then run the
   private-media migration.
2. Confirm the three records are disposable test data and explicitly approve
   removal through a bounded production data change.
3. Preserve the records as unavailable legacy evidence and approve a dedicated
   migration that marks them failed without pretending private objects exist.

No production database write, F1 deletion, merge, or deploy was performed by
this preflight. Options 2 and 3 are real production data changes and require a
separate explicit approval with an approval ID.

## Files changed

- `server/src/scripts/localF1RetentionDryRun.js`
- `server/package.json`
- production release documentation listed in the corresponding release commit
