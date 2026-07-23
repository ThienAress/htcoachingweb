# Recipe, AI And Remaining Release Gates

Date: 2026-07-23
Branch: staging
Status: code and isolated-data validation complete; production data gates remain closed

## Scope

This follow-up covers the local Recipe empty-state incident, Gemini tool-call
failure, Knowledge Base status interpretation, local database isolation and the
remaining production release gates reported in `van_de.txt`.

No production or staging database write was performed during this work.

## Gemini and Recipe code fixes

- Gemini tool declarations now remove provider-unsupported
  `additionalProperties` only from the outbound Gemini schema. Internal Ajv
  validation remains unchanged.
- A provider HTTP 400 retries once without tools and logs only bounded error
  metadata.
- The Recipe explorer now distinguishes an API failure from an empty result and
  provides a retry action.
- Regression coverage includes Gemini schema sanitization/retry and Recipe API
  error rendering.

## Local database boundary

- Doppler `htcoaching-server/dev` now targets `htcoaching_staging`, not
  production `gym-app`.
- The production backup was checksum-verified and decrypted into a temporary
  current-user-only workspace.
- Only the `recipes` collection was restored into a local MongoDB instance named
  `htcoaching_recipe_dryrun`.
- Hard locks rejected `gym-app`, `htcoaching_staging` and any unexpected target.

The encrypted recovery archive remains unchanged. The temporary plaintext copy
and local database remain available only for owner review and must be removed
after the owner confirms cleanup.

## Recipe publication dry-run

Snapshot time: 2026-07-23T08:02:13Z

| Check | Result |
| --- | ---: |
| Restored recipes | 757 |
| Legacy MealDB candidates missing `isPublished` | 747 |
| Candidates passing the current Mongoose schema | 747 |
| Invalid candidates | 0 |
| Duplicate MealDB slug groups | 0 |
| Explicit AI drafts | 10 |

The local preview changed only the temporary database:

- 747 MealDB recipes were set to `isPublished: true`;
- 10 AI recipes remained `isPublished: false`;
- the local API returned 747 public recipes and 63 pages at a page size of 12;
- Chromium rendered 12 Recipe cards on page one with no Recipe error alert.

Phase 3 now performs the same fail-closed preflight before any write. It
publishes only valid legacy MealDB documents that still lack the field and sets
other legacy sources missing the field to draft. An explicit false value is
never overwritten.

## Render configuration audit

Metadata was read through the authorized Render API without printing secret
values.

- staging: one free web instance, liveness path configured, bank variables
  configured, CSP enforced, jobs disabled, retention enforcement disabled and
  ops token configured;
- production: one free web instance with 41 prepared variables, bank values and
  ops token configured, CSP enforced, jobs/retention disabled, explicit trust
  proxy and private F1 storage. Strict readiness now reports 0 findings. These
  values are prepared but do not affect runtime until a deploy occurs.

Production topology is therefore:

1. Deploy the single web instance with background jobs disabled.
2. Observe health, smoke, logs, 5xx and integrity metrics for 30 minutes.
3. Because a free Render plan cannot run a dedicated worker, enable jobs on the
   same single instance only after the observation window is clean.
4. Do not scale beyond one instance while jobs are enabled. A future scaled
   deployment must move jobs to one paid worker or a queue-backed scheduler.

## Monitoring and RUM

- A protected read-only seven-day RUM baseline endpoint now aggregates only
  normalized route, device, metric, counts, p75, average, maximum and rating
  totals.
- The production monitor now captures CSP/RUM Prometheus summaries and the RUM
  baseline.
- GitHub Actions retains each successful monitor snapshot for eight days.

This prepares the baseline but does not manufacture seven days of evidence. The
baseline clock starts when the new production server/client are deployed and
RUM samples begin arriving. `baselineReady` must be true before performance
claims are approved.

## Remaining owner/data gates

- Completed: copy and verify production bank values in Render secret storage.
- Completed: configure the production ops token and matching GitHub Actions
  secret without printing either value.
- Configure production readiness health check after the new endpoint deploys.
- Completed: run the F1 retention dry-run against the isolated production
  snapshot. It returned 0 candidates and preserved the collection fingerprint.
- Resolve 3 Phase 8 legacy media records whose source files are absent before
  any merge or migration.
- Approve the exact production migration phase list and Recipe publication
  result before any real database write.
- Merge/deploy server first, run smoke, then deploy the client and observe for
  30 minutes.
- Keep CSP and retention rollback switches available.

GitHub cached pull-request refs are already classified as non-sensitive and are
not a release blocker. No support purge is required.

## Verification completed

- focused Gemini tests: 3/3;
- focused Recipe Chromium E2E: 3/3;
- final server suite: 157/157;
- final client suite: 98/98;
- client lint: passed;
- production build: 33/33 prerender routes and bundle budget passed;
- final browser matrix: 138/138 across Chromium, Firefox and WebKit;
- Recipe migration and RUM integration tests: 12/12;
- production monitoring unit tests: 4/4;
- secret scan and repository data-boundary scan: passed;
- client, server and root dependency audits: zero vulnerabilities;
- staging strict production-readiness check: zero errors and warnings;
- current production strict check: 0 errors and 0 warnings after the approved
  no-deploy env preparation;
- production remains NO-GO because Phase 8 preflight found 3 missing legacy
  media sources, not because of environment configuration.

The production build used its documented fallback mode because the old
production server still times out dynamic sources and returns HTTP 404 for the
new Recipe API. Existing sitemap routes were preserved and this is expected to
clear only after server-first deployment.
