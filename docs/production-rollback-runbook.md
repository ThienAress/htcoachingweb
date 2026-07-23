# Production Rollback Runbook

Date: 2026-07-23
Scope: HTCOACHING production application rollback

## 1. Start conditions

Start rollback for any of the following:

- liveness or readiness remains unhealthy;
- sustained HTTP 5xx or severe P95 latency;
- authentication/authorization regression;
- financial reconciliation mismatch;
- schedule or booking integrity failure;
- private F1 media exposure or cleanup failure;
- confirmed data corruption;
- current Blog/Recipe routes disappear from sitemap after client release.

Name an incident lead and rollback owner. Record UTC time, main SHA, Render
deploy ID, Netlify deploy ID, Atlas snapshot ID and representative request IDs.

## 2. Immediate containment

1. Stop further rollout and do not run another migration.
2. Set BACKGROUND_JOBS_ENABLED=false on web replicas and the worker when job
   behavior or schema compatibility is uncertain.
3. Keep F1_RETENTION_ENFORCE=false.
4. Set CSP_ENFORCE=false only when CSP enforcement caused the regression.
5. Disable KB_VECTOR_INDEX when vector search is unhealthy.
6. Preserve structured logs and metric snapshots without PII or secrets.

Never manually edit wallet balances, contracts, schedule claims, coaching
revisions, deletion jobs or F1 provider keys during containment.

## 3. Application rollback order

Prefer an application rollback before any database restore.

Client-only failure:

1. Publish the previous known-good Netlify deploy.
2. Keep the newer backward-compatible server running.
3. Run client document, manifest and critical browser smoke.

Server/API failure:

1. If the new client depends on the failed endpoint, publish the previous client
   deploy first.
2. Roll Render back to the recorded previous production SHA/deploy.
3. Keep background jobs disabled until health and schema compatibility pass.
4. Verify live/ready, auth, Blog, Recipe and one critical journey per role.

Combined failure:

1. Roll back the client to stop new feature traffic.
2. Roll back the server to the recorded known-good deploy.
3. Run the read-only smoke commands.
4. Observe for at least 30 minutes before re-enabling jobs.

## 4. Schema and index rules

- Keep Phase 8/9 fields, deletion jobs, retention metadata and Web Vital TTL.
- Do not drop new indexes during an incident.
- Do not recreate the old TrainingSchedule TTL index.
- Do not roll F1 media back to public server/uploads storage.
- If private storage is unavailable, disable new F1 media writes and preserve
  retry jobs.
- Restore a database only for confirmed corruption with incident-lead,
  database-owner and project-owner approval.

## 5. Database recovery

Database restore is the last resort and always involves real production data.
Follow backup-restore-runbook.md. Restore into an isolated target first, compare
critical counts/invariants and obtain explicit owner approval before changing
production traffic.

Required evidence:

- source snapshot identifier and recovery point;
- target cluster/database name;
- before/after critical collection counts;
- migration/index verifier output;
- measured restore duration;
- sign-off from incident and database owners.

## 6. Post-rollback smoke

    $env:ALLOW_REMOTE_PRODUCTION_SMOKE = "true"
    npm run smoke:production

    $env:ALLOW_REMOTE_PRODUCTION_MONITOR = "true"
    $env:OPS_METRICS_TOKEN = "<load from the approved secret manager>"
    npm run monitor:production
    Remove-Item Env:OPS_METRICS_TOKEN

Also verify login/logout, CSRF-protected mutation, public Blog/Recipe, one
client journey, one trainer journey and one admin read-only operations view.

## 7. Close criteria

- liveness and readiness are stable;
- no new 5xx or active critical/high integrity alert appears for 30 minutes;
- expected Blog/Recipe routes are present in sitemap;
- background jobs have one explicit owner/replica;
- the final SHA/deploy IDs and incident timeline are recorded;
- a regression test and follow-up owner exist.

Do not auto-close the production monitor issue. Close it only after a successful
manual monitor run and owner review.
