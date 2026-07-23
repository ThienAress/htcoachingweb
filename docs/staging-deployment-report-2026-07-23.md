# Staging Acceptance Report - 2026-07-23

## Decision

The seven staging validation groups are complete. Staging is isolated, deployed,
and suitable for continued pre-production testing. This report does not approve
or perform a merge to `main`, a production migration, or a production deploy.

One real contract authorization defect was found by live acceptance, fixed on
`staging`, covered by a regression test, deployed, and verified remotely.

## Scope and topology

- Branch: `staging`. Validated runtime candidate SHA: `7f09200`.
- Client: `https://staging--htcoachingweb.netlify.app`.
- API: `https://htcoachingweb-staging.onrender.com`.
- Database: exact isolated database `htcoaching_staging`.
- Secrets: Doppler `htcoaching-client/stg` and `htcoaching-server/stg`.
- Staging admin owner: `hoangthiengym99@gmail.com`.
- Background jobs, outbound email, and F1 retention enforcement remain disabled.
- Cloudinary writes are isolated under the staging prefix.
- Production data was not written. Production was read only through approved
  public GET endpoints for a bounded blog import.

## 1. Guarded staging data

The new operation guard requires all of the following before a write script can
run:

1. `APP_ENV=staging`.
2. The MongoDB URI names exactly `htcoaching_staging`.
3. Existing staging environment safety checks pass.
4. The operation-specific confirmation variable equals `yes`.

The seed is idempotent and marks managed documents with `_stagingFixture`.
Cleanup only targets marked fixtures and refuses to overwrite unmanaged data.

Seed result:

- 12 bounded public blog summaries imported from the production public list.
- 1 synthetic blog, recipe, trainer, story, exercise, food, and gym.
- 1 synthetic trainer, 2 synthetic clients, 2 approved orders, and 3 wallets.
- 1 draft synthetic Knowledge Base entry.
- Production recipe import was skipped because the production recipe list API
  returned 404; the synthetic recipe keeps staging testable without copying
  private or unknown data.

## 2. Remote business acceptance

Eight guarded write flows passed against the deployed staging API:

- permission boundaries returned 401/403 as expected;
- blog CRUD and XSS sanitization;
- recipe draft, publish, detail, bookmark, unbookmark, and delete;
- check-in idempotency and session restoration;
- coaching revision conflict, feedback, and cleanup;
- concurrent schedule claim with exactly one 201 winner and one 409 loser;
- booking replay, transition validation, contact, and archive;
- deposit approve/replay/delete protection/reversal plus wallet reconciliation.

Three extended live flows also passed:

- Knowledge Base create, real embedding, publish, semantic search, variant
  embedding, read, and cleanup: `201/200/200/200/200`.
- Contract draft, owner read, cross-client IDOR denial, and cleanup:
  `201/200/403/200`.
- F1 customer, intake, two authenticated private media uploads, private signed
  read, assessment, deterministic AI report, idempotent replay, coach approval,
  privacy deletion, provider cleanup, and dependent-data cleanup.

F1 deletion finished with status `completed`. Phase 8 and Phase 9 verifiers
both reported `totalIssues: 0` after cleanup.

## 3. External integrations

Approved staging-only integration checks passed:

- Google OAuth redirected with signed state, the staging client ID, and the
  exact staging callback.
- AI SSE returned conversation, text, and done events; the synthetic
  conversation was persisted and then deleted.
- Cloudinary uploaded one generated image under the staging prefix and deleted
  it immediately.
- Knowledge Base embedding create/search/variant calls succeeded with bounded
  synthetic text.
- F1 stored two generated images as authenticated private assets and removed
  both through the application privacy lifecycle.

No customer photo, real health record, real payment, or real email was used.

## 4. Security and data integrity

- Remote security smoke: 7/7 passed.
- Allowed and denied CORS behavior passed.
- Operations endpoints rejected anonymous access.
- Legacy public F1 media paths returned 404.
- Unknown API paths returned bounded JSON errors.
- Repository secret scanner passed.
- Repository data-boundary scanner reported zero violations.
- Phase 4 index verification passed.
- Phase 7, 8, and 9 integrity verifiers reported zero issues.
- Wallet reconciliation reported zero issues.
- Query explain samples stayed below the review threshold:
  blog 12 docs/13 keys, recipe 1/1, orders 2/2, KB 0.
- Load smoke completed 30 requests at concurrency 3 with zero failures:
  p50 399.70 ms, p95 729.66 ms, maximum 838.91 ms.

## 5. Recovery and rollback

A guarded staging recovery drill created an in-memory BSON snapshot of 28
fixture documents across 11 collections, deleted a synthetic exercise,
restored it, and verified the complete snapshot hash before and after.

Rollback inventory was reviewed:

- Netlify has previous ready deploys that can be selected for a client rollback.
- Render showed only the current live deploy at the time of inspection, so
  server rollback must use a known Git SHA/redeploy until a second retained
  Render deploy exists.
- Database restore was not performed because no corruption occurred.
- A verified production backup identifier is required before any production
  migration. Backup `production-logical-backup-20260723T080213Z` now provides that
  recovery evidence, but no production migration is authorized by this report.

## 6. Monitoring and logs

- `scripts/staging-health.mjs` checks client HTML, manifest, liveness,
  readiness, public blog, recipe list contract, and recipe taxonomy contract.
- GitHub workflow `Staging Health and Security` runs on staging pushes,
  manually, and every 30 minutes.
- Workflow run `29949258368` passed.
- Prometheus metrics required the operations token.
- Four reviewed alerts were inactive: financial reconciliation mismatch,
  F1 media cleanup, reminder failure, and HTTP 5xx.
- The reviewed 60-minute Render window contained zero request 5xx events.
  Error events were expected negative security/transition probes.
- Live staging health passed 7/7 and security smoke passed 7/7.

## 7. Build, CI, and deployment

Local release gates:

- Server: 29 files and 139/139 tests passed.
- Client: 6 files and 87/87 tests passed.
- Client ESLint passed.
- Production client build passed.
- Prerender passed for 33 routes.
- Bundle budget passed.
- Chromium E2E passed 45/45.
- Firefox E2E passed 45/45.
- WebKit E2E passed 45/45.
- Secret and repository-boundary scans passed.
- `git diff --check` passed.

GitHub checks for deployed SHA `5f9fe35` all passed:

- secrets;
- server;
- client;
- e2e;
- read-only staging health/security monitor.

Commits were separated by function:

- `097566f test(staging): add guarded acceptance tooling`
- `7e96221 fix(contracts): authorize populated references correctly`
- `5f9fe35 ci(staging): monitor health and security`

## Defect found and fixed

Live contract acceptance found that the owning client received 403. Contract
references had already been populated into User documents, but authorization
compared the populated object directly with a user ID string.

The fix normalizes both populated and raw Mongoose references before comparing.
It covers contract detail, sign, download, view, and client-download checks.
Regression tests passed locally, and the deployed API now returns 200 for the
owner and 403 for an unrelated client.

An earlier staging pass also found relative manifest/favicon URLs failing on
nested routes. Commit `dade95c` changed them to absolute paths and corrected
the manifest branding; live MIME, icon, and nested-route checks passed.

## Production recipe 404 analysis

The production Recipe API still returns 404 for both `GET /api/recipes?limit=1`
and `GET /api/recipes/categories`. The deployed `main` branch does not contain
the Recipe controller/router or mount `/api/recipes`; this is a deployment
branch gap, not a recipe-data privacy rule or a failing staging handler.

The implementation already exists on `staging`. Its security/content
integration tests passed 10/10, the public list and taxonomy contracts passed
live staging health checks, and `scripts/staging-health.mjs` now guards both
contracts. Production was only queried with bounded public GET requests and was
not changed. Enabling Recipe in production requires a later explicit merge and
production deployment approval.

Cross-browser validation also exposed and fixed two races on staging: stale AI
history could replace a newly streamed response, and the F1 intake test relied
on browser-dialog timing. Regression coverage now controls both asynchronous
boundaries. Firefox and WebKit each passed all 45 E2E tests with three workers.

## Strict production build gate

Sitemap generation and prerender now share one dynamic-route policy for customer
stories, trainers, Blog and Recipe. Netlify production metadata automatically
enables strict mode. A production build now fails when:

- SKIP_DYNAMIC_ROUTES is enabled;
- the route source points to the staging or another unapproved API;
- any dynamic API returns 404, an invalid contract, or a permanent error;
- bounded retries cannot recover a timeout, 429, or transient 5xx;
- any discovered route fails to produce meaningful prerendered content.

The strict release build was exercised read-only against the staging API. It
generated 24 sitemap routes and prerendered 24/24 routes, including the staging
Recipe detail. Unit coverage passed 94/94 client tests. The generated staging
sitemap was restored after validation and was not committed as production
content.

## Remaining gates before production

These items are intentionally not marked complete:

- Establish a retained Render rollback candidate and record the rollback owner.
- Merge the validated Recipe API implementation into `main` and deploy it only
  after explicit production approval; production remains 404 until then.
- Wire the retained external Prometheus scrape for production metrics.
- Record the planned seven-day RUM baseline.
- Perform a separate final diff review and explicit merge decision.
- After production deployment, observe application, financial, schedule, AI,
  F1, privacy, CSP, and 5xx metrics for the full release window.

Closed after this report's original staging validation:

- `current_kb_entries.txt` was confirmed to contain a Google Search Console
  verification value, not a credential. No revocation is required, and GitHub
  cached-ref removal is not available or required for non-sensitive data.
- The Free Atlas tier has no on-demand snapshot. A verified, encrypted logical
  production backup was recorded as
  `production-logical-backup-20260723T080213Z`; see
  `docs/production-backup-record-2026-07-23.md`.
- External email alert delivery was verified on 2026-07-23. The owner received
  the GitHub Actions failure email for staging workflow run `29991149545` and
  the Render email for controlled failed staging deploy
  `dep-d9gtjg61a83c73bt8ao0`. The staging build command was immediately restored
  to `npm ci`; live deploy `dep-d9gteu6rnols73enjk10` remained active and the
  public liveness endpoint returned HTTP 200 after the drill.

## Final migration and runtime hardening

Candidate `610c576` includes the fail-closed controls without running any
migration or writing staging/production data:

- Phase 1-9 migration entrypoints require exact `APP_ENV`, database lock, and
  phase confirmation.
- Production migration entrypoints additionally require a verified backup ID,
  approval ID, and the exact production confirmation phrase.
- The connected database is rechecked before writes; Phase 7 performs this
  check before its slot-claim rebuild.
- Background jobs start only for explicit `BACKGROUND_JOBS_ENABLED=true`.
- DOMPurify is pinned to 3.4.12 and Node to patched 22.23.1 across hosting
  manifests and CI workflows.

Local verification after these changes passed 148 server tests, 94 client
tests, lint, runtime logging, all three dependency audits, secret/data-boundary
scans, static and strict builds, and 135 Chromium/Firefox/WebKit E2E tests. The
strict read-only staging build again generated and prerendered 24/24 routes.

GitHub CI run `29982739171` passed all four jobs for code candidate `67c4bc1`.
The current staging candidate `610c576` subsequently passed all four jobs in
CI run `29991149572`. A separate
post-deploy direct check at `2026-07-23T05:37:49Z` passed staging health 7/7
and security smoke 7/7, including live/ready, Blog, Recipe, Recipe taxonomy,
CORS, operations authentication, private F1 legacy-path denial, and bounded
unknown-API behavior.

Full operational details and the production-only gates are recorded in
`docs/migration-runtime-hardening-report-2026-07-23.md`.
