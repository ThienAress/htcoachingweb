# Incident Runbook

## Severity

- **SEV-1:** data exposure/corruption, authentication bypass, or complete outage.
- **SEV-2:** major workflow unavailable, sustained 5xx, or severe latency.
- **SEV-3:** degraded feature with a working fallback.

## First 15 minutes

1. Name an incident lead and communication owner.
2. Record UTC start time, deployment SHA, affected roles/routes, and sample request IDs.
3. Check /api/ops/health, admin /api/ops/metrics, deployment logs, and database health.
4. Stop the rollout. For a release regression, roll back the application version.
5. Preserve logs and metrics; never paste tokens, cookies, raw AI conversations, or PII.

## Diagnosis

- **HTTP/DB:** inspect 5xx, P95 duration, slow query patterns, docs examined, locks, and pool usage.
- **AI:** inspect provider status, abort/error/tool failure counters, latency, and quota.
- **Knowledge Base:** inspect embedding failures, no-hit rate, and vector fallback count.
- **Check-in/coaching:** inspect transaction aborts, idempotency hits, and revision conflicts.
- **Media:** inspect cleanup failure counters before retrying Cloudinary operations.

## Containment

- Disable KB_VECTOR_INDEX if Atlas vector search is unhealthy.
- Reduce or disable a provider-dependent feature through environment/configuration if safe.
- Do not manually edit session counters, wallet balances, contracts, or coaching revisions.
- Do not drop indexes during active mitigation.

## Recovery and close

1. Verify health, error rate, P95 latency, and one critical journey per affected role.
2. Keep enhanced observation for at least 30 minutes.
3. Document root cause, impact window, request IDs, remediation, and follow-up owner.
4. Add a regression test and alert before closing a SEV-1/SEV-2 incident.

## Operational alert playbooks

### HTTP errors

- Use the rolling five-minute request count, 5xx count/rate and P95; lifetime
  counters are forensic context only.
- Correlate request IDs and deploy SHA, stop promotion, then prefer application
  rollback when the threshold stays active.

### Database

- Confirm `/api/ops/health/ready`, DB P95 and connection state without issuing a
  mutation. Stop rollout if readiness is unavailable or rolling DB P95 remains high.
- Do not restore production unless corruption is confirmed and restore approval exists.

### External providers

- Check bounded provider status/error code and rolling failure/P95 signals. Do
  not log provider payloads or tokens.
- Disable the affected optional integration or roll back; never bypass provider
  authentication or switch production to a mock provider.

### Memory

- Correlate heap utilization, RSS, traffic and deploy timestamp. Capture a
  metrics snapshot, then restart/rollback through the platform if pressure is sustained.
- Do not raise memory limits or add paid capacity without owner approval.
