# Phase 9 Data Inventory

Date: 2026-07-20
Scope: F1 health workflow, private media, generated artifacts and operational telemetry

## 1. Classification

| Data set | Main data | Classification | Access | System owner |
| --- | --- | --- | --- | --- |
| `F1Customer` | Identity, contact, occupation, trainer assignment, lifecycle pointers | Restricted PII | Assigned trainer and admin | Coaching operations |
| `F1Intake` | Health history, measurements, goals, habits, consent | Highly restricted health data | Assigned trainer and admin | Head coach |
| `F1Assessment` | Strength, endurance and professional assessment | Highly restricted health data | Assigned trainer and admin | Head coach |
| `F1Media` | Body/posture images and private object metadata | Highly restricted biometric-like media | Assigned trainer and admin through short-lived authorized reads | Head coach |
| `F1AiReport` | AI analysis derived from intake and assessment | Highly restricted health inference | Assigned trainer and admin | Head coach |
| `F1OutcomeForecast` | Forecast derived from health/coaching data | Highly restricted health inference | Assigned trainer and admin | Head coach |
| `F1ResultPrediction` | Predicted outcomes and optional generated image | Highly restricted health inference | Assigned trainer and admin | Head coach |
| `F1DataDeletionJob` | Request actor, reason, status and retry metadata | Restricted operational data | Admin and lifecycle worker | Platform operations |
| `F1MediaDeletionJob` | Private storage key and cleanup retry metadata | Restricted secret-adjacent metadata | Lifecycle worker only | Platform operations |
| `AuditLog` | Actor ID, action, target ID and bounded metadata | Restricted audit data | Admin/security review | Platform operations |
| `WebVitalSample` | Metric, normalized route, device class and rating | Internal telemetry, no direct identifier | Admin/operations | Platform operations |

## 2. Collection and consent

- Health intake submission requires an explicit consent version stored with the intake.
- Body/posture media requires explicit media consent before upload and before AI image generation.
- The API does not expose provider storage keys in normal media DTOs.
- RUM accepts only LCP, INP and CLS. Routes are normalized and dynamic IDs are replaced; query strings, user IDs, email and free text are not stored.
- Logs must contain event names, opaque IDs, error codes and durations only. Raw health payloads, prompts, contact details and signed URLs are prohibited.

Product/legal approval is still required for the final consent wording and the retention period. The implemented default is an operational proposal, not legal advice.

## 3. Retention policy

| Data | Implemented policy | Deletion behavior |
| --- | --- | --- |
| Active F1 customer and related records | Retained while active | No automatic deletion |
| Archived F1 customer | Default expiry is 365 days from `archivedAt`; configurable from 30 to 3650 days | Dry-run by default, explicit enforcement queues deletion |
| F1 private media | Follows customer deletion lifecycle | Object deletion is confirmed before database metadata is removed |
| F1 intake, assessment and generated artifacts | Follows customer deletion lifecycle | Hard-deleted inside the final deletion transaction |
| F1 customer shell | Kept as a pseudonymized tombstone | Direct identifiers, trainer relation, notes and artifact pointers are cleared |
| Audit log | Kept as an audit exception | No raw health/media payload is retained |
| Web vital sample | 30 days | MongoDB TTL removes expired samples |
| Deletion jobs | Retained for operational evidence | Review and archive policy still requires owner approval |

The retention migration only backfills archived, non-deleted customers that do not already have `retentionExpiresAt`. It does not delete data.

## 4. Deletion workflow

1. An authorized actor requests deletion with a reason and auditable role.
2. The customer is archived and every private media record becomes `delete_pending` in the same transaction.
3. Idempotent media jobs delete provider objects with bounded retry.
4. The data deletion job waits until media objects are confirmed deleted or already absent.
5. Intake, assessment, reports, forecasts, predictions and media metadata are deleted in one database transaction.
6. The customer record is pseudonymized and the deletion job/audit event is completed.

If provider deletion repeatedly fails, the customer health records are intentionally not purged yet. This fail-closed order prevents an untracked private object from being left behind.

## 5. Security controls

- F1 media uses memory upload, Sharp decode, pixel/dimension limits, auto-rotation, metadata stripping, re-encoding and SHA-256 checksum.
- Production refuses the local private adapter and requires an authenticated Cloudinary configuration.
- Signed read access is short-lived and runs through the shared F1 customer authorization guard.
- Per-file, per-scope and per-customer quotas bound storage abuse.
- Artifact source fingerprints, engine versions, request IDs and unique indexes prevent duplicate generations.
- Deletion jobs, retention actions and media reads are represented by structured audit/metric events.
- CSP reporting, request sanitization, rate limiting and secret/dependency scanning are CI or runtime gates.

## 6. Open governance decisions

- Approve the final 365-day archived-customer retention or select a different period.
- Name a business owner and security owner for health data.
- Define legal hold requirements, if any.
- Approve deletion-job and audit-log retention.
- Approve who may use body images for AI generation and whether separate consent is required per regeneration.
- Define the user-facing export format and SLA. The current phase implements deletion, not a complete self-service export endpoint.
- Record the processor/subprocessor register for Cloudinary and AI providers.

## 7. Verification queries

Run on a staging snapshot after migrations:

```powershell
npm run verify:phase8
npm run verify:phase9
```

Release gates:

- No F1 media record exposes a public local upload URL.
- No ready media object lacks provider key, checksum, size and dimensions.
- No completed deletion job has remaining F1 domain records or private objects.
- Retention is observed in dry-run until an owner approves enforcement.
- RUM documents expire through the TTL index and contain no direct identifiers.
