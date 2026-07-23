# Production Release Plan

Date: 2026-07-23
Status: prepared, NO-GO until the owner completes the production gates
Source branch: staging
Target branch: main

## 1. Release decision

The staging baseline at b1ab077 passed CI, browser, Recipe API and live staging
checks. The monitoring changes after that baseline must receive a new staging
commit and green CI before they become the release candidate.

Do not merge while any of these blockers is unresolved:

- suspected credential revocation is not owner-confirmed;
- no production Atlas snapshot identifier is recorded;
- deployment owner, rollback owner and observation window are unnamed;
- production background-job topology is not explicit;
- the production monitoring secret and alert delivery test are incomplete;
- required items in release-checklist.md remain open.

No production database migration or retention operation is authorized by this
plan.

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
the rollback runbook and the Atlas snapshot evidence. It must also record:

- candidate Git SHA;
- previous production server SHA/deploy ID;
- previous production client deploy ID;
- migration list, or explicitly state that no migration is approved;
- deployment owner and rollback owner;
- UTC observation window.

## 4. Pre-merge controls

1. Freeze unrelated changes on staging.
2. Confirm the exact Render and Netlify production targets.
3. Set BACKGROUND_JOBS_ENABLED=false on every web replica. Enable jobs on only
   one designated worker after application health is proven.
4. Configure the GitHub secret PRODUCTION_OPS_METRICS_TOKEN with the same value
   as the Render OPS_METRICS_TOKEN. Never print either value.
5. Confirm GitHub Issues and Action failure notifications reach the owner.
6. Create an Atlas on-demand snapshot and record its identifier.
7. Lock or pause Netlify production publishing so the client cannot publish
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
11. Enable the single background worker only after the observation window is
    clean.

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
also be dispatched manually. It runs public smoke, reads protected metrics and
alerts, then fails on any active operational alert. On failure it opens one
deduplicated GitHub issue titled [Production monitor] Action required.

The issue is not auto-closed. The owner closes it only after recovery evidence
and a clean manual workflow run. GitHub monitoring supplements, but does not
replace, external per-replica Prometheus scraping and Render log retention.
Render log monitoring remains a platform task: the release owner must use the
dashboard or configure an approved log drain for structured event, status,
requestId and traceId fields.

Netlify documents NETLIFY and CONTEXT as read-only build metadata:
https://docs.netlify.com/configure-builds/environment-variables/#build-metadata
