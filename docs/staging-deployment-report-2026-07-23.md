# Staging Deployment Report - 2026-07-23

## Decision

Staging is isolated and ready for read-only acceptance testing. Production has
not been merged, migrated, or deployed. Remote write-flow testing and external
provider tests remain gated because they can create data or consume quota.

## Deployed topology

- Branch: `staging`
- Client: `https://staging--htcoachingweb.netlify.app`
- API: `https://htcoachingweb-staging.onrender.com`
- Client fix commits: `49457df` and `dade95c`
- Latest Netlify deploy: `6a6102ecca745a00083fcfe7` (`ready`)
- Database: `htcoaching_staging` on Atlas `Cluster0`
- Database user: scoped to `readWrite@htcoaching_staging` only
- Secrets: Doppler `htcoaching-client/stg` and `htcoaching-server/stg`
- Background jobs: disabled
- Email delivery: disabled
- F1 retention enforcement: disabled
- CSP enforcement: enabled
- Bank transfer configuration: staging-only fake values

The production Render service, production database, and `main` branch were not
changed during this rollout.

## Isolation and safety evidence

- Startup guard requires the exact database name `htcoaching_staging`.
- Startup guard rejects production API/client origins in staging.
- Outbound email and background jobs are disabled in staging.
- Cloudinary writes, when later approved, are prefixed under
  `htcoaching/staging/`.
- Netlify bundles contain the staging API origin and zero production API origin
  matches.
- Google OAuth uses the exact staging callback URL and a signed redirect state.

## Database preparation

- Phase 1, 2, and 3 migrations completed.
- Phase 4 indexes completed and verification reported all indexes present.
- Phase 6 migration completed; pre/post wallet reconciliation reported zero
  issues.
- Phase 7 migration and verification completed with `totalIssues: 0`.
- Phase 8 migration and verification completed with `totalIssues: 0`.
- Phase 9 migration and verification completed with `totalIssues: 0`.
- Retention is configured for 30 days but enforcement remains disabled.

## Authentication acceptance

Google OAuth was completed with the project owner account after explicit owner
approval. Verification confirmed:

- one matching staging user exists;
- role is `admin`;
- no production user record was read or modified;
- wallet reconciliation after login checked one wallet and zero transactions,
  deposits, or subscriptions, with `totalIssues: 0`.

Current non-empty staging collections after acceptance:

| Collection | Documents | Reason |
| --- | ---: | --- |
| `counters` | 1 | Migration/system state |
| `sitesettings` | 1 | Application default |
| `users` | 1 | Approved staging admin login |
| `wallets` | 1 | Default wallet for the staging user |
| `webvitalsamples` | 8 | Staging browser telemetry |

No order, payment, contract, check-in, coaching, F1 customer, AI conversation,
blog, or recipe documents were created.

## Live staging verification

- API liveness, readiness, and compatibility health endpoints returned 200.
- Security smoke passed allowed/denied CORS, anonymous metrics rejection,
  private F1 legacy path rejection, and JSON 404 behavior.
- Prometheus metrics returned 200 only with the staging operations token.
- Twenty authenticated read-only API checks passed for user/admin, AI history,
  knowledge base, blog, check-in, F1, coaching, workout plans, orders, bookings,
  deposits, contacts, contracts, subscriptions, operations, privacy, and wallet.
- Six authenticated admin/trainer browser routes rendered without horizontal
  overflow; all non-safe browser methods were blocked by the test harness.
- Remote browser traffic contained zero production API requests and zero API
  responses with status 5xx.

## Defect found during acceptance

Nested routes resolved `./favicon/site.webmanifest` under the current route and
received the SPA HTML fallback, causing a manifest JSON syntax error. The fix:

- changes favicon and manifest links to absolute `/favicon/...` paths;
- changes manifest icon URLs to `/favicon/...`;
- replaces placeholder manifest names with `HTCOACHING`.

Build validation parses the generated manifest, finds both icon files, and
reports zero production API origin matches. Live Netlify verification returns
`application/manifest+json; charset=utf-8`, both icons return `image/png`, and
the authenticated Blog admin page reports zero console/manifest errors.

## Test evidence

- Client lint: passed.
- Client unit tests: 87/87 passed.
- Server tests: 134/134 passed.
- Chromium E2E: 45/45 passed.
- Staging client build, sitemap, prerender, and bundle budget: passed.
- Secret scanner and repository data-boundary checks: passed before rollout and
  again after the final local changes.
- GitHub CI run `29944079149` for commit `dade95c`: passed.

The first local full-test attempt timed out while downloading the MongoDB test
binary. Re-running after the download completed produced the 134/134 server
result above; this was an environment timeout, not a test assertion failure.

## Remaining gates before production

- Obtain owner approval before remote write-flow tests that create business
  records or call paid/shared AI and Cloudinary providers.
- Run the approved staging write matrix for check-in, coaching, scheduling,
  content, contracts, wallet/deposit, F1 media, and AI/KB behavior.
- Configure external monitoring/alert delivery and observe staging health.
- Review the final diff and CI result, then make a separate merge decision for
  `staging` into `main`.
