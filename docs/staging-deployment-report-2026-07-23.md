# Staging Acceptance Report - 2026-07-23

## Decision

The seven staging validation groups are complete. Staging is isolated, deployed,
and suitable for continued pre-production testing. This report does not approve
or perform a merge to `main`, a production migration, or a production deploy.

One real contract authorization defect was found by live acceptance, fixed on
`staging`, covered by a regression test, deployed, and verified remotely.

## Scope and topology

- Branch: `staging`. Validated application SHA: `5f9fe35`.
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
- A real Atlas snapshot identifier is still required before any production
  migration.

## 6. Monitoring and logs

- `scripts/staging-health.mjs` checks client HTML, manifest, liveness,
  readiness, public blog, and public recipe endpoints.
- GitHub workflow `Staging Health and Security` runs on staging pushes,
  manually, and every 30 minutes.
- Workflow run `29949258368` passed.
- Prometheus metrics required the operations token.
- Four reviewed alerts were inactive: financial reconciliation mismatch,
  F1 media cleanup, reminder failure, and HTTP 5xx.
- The reviewed 60-minute Render window contained zero request 5xx events.
  Error events were expected negative security/transition probes.
- Live post-deploy health passed 6/6 and security smoke passed 7/7.

## 7. Build, CI, and deployment

Local release gates:

- Server: 29 files and 139/139 tests passed.
- Client: 6 files and 87/87 tests passed.
- Client ESLint passed.
- Production client build passed.
- Prerender passed for 33 routes.
- Bundle budget passed.
- Chromium E2E passed 45/45.
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

## Remaining gates before production

These items are intentionally not marked complete:

- Revoke the suspected Google App Password and complete the GitHub cached-ref
  incident tasks owned by the account owner.
- Create and record a real Atlas backup snapshot immediately before production
  migrations.
- Establish a retained Render rollback candidate and record the rollback owner.
- Resolve or intentionally retire the production recipe list API that returns
  404; staging currently uses a synthetic recipe.
- Wire external alert delivery and send a test alert to the owner.
- Record the planned seven-day RUM baseline.
- Run Firefox/WebKit browser coverage in addition to Chromium.
- Perform a separate final diff review and explicit merge decision.
- After production deployment, observe application, financial, schedule, AI,
  F1, privacy, CSP, and 5xx metrics for the full release window.
