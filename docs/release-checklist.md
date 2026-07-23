# Release Checklist

Current staging evidence: [staging-deployment-report-2026-07-23.md](./staging-deployment-report-2026-07-23.md).
Production plan: [production-release-plan-2026-07-23.md](./production-release-plan-2026-07-23.md).
Rollback procedure: [production-rollback-runbook.md](./production-rollback-runbook.md).

## Repository incident closure - updated 2026-07-22

- [ ] **Revoke suspected credential:** account owner removes the suspected Google
      App Password and confirms whether any replacement is required.
- [x] Delete `current_kb_entries.txt` locally and rewrite it out of `main` and
      `staging` history.
- [x] **Untrack 51 upload files** and delete the confirmed test data locally.
- [x] Rewrite `server/uploads` out of `main` and `staging`; purge local media
      blobs and retain only a verified clean recovery mirror.
- [x] Confirm the public repository has zero forks.
- [ ] Ask GitHub Support to purge cached views and all 18 affected read-only PR
      refs. First changed commits are recorded in the Phase 10 runbook.
- [ ] Notify collaborators with old clones to re-clone or carefully rebase; do
      not merge or push pre-rewrite history.

## Before staging

- [x] CI is green: client lint/tests/build, server tests, Chromium E2E.
- [ ] Revoke and replace any credential reported by npm run security:secrets.
- [x] Require npm run security:secrets and npm run security:data-boundaries to
      report zero findings.
- [x] Run npm run check:production-readiness inside the server deployment
      environment and review every warning.
- [x] Confirm no runtime upload, private media, env file, database export or
      private key is tracked by Git.
- [x] Review the Git diff for secrets, generated files, and unrelated changes.
- [x] Confirm required environment variables and allowed origins.
- [ ] Create a database backup and record its snapshot identifier.
- [ ] Confirm rollback owner, deployment owner, and observation window.

## Staging database

- [x] Run Phase 1-3 migrations in order if the environment has not applied them.
- [x] Set CONFIRM_PHASE4_INDEX_MIGRATION=yes, then run npm run migrate:phase4.
- [x] Run npm run verify:phase4-indexes.
- [x] Set ALLOW_PHASE4_EXPLAIN=true, then run npm run explain:phase4.
- [x] Run wallet reconciliation with ALLOW_LEGACY_TRAINER_REFERENCE=true before
      Phase 6 migration; stop if totalIssues is not zero.
- [x] Set CONFIRM_PHASE6_FINANCIAL_MIGRATION=yes, then run
      npm run migrate:phase6.
- [x] Run strict npm run reconcile:wallets after Phase 6 migration and require
      totalIssues = 0.
- [ ] Assign every approved order to a trainer, or set DEFAULT_ADMIN_TRAINER_ID
      to a valid admin ObjectId for legacy unassigned orders.
- [x] Back up training schedules and bookings, then set
      CONFIRM_PHASE7_SCHEDULE_MIGRATION=yes and run npm run migrate:phase7.
- [x] Stop the rollout if Phase 7 preflight reports an invalid occurrence,
      duplicate client/date, or overlapping trainer slot.
- [x] Run npm run verify:phase7 and require totalIssues = 0 after migration.
- [x] Confirm Cloudinary private/authenticated credentials in staging and back up
      F1 collections before Phase 8.
- [x] Set CONFIRM_PHASE8_F1_MIGRATION=yes, then run npm run migrate:phase8.
- [x] Run npm run verify:phase8 and require totalIssues = 0. Resolve every
      legacy-media failure or orphan before production.
- [x] Set an owner-approved F1_RETENTION_DAYS, set
      CONFIRM_PHASE9_PRIVACY_MIGRATION=yes, then run npm run migrate:phase9.
- [x] Run npm run verify:phase9 and require totalIssues = 0. Confirm the Web
      Vital TTL and F1 lifecycle indexes exist.
- [ ] Check DB CPU, write latency, index size, and replication lag during index creation.
- [x] Resolve any query with docs-examined/returned above 20 before production.

Never run a migration from a developer shell pointed at production without a backup,
change approval, and an identified rollback path.

## Staging application

- [x] Verify /api/ops/health returns 200.
- [ ] Configure platform liveness as /api/ops/health/live and readiness as
      /api/ops/health/ready; verify readiness becomes 503 during drain.
- [x] Set TRUST_PROXY_HOPS from the verified proxy topology.
- [x] Set BACKGROUND_JOBS_ENABLED=false on web replicas and true only on the
      designated worker.
- [x] Run the security smoke directly against the deployed staging URLs and
      record the evidence in the staging deployment report.
- [x] Run the automated Staging Health and Security workflow against the deployed
      staging SHA and require every check to pass.
- [x] Verify /api/ops/metrics is 401/403 for non-admin and 200 for admin.
- [x] Run npm run load:smoke in server against staging only after setting
      ALLOW_REMOTE_LOAD_SMOKE=true and an approved LOAD_BASE_URL.
- [x] Run critical auth, check-in, coaching, content, AI/KB, contract, and wallet E2E.
- [x] Run concurrent schedule booking tests and verify exactly one request wins
      a trainer slot while the loser receives HTTP 409.
- [ ] Verify client/trainer create, reschedule, cancel, complete, reminder retry,
      lead transition, and lead archive flows in staging.
- [ ] Confirm AI and embedding providers use test-safe quotas.
- [x] Confirm logs redact email, phone, credentials, tokens, and message content.
- [ ] Verify bank transfer values come from the secret manager and missing
      configuration fails deposit creation before database writes.
- [ ] Verify production AI endpoints cannot use mock providers.
- [x] Confirm /uploads/f1-media returns 404 and every F1 image read requires
      authorization and returns a short-lived private URL.
- [x] Run the F1 lifecycle in browser E2E and against the live staging API:
      create, intake, two private media uploads, assessment, AI report and cleanup.
- [ ] Run an F1 retention dry-run and obtain owner approval for the candidate count.
- [x] Keep F1_RETENTION_ENFORCE=false until deletion/provider cleanup is observed.
- [x] Configure OPS_METRICS_TOKEN (minimum 24 characters) and verify the Prometheus
      endpoint rejects missing/incorrect tokens.
- [x] Add read-only production smoke/metrics scripts and the scheduled GitHub
      production monitor workflow.
- [ ] Wire Prometheus scrape and external alert delivery; send one test alert to
      the named owner.
- [x] Enforce CSP in staging after reviewing violations and testing public,
      auth, admin, schedule and F1 pages.
- [ ] Record a seven-day RUM baseline by route/device before performance claims.
- [x] Run axe critical smoke and the full Chromium/Firefox/WebKit matrix.
- [x] Run the strict dynamic sitemap/prerender build against staging: require all
      four API sources and prerender all 24 discovered routes.
- [x] Verify Netlify production metadata automatically enables strict mode,
      rejects SKIP_DYNAMIC_ROUTES, and rejects the staging API origin.

## Production rollout

- [ ] Deploy server before client when the client depends on new endpoints.
- [ ] Run approved index migration and index verification.
- [ ] Deploy client and purge CDN only after health checks pass.
- [ ] Observe 5xx rate, P95 HTTP/DB/AI latency, AI aborts, embedding failures,
      transaction aborts, revision conflicts, financial conflicts/reconciliation
      mismatches, schedule slot conflicts/reminder failures, booking transition
      conflicts, and cleanup failures for 30 minutes.
- [ ] Observe F1 media upload/delete jobs, retention candidates, CSP reports,
      RUM sample ingestion and per-replica Prometheus scrape for 30 minutes.
- [ ] Confirm dependency audit, secret scan and runtime console scan passed in CI.
- [ ] Verify the actual production sitemap/prerender output includes current
      Blog and Recipe routes after the server-first deployment.

## Rollback

- [ ] Roll back application version first; do not drop newly created indexes during an incident.
- [ ] If only the Phase 7 client fails, roll back the client and keep the Phase 7
      server. Before rolling back the server, disable schedule writes because the
      legacy server does not create slot claims.
- [ ] Do not recreate the TrainingSchedule TTL index during rollback; occurrence
      history and audit references must remain intact.
- [ ] Keep Phase 8/9 fields and indexes during application rollback; do not drop
      counters, deletion jobs, retention fields or Web Vital TTL in an incident.
- [ ] Set F1_RETENTION_ENFORCE=false and CSP_ENFORCE=false before rolling back
      Phase 9 behavior.
- [ ] Never roll back F1 media to a public /uploads path. If private storage is
      unavailable, disable new F1 media writes and preserve retry jobs.
- [ ] Disable KB_VECTOR_INDEX to return to bounded fallback search if vector search fails.
- [ ] Restore database only for confirmed data corruption, using the restore runbook.
- [ ] Record request IDs, timestamps, deployed SHA, and the final decision in the incident log.
