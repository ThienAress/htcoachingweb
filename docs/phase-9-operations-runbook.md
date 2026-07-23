# Phase 9 Operations Runbook

Date: 2026-07-20
Status: code-complete baseline; staging drills and external alert delivery remain release gates

## 1. Required production configuration

| Variable | Requirement |
| --- | --- |
| `OPS_METRICS_TOKEN` | Random secret of at least 24 characters, stored in the secret manager |
| `F1_MEDIA_STORAGE_PROVIDER` | `cloudinary` in production |
| `CLOUDINARY_CLOUD_NAME` | Required for private F1 media |
| `CLOUDINARY_API_KEY` | Required for private F1 media |
| `CLOUDINARY_API_SECRET` | Required for private F1 media |
| `F1_RETENTION_DAYS` | 30 to 3650; defaults to 365 |
| `F1_RETENTION_ENFORCE` | Keep `false` through the observation and approval period |
| `F1_RETENTION_ACTOR_ID` | Explicit valid admin ObjectId before retention enforcement |
| `CSP_ENFORCE` | Keep `false` until report-only violations are resolved |

Optional F1 bounds have conservative defaults: `F1_MEDIA_MAX_INPUT_BYTES`, `F1_MEDIA_MAX_INPUT_DIMENSION`, `F1_MEDIA_MAX_INPUT_PIXELS`, `F1_MEDIA_MAX_PER_CUSTOMER`, `F1_MEDIA_MAX_PER_SCOPE_TYPE` and `F1_MEDIA_MAX_STORAGE_BYTES`. Changes require a capacity/privacy review.

## 2. Health, metrics and alert indicators

- `GET /api/ops/health`: public liveness/readiness response without secrets.
- `GET /api/ops/metrics`: admin-only JSON snapshot.
- `GET /api/ops/metrics/prometheus`: admin session or `X-Ops-Token`.
- `GET /api/ops/alerts`: admin session or `X-Ops-Token` current alert indicators.
- `GET /api/ops/privacy/f1`: admin-only aggregate F1 lifecycle counts.

Prometheus scrape example:

```yaml
metrics_path: /api/ops/metrics/prometheus
scheme: https
authorization: {}
http_headers:
  X-Ops-Token: <secret-manager-reference>
```

Metrics are in-process counters and bounded summaries. Scrape every server replica and aggregate externally; a process restart resets its local values.

Implemented indicators cover financial reconciliation mismatch, F1 media cleanup
failure, reminder failure and HTTP 5xx. The production-monitor GitHub workflow
polls these indicators every 15 minutes and opens one deduplicated issue on
failure. Wire per-replica Prometheus/Alertmanager or the selected observability
platform as the durable metrics store, test a real notification, assign an owner
and attach the incident runbook before production approval.

## 3. F1 retention

Start with an admin-authenticated dry-run:

```http
POST /api/ops/privacy/f1/retention
Content-Type: application/json
X-CSRF-Token: <token>

{"enforce": false}
```

Expected response reports candidate and queued counts only. Review candidate IDs through controlled database access and confirm the policy owner.

Enforcement sequence:

1. Create and record a backup snapshot.
2. Run dry-run and obtain written approval for the candidate count.
3. Set a valid `F1_RETENTION_ACTOR_ID`.
4. Send `{"enforce": true}` or enable the scheduled worker with `F1_RETENTION_ENFORCE=true`.
5. Monitor deletion jobs, F1 cleanup failures and private-provider errors.
6. Verify no completed deletion has remaining F1 domain records or provider objects.

To stop an incident, set `F1_RETENTION_ENFORCE=false`. Do not delete jobs manually. Existing jobs remain idempotent and can resume after the provider/database issue is fixed.

## 4. F1 media cleanup

Alert symptoms:

- `f1.media_cleanup_failed > 0`
- Jobs remain `failed` or `delete_pending`
- Provider object exists after the expected retry window

Response:

1. Capture request ID, customer ID, media ID, provider and error code. Never copy the signed URL or image into the incident log.
2. Check provider availability and credentials.
3. Confirm the database record still owns the provider key.
4. Restore provider access and let bounded retry resume.
5. Run the Phase 8 verifier and orphan scan on staging/approved production tooling.
6. Escalate before any manual object deletion.

Provider not-found is an idempotent success. A timeout is not proof of deletion and must remain retryable.

## 5. CSP rollout

Default mode is report-only. Reports are accepted at `/api/ops/csp-report`, rate-limited, size-bounded and logged without blocked URLs.

1. Observe reports for at least one normal traffic window.
2. Group by effective directive and reproduce each unexplained violation.
3. Update the allowlist/nonce strategy with the narrowest source.
4. Verify public, auth, admin, schedule and F1 E2E.
5. Set `CSP_ENFORCE=true` in staging.
6. Observe again, then promote to production.

Rollback is setting `CSP_ENFORCE=false` and redeploying configuration. Do not broadly add `*`, `data:` or `unsafe-eval` to silence reports.

## 6. RUM

The client submits LCP, INP and CLS to `POST /api/ops/web-vitals`. The server stores only metric name/value, normalized route, desktop/mobile class, rating and a 30-day expiry.

Baseline procedure:

1. Collect at least seven days or a representative traffic window.
2. Segment by route and device.
3. Record P75 in the release artifact; in-process P50/P95 is only an operational approximation.
4. Prioritize routes with sufficient sample count.
5. Compare the same route/device cohort after optimization.

No production RUM baseline exists yet; local tests only verify ingestion, bounds and TTL behavior.

## 7. Backup, restore and provider drills

These drills were not executed in this coding session:

- Restore a fresh database from a recorded snapshot and measure actual RPO/RTO.
- Stop a worker during media deletion and prove the job resumes.
- Inject Cloudinary timeout/not-found responses.
- Inject AI and mail provider timeouts.
- Rehearse rollback with Phase 8/9 indexes retained.
- Run the full browser matrix and staging load smoke on Ubuntu.

Proposed objectives until measured and owner-approved: RPO <= 24 hours and RTO <= 4 hours. Do not publish these as commitments before a real restore drill.

## 8. Secret rotation

1. Create a second provider credential/token.
2. Deploy it through the secret manager without logging the value.
3. Smoke-test private upload, signed read, delete and metrics scrape.
4. Revoke the old credential.
5. Review authentication/provider errors and audit events.

Rotate `OPS_METRICS_TOKEN`, Cloudinary credentials, database credentials, JWT/session secrets, OAuth secrets and AI keys under separate change records where possible.

## 9. Migration and rollback

From `server`, on an approved staging snapshot:

```powershell
$env:CONFIRM_PHASE8_F1_MIGRATION = "yes"
npm run migrate:phase8
npm run verify:phase8

$env:CONFIRM_PHASE9_PRIVACY_MIGRATION = "yes"
npm run migrate:phase9
npm run verify:phase9
```

Phase 9 backfills retention metadata and operational indexes; it does not purge customer data. On application rollback, keep new fields and indexes. Disable retention enforcement and CSP enforcement first. Restore the database only for confirmed corruption according to the backup/restore runbook.

## 10. Ownership before release

| Responsibility | Named owner required |
| --- | --- |
| Health data policy and retention approval | Product/legal owner |
| F1 deletion and media cleanup | Coaching operations |
| Metrics scrape and dashboards | Platform operations |
| Alert delivery and incident response | On-call owner |
| CSP review | Security owner |
| Backup/restore evidence | Database owner |

No row may remain unassigned at production sign-off.
