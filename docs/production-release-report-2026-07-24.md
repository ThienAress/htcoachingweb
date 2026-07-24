# Production Release Report

Date: 2026-07-24
Branch: `fix/production-auth-and-data-migration`
Base commit: `fb38840629212fbe67a71893407458b31ce63b4d`
Status: deployed; automated post-deploy gates passed; owner Google login pending

## Scope

- Migrate reviewed production content and integrity metadata.
- Remove all F1 customer data confirmed by the owner as test-only.
- Fix production Google login cookie topology.
- Rebuild public blog and recipe sitemap/prerender routes.
- Validate production configuration, security, tests, and rollback evidence.

## Backup And Restore Gate

- Backup ID: `production-logical-backup-20260724T051142Z`.
- 46 collections and 3,104 documents were captured.
- Source fingerprint:
  `5594dd2fc1b6c58de374eb15b05869dbc36164de553a0eb561eebda41bac8fc4`.
- The AES-256 archive and Windows DPAPI-protected key were tested.
- An isolated restore on `127.0.0.1:27019` matched the source fingerprint.
- The source fingerprint was unchanged after restore verification.
- Plaintext archive and temporary restore data were removed.

## Authorized F1 Test Purge

The owner explicitly confirmed that every F1 customer record was test data and
authorized its complete removal from production.

Deleted documents:

| Collection | Deleted |
| --- | ---: |
| `f1customers` | 1 |
| `f1intakes` | 1 |
| `f1medias` | 3 |
| `f1assessments` | 1 |
| `f1aireports` | 4 |
| `f1resultpredictions` | 3 |
| `f1programs` | 1 |

- The legacy `f1programs` document was an orphan for an already absent customer.
- The media rows referenced localhost legacy data, not production Cloudinary
  assets. External asset deletions: 0.
- Remaining customer-scoped F1 documents: 0.
- F1 counter value: 0.
- Normal user accounts touched: 0; the production user count remained 13.
- The purge used exact-count guards and a MongoDB transaction with majority
  write concern.

## Production Migrations

Approval ID: `PROD-MIGRATION-20260724-AUTH-CONTENT-001`

Executed phases: `1 -> 2 -> 3 -> 6 -> 8 -> 9`.

- Phase 1 completed.
- Phase 2 completed. All 7 chat records have bounded metadata, no oversized
  conversations, and no remaining context images.
- Phase 3 validated 747 candidates, found 0 invalid rows and 0 duplicate slug
  groups, and published 747 MealDB recipes.
- Phase 6 reconciled 8 wallets, 14 transactions, and 4 contracts with 0
  integrity issues. One legacy contract field was backfilled.
- Phase 8 completed with no remaining F1 media, counter, or artifact issue.
- Phase 9 completed with 0 privacy verifier issues.

Independent verification:

- Required model indexes: present.
- Schedule verifier: 0 issues.
- F1 integrity verifier: 0 issues.
- Privacy verifier: 0 issues.
- Wallet reconciliation: 0 issues.
- Knowledge base: 67 records, 0 missing normalized questions.
- Recipes: 757 total, 747 published, 10 draft, 0 published AI recipes.

## Google Login Fix

Root cause:

- The OAuth callback writes host-only authentication cookies on
  `api.htcoachingweb.io.vn`.
- The deployed frontend called `htcoachingweb.onrender.com`, so `/api/user/me`
  could not receive those cookies and returned `Khong co token`.

Fix:

- Canonical production API:
  `https://api.htcoachingweb.io.vn/api`.
- Render `PUBLIC_API_ORIGIN`:
  `https://api.htcoachingweb.io.vn`.
- Netlify `VITE_API_URL`, `SITEMAP_API_URL`, and `PRERENDER_API_URL` now target
  the canonical API.
- The production smoke suite now verifies the Google provider redirect,
  canonical callback URI, and signed OAuth state.

The owner must still complete one real Google login in a browser after deploy;
the automated checks do not interact with the owner's Google account.

## Configuration Gate

- Render production service has 41 direct environment variables.
- Strict production readiness:
  `valid=true`, `fullyReady=true`, 0 errors, 0 warnings.
- Allowed origins: 2.
- CSP enforcement: enabled.
- Background jobs: explicitly disabled on the web instance.
- F1 retention enforcement: disabled.
- F1 consent version: `2026-07`.
- Render and Netlify configuration changes did not trigger a deploy.

## Test Evidence

- Client tests: 98/98 passed.
- Server tests: 158/158 passed.
- Production monitoring tests: 5/5 passed.
- Chromium, Firefox, and WebKit E2E: 138/138 passed.
- The isolated WebKit F1 lifecycle passed an additional 3/3 repeated runs.
- Client production build, 83-route prerender, and bundle budget passed.
- Secret scan passed.
- Repository data-boundary scan: 0 violations.
- Client and server dependency audits: 0 vulnerabilities.
- Client lint passed.
- `git diff --check` passed.

## Pre-Deploy Smoke

- Client, manifest, liveness, readiness, OAuth redirect, blog, recipe list,
  recipe taxonomy, and sitemap endpoints returned successfully after Render
  cold start.
- A full pre-deploy smoke correctly stopped because the currently deployed
  sitemap predates the 747 published recipe migration.
- The generated candidate sitemap contains the current first production recipe
  detail route and 83 total public routes.

## Deployment And Post-Deploy Gate

Release commit: `51df495c74e4233dafec082c69088db093b3659a`

- Staging CI run `30071292732`: success.
- Render staging deploy `dep-d9hg1mok1i2s739i2il0`: live at the exact release
  commit.
- The push-triggered staging health workflow started before the Render deploy
  was live and failed its first public API step. Direct checks after the exact
  deploy became live passed health 7/7 and security 7/7.
- Main CI run `30071600836`: success.
- Netlify production deploy `6a630256074b92000800b1e3`: ready at the exact
  release commit.
- Render production deploy `dep-d9hg7ifavr4c73ehiahg`: live at the exact
  release commit.
- Full production smoke: 11/11 passed, including Google OAuth topology, blog
  detail, recipe detail, and the dynamic sitemap.
- Protected production monitoring: success with 0 HTTP errors, 0 server
  errors, 0 integrity alerts, and HTTP P95 of about 161 ms.
- Five scheduled monitor runs (`30075102408`, `30084464997`, `30090924036`,
  `30099087577`, and `30106165724`) failed only the public smoke step after
  its 30-second API timeout; every protected metrics, integrity, and artifact
  step passed. A direct smoke while the API was awake passed 11/11, confirming
  the repeated failure pattern was the Render cold start rather than a broken
  endpoint.
- Follow-up operations commit `160b87408722fbd74f1fce902c3e368dce4685a6`
  adds a maximum of three attempts to the read-only liveness/readiness checks.
  Persistent failures still fail the workflow. Operations tests pass 7/7 and
  a real idle cold-start smoke timed out once, retried, then passed 11/11.
- Follow-up monitoring head `bcac627171dc0675528c8b6259a9a062ef24b4da`
  passed main CI run `30111725428` across client, server, secrets/ops, and E2E.
- Immediate production monitor run `30111725527` passed both public smoke and
  protected monitoring. It added a resolution comment to alert issue `#30` and
  closed the issue automatically with reason `completed`.
- Production bundle scan: 3 canonical API references and 0 legacy Render API
  references across 936,995 bytes.
- RUM currently has 58 samples and about 70 hours of coverage. The seven-day
  baseline is not ready; slow LCP on the homepage and login page remains a
  performance backlog item.

Pending manual gate:

- Complete one owner-driven Google login and confirm the authenticated account
  page loads without `Khong co token`.

Rollback must use the reviewed previous application deploy. Database rollback
must use the fresh backup only if a verified data regression requires it; an
application rollback does not automatically restore the database.
