# Production Release Plan

Date: 2026-07-23
Status: prepared, NO-GO until the remaining production data/configuration gates close
Source branch: staging
Target branch: main

## 1. Release decision

The staging candidate at `be5e038` includes the validated Recipe API,
monitoring, strict dynamic-route build, migration fail-closed controls,
DOMPurify patch, and pinned Node runtime. Local browser, build, dependency and
security gates passed. CI run `30020318399` passed, and post-deploy staging
health/security run `30020317867` attempt 2 passed after the candidate became
live. Owner-controlled production data gates below still block any merge
decision.

Do not merge while any of these blockers is unresolved:

- production environment preparation is complete with 0 readiness errors and
  warnings, but the prepared values are not active until the server deploys;
- the protected metrics/RUM collector is implemented but not yet deployed and
  verified against production;
- the F1 retention dry-run found 0 candidates, but Phase 8 found 3 legacy media
  records whose source files are missing;
- the exact production migration list and owner approval for real database
  writes are incomplete;
- the seven-day RUM baseline cannot complete until seven days after deployment;
- required items in release-checklist.md remain open.

Deployment and rollback owner: `Hoang Thien`, the solo repository
owner/operator. The initial observation window is 30 minutes after server and
client smoke, with exact UTC start/end recorded during rollout.

Production has one free Render web instance. Deploy with
`BACKGROUND_JOBS_ENABLED=false`. After a clean observation window, that same
single instance is the designated combined web/job runner. Do not scale while
jobs are enabled; a scaled topology requires one dedicated worker or a
queue-backed scheduler.

No production database migration or retention operation is authorized by this
plan.

Detailed current evidence is in
`docs/production-preflight-2026-07-23.md`.

## 2. Current production baseline

The read-only baseline captured before this release has expected failures
because production still runs the older main branch:

- public Blog list returns HTTP 200;
- liveness and readiness routes return HTTP 404;
- Recipe list and Recipe taxonomy return HTTP 404;
- the web manifest returns application/octet-stream instead of
  application/manifest+json.

The current public production smoke therefore fails closed before deployment.
The new server routes and Recipe API must be deployed before the client. The
client deployment contains the Netlify manifest header rule.

## 3. PR shape

Use one reviewed PR from staging to main. Preserve the phase commits with a
merge commit; do not squash the audit trail. Before opening the PR:

    git fetch origin main staging --prune
    git status --short --branch
    git diff --check origin/main..origin/staging
    git merge-tree --write-tree origin/main origin/staging

Required PR checks:

- client lint, tests, audit and production build;
- server tests, runtime logging check and dependency audit;
- Chromium E2E plus the scheduled full browser matrix evidence;
- secret scanner and repository data-boundary scanner;
- operations monitoring unit tests;
- read-only staging health/security monitor.

Suggested PR title:

    release: production hardening phases 1-10 and staging validation

The PR description must link the staging deployment report, this release plan,
the rollback runbook and the production backup evidence. It must also record:

- candidate Git SHA;
- previous production server SHA/deploy ID;
- previous production client deploy ID;
- migration list, or explicitly state that no migration is approved;
- deployment owner and rollback owner;
- UTC observation window.

## 4. Pre-merge controls

1. Freeze unrelated changes on staging.
2. Confirm the exact Render and Netlify production targets.
3. Completed: set BACKGROUND_JOBS_ENABLED=false on the single production web instance.
   After application health is proven for 30 minutes, enable jobs on that same
   instance. Do not add a second instance while jobs are enabled.
4. Completed: configure the GitHub secret PRODUCTION_OPS_METRICS_TOKEN with the
   same value as the Render OPS_METRICS_TOKEN. Neither value was printed.
5. Completed: confirm alert delivery reaches the owner. The owner received both
   the GitHub Actions failure email for staging workflow run `29991149545` and
   the Render failed-deploy email for controlled staging deploy
   `dep-d9gtjg61a83c73bt8ao0` on 2026-07-23. GitHub Issues delivery remains part
   of the first production-monitor failure drill after merge.
6. Completed: create and verify production logical backup
   `production-logical-backup-20260723T080213Z`. The Free Atlas tier does not support an
   on-demand cloud snapshot. Evidence is in
   `docs/production-backup-record-2026-07-23.md`. Production migration execution
   also requires
   `MIGRATION_TARGET_DATABASE`, `MIGRATION_BACKUP_SNAPSHOT_ID`,
   `MIGRATION_APPROVAL_ID`, and `CONFIRM_PRODUCTION_MIGRATION=production`.
7. Blocked by the Phase 8 data gate: lock or pause Netlify production publishing so the client cannot publish
   before the new server endpoint is healthy.
8. Confirm the Netlify build reports strict dynamic route mode. Netlify
   production metadata enables this automatically; SKIP_DYNAMIC_ROUTES is
   rejected and the route API is locked to the production Render origin.
9. Re-run all required PR checks and require a clean final diff.

## 5. Merge and deploy sequence

1. Merge staging into main with a merge commit during the approved window.
2. Record the merge SHA immediately.
3. Deploy the Render server at that exact SHA with background jobs disabled.
4. Verify liveness, readiness, public Blog API, Recipe API and Recipe taxonomy.
5. Run approved migration and verifier commands only if the owner separately
   approves the real database operation.
6. Run the public production smoke command.
7. Publish the Netlify client at the same SHA only after the API checks pass.
   NETLIFY=true with CONTEXT=production automatically requires all dynamic
   sources and all prerendered routes. REQUIRE_DYNAMIC_ROUTES=true remains
   available for strict staging/local release drills.
8. Run the public smoke again and then the protected production monitor.
9. Unlock Netlify publishing only after the dynamic sitemap contains current
   Blog and Recipe routes.
10. Observe health, logs, 5xx and integrity metrics for at least 30 minutes.
11. Enable background jobs on the single combined web/job instance only after
    the observation window is clean.

## 6. Production smoke commands

These commands are read-only. They perform GET requests only and reject any
origin outside the hard-coded production allowlist.

PowerShell public smoke:

    $env:ALLOW_REMOTE_PRODUCTION_SMOKE = "true"
    npm run smoke:production

Protected metrics and integrity alert check:

    $env:ALLOW_REMOTE_PRODUCTION_MONITOR = "true"
    $env:OPS_METRICS_TOKEN = "<load from the approved secret manager>"
    npm run monitor:production

Remove the local token environment variable after the check:

    Remove-Item Env:OPS_METRICS_TOKEN

The public smoke validates client HTML, manifest, live/ready endpoints, Blog,
Recipe, Recipe taxonomy and dynamic sitemap routes. The protected monitor reads
Prometheus metrics and operational alerts without reading customer records.

## 7. Observation commands

CI:

    gh run list --branch main --limit 20
    gh run watch <run-id> --exit-status

Public health:

    Invoke-RestMethod https://htcoachingweb.onrender.com/api/ops/health/live
    Invoke-RestMethod https://htcoachingweb.onrender.com/api/ops/health/ready

In Render logs, filter structured entries by event=http.request, status 500-599,
requestId and traceId. Do not paste cookies, tokens, AI prompts or customer data
into release notes.

Observe these counters and summaries:

- HTTP request/error count and HTTP P95;
- server errors and database query P95;
- AI errors, aborts, tool failures and latency;
- KB embedding failures and vector fallbacks;
- transaction aborts and revision conflicts;
- financial conflicts and reconciliation mismatches;
- schedule reminder failures;
- F1 upload/cleanup failures and orphans;
- CSP reports and RUM ingestion.

Any active critical/high operational alert, readiness failure, sustained 5xx or
integrity mismatch stops the rollout and starts the rollback runbook.

## 8. Monitoring workflow

.github/workflows/production-monitor.yml runs every 15 minutes from main and can
also be dispatched manually. It runs public smoke, reads protected metrics,
seven-day RUM aggregates and alerts, then fails on any active operational alert.
Each bounded aggregate snapshot is retained as a GitHub artifact for eight
days. On failure it opens one deduplicated GitHub issue titled [Production
monitor] Action required.

The issue is not auto-closed. The owner closes it only after recovery evidence
and a clean manual workflow run. GitHub monitoring supplements, but does not
replace, external per-replica Prometheus scraping and Render log retention.
Render log monitoring remains a platform task: the release owner must use the
dashboard or configure an approved log drain for structured event, status,
requestId and traceId fields.

Netlify documents NETLIFY and CONTEXT as read-only build metadata:
https://docs.netlify.com/configure-builds/environment-variables/#build-metadata
