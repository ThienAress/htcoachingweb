# Audit backend foundations và advanced concepts — 2026-08-13

## Phạm vi và kết luận

- **Target**: `staging` tại `4a5897a3d773668e6f69e729deb3b4eef59b28aa` cộng working tree P0/P1 AI đang phát triển.
- **Nguồn đối chiếu**: file phân tích local do user cung cấp (đường dẫn máy cá nhân đã redact), 10 backend concepts và các nhóm nâng cao.
- **Đã audit**: Express routes/controllers/services/models, security/operations, AI provider/tool/RAG, tests và runbooks liên quan.
- **Ngoài phạm vi**: benchmark dữ liệu production, Atlas/Render/Netlify live configuration, paid external scan, migration/index apply, deploy, backup/restore và mọi production write/delete.

Nhận xét trong TXT đúng về kiến thức senior: mỗi foundation phải được đánh giá cùng correctness, failure mode và operations. Tuy nhiên Redis, MQ, sharding, CQRS hoặc event sourcing không phải checklist cài đặt. Repo hiện đã có nhiều control senior-grade; phần cần nâng chủ yếu là API governance, multi-instance/async resilience và disaster-recovery evidence.

## Matrix 10 concepts

| Concept | Trạng thái trong project | Evidence chính | Ưu tiên / hành động |
|---|---|---|---|
| REST/API contract | **Đã có nhưng cần nâng**: resource routes, status/pagination/error contracts và private `no-store` đã có; chưa có OpenAPI/API compatibility gate toàn repo. | `server/server.js:191`, `server/src/middlewares/errorHandler.js:20`, `server/src/controllers/blog.controller.js:136` | **P1**: sửa mutation public thiếu CSRF/validation; **P2**: OpenAPI/contract inventory theo critical APIs, không big-bang versioning. |
| Authentication/Authorization | **Mạnh**: httpOnly JWT, CSRF, backend role và nhiều ownership/BOLA checks. ABAC/RLS không áp trực tiếp vì MongoDB; policy vẫn phải enforce ở service/query. | `server/src/middlewares/auth.middleware.js:7`, `server/src/middlewares/csrf.js:7`, `server/src/controllers/f1Customer/resultPrediction.controller.js:303` | **P1/P2**: tiếp tục route-by-route BOLA ledger; không thay RBAC bằng framework mới khi chưa có use case. |
| Database index | **Mạnh nhưng rollout-dependent**: 63 model/schema files production, 59 có index declaration, 215 declarations; `autoIndex` production tắt và migration có guard. | `server/src/config/db.js:6`, `server/src/models/DepositRequest.js:96`, `server/src/models/ServiceUsageBucket.js:64` | **P1 external**: apply/verify indexes đang pending approval; **P2**: explain/slow-query evidence trước khi thêm index mới. |
| Transaction | **Mạnh ở critical domains**: financial, schedule, privacy, journal, meal plan và F1 dùng Mongo transactions. | `server/src/services/trainerSubscriptionPurchase.service.js:85`, `server/src/services/wellnessTarget.service.js:106` | **P2**: chuẩn hóa transient-transaction retry chỉ khi có reproduced failure/driver evidence; không retry mutation mù. |
| Concurrency | **Mạnh**: atomic update, unique/partial indexes, request IDs, optimistic version và DB claims. | `server/src/services/serviceUsageLedger.service.js:198`, `server/src/services/wellnessTarget.service.js:129`, `server/src/models/DepositRequest.js:105` | **P1**: regression concurrency cho cache/schedulers; **P2**: load/chaos evidence trước distributed lock. |
| Cache | **Có chọn lọc**: TanStack Query phía client, stale-cache analytics và bounded in-memory embedding cache; không có evidence cần Redis cho business reads hiện tại. | `server/src/services/ai/embedding.service.js:15`, `server/src/services/seoAnalyticsRead.service.js:62` | **P1**: single-flight embedding để chống stampede local; **P2**: Redis chỉ khi metrics chứng minh multi-instance cache/latency need. |
| Message queue/async | **Hybrid**: DB-backed claims/retry cho reminder/F1 deletion, nhưng một số cron đơn giản và email/build hook vẫn best-effort/in-memory. | `server/src/services/scheduleReminderCron.js:91`, `server/src/services/f1PrivacyLifecycle.service.js:159`, `server/src/services/depositCron.js:43` | **P1**: overlap/worker-role guard và ops evidence; **P2**: transactional outbox + idempotent consumer cho notification/email quan trọng, chỉ sau spec. |
| Idempotency | **Mạnh ở critical writes**: request ID + same-transaction replay/ledger; not every CRUD needs a generic key. | `server/src/services/trainerSubscriptionPurchase.service.js:21`, `server/src/services/wellnessTarget.service.js:72` | **P2**: inventory side-effecting external deliveries và introduce outbox/idempotent delivery where loss/duplicate impact justifies it. |
| Rate limiting | **Layered**: global/endpoint in-memory abuse ceilings plus Mongo shared service quota for AI/Meal Scan. | `server/src/middlewares/rateLimit.js:3`, `server/src/middlewares/aiRateLimit.js:12`, `server/src/services/serviceUsageLedger.service.js:156` | **P1**: preserve shared quota and expose consistent retry metadata; **P2**: distributed limiter for non-AI endpoints only before horizontal scale/SLO requires it. |
| Load balancing/statelessness | **Ready at app layer, external config pending**: liveness/readiness, DB-aware 503, draining and graceful shutdown exist; auth state is cookie/DB-based. Metrics and timers remain process-local. | `server/src/routes/ops.routes.js:61`, `server/server.js:356`, `server/src/observability/metrics.js:110` | **P1 external**: configure platform probes and designated worker; **P2**: aggregate metrics and distributed limiter before adding replicas. |

## Advanced concepts

| Nhóm | Đánh giá | Priority / next action |
|---|---|---|
| MVCC/isolation/locking | Mongo transactions + optimistic/atomic controls cover current critical paths. Isolation tuning should be evidence-led. | **P2** transaction retry policy + failure injection tests. |
| Transactional outbox/idempotent consumer | DB-claim patterns exist for reminders/deletion, but no generic outbox for mail/build/external events. | **P2**, needs spec/schema/index migration and rollout approval. |
| Authorization RBAC → ABAC/ReBAC/RLS | RBAC + ownership/assignment acts as application ABAC/ReBAC. Mongo has no PostgreSQL RLS equivalent. | **P1/P2** maintain access-policy helpers and BOLA tests, not technology mimicry. |
| Timeout/retry/backoff/jitter/circuit/bulkhead | Server/tool/provider deadlines exist; Meal Scan has bounded transient retry, other providers vary. | **P1** add safe read-only single-flight/deadline guards; **P2** shared outbound resilience adapter after provider inventory. |
| Backup/PITR/replication/failover | Release backup gate passes, but off-device recovery and PITR remain unverified/unavailable. | **P0 external / NO-GO for DR claim** until owner approves and verifies real infrastructure. |
| Observability/logs/metrics/traces/SLO | Structured safe logs, request/trace IDs, bounded metrics, Prometheus and production monitor exist. Metrics are process-local and trace propagation is correlation, not distributed tracing. | **P1 external** complete probe/RUM evidence; **P2** durable metrics/OpenTelemetry only when multi-service/replica topology warrants it. |
| DevSecOps | CI, secret/data-boundary/dependency/agent validators and security smoke exist. | **P1** keep gates; DAST/paid scan remains explicitly scoped/cost-approved. |
| AI security plane | Prompt/context separation, tool schema/auth/confirmation/deadlines, quotas/evals/log redaction are implemented in Plan 052. | **P1** preserve and extend evals; production mutating tools remain disabled until separately approved. |

## Findings đã vet

| ID | Priority | Finding và impact | Evidence | Production-data impact | Status |
|---|---|---|---|---|---|
| BF-01 | P0 | Public exercise-suggestion mutation lacked CSRF and a bounded server contract; admin list accepted unbounded pagination/dynamic regex. | Fix at `server/src/routes/exerciseSuggestion.routes.js:22`, `server/src/middlewares/validation.js:2162`, `server/src/controllers/exerciseSuggestion.controller.js:43` | None; additive guard/test, no schema/data rewrite | **FIXED LOCAL**, route regression 6/6 + client contract 1/1. |
| BF-02 | P1 | Concurrent identical embedding misses could fan out to duplicate Gemini calls because cache contained only completed vectors. | Fix at `server/src/services/ai/embedding.service.js:18`, `:167`; test `server/src/services/ai/__tests__/embedding.service.test.js` | None; process-local cache behavior | **FIXED LOCAL**, 4 focused cases pass. |
| BF-03 | P1 | Several interval starters did not retain timer handles or guard same-process overlap; cleanup performs real deletes when the designated job role starts. | Fix seam `server/src/operations/recurringJob.js:3`; shutdown integration `server/server.js:380` | Code guard is safe; enabling/running cleanup on production is data-affecting and remains approval-only | **FIXED LOCAL**, lifecycle 6/6 + schedule 2/2; no jobs executed. |
| BF-04 | P1 external | Platform probe configuration is still unchecked in release checklist even though app endpoints are ready. | `docs/operations/release-checklist.md:99` | Config/deploy change | Await owner-approved Render change/verification. |
| BF-05 | P0 external | Disaster recovery cannot be claimed: off-device recovery is unverified and PITR/continuous recovery unavailable. | `docs/plans/052-harden-ai-evals-tools-and-scale-readiness.md:164` | Real backup/PITR/restore operations | Await explicit target/credential/owner approval. |
| BF-06 | P2 | No OpenAPI or compatibility gate for 300+ route-method declarations; contracts are enforced by dispersed tests/specs. | Static inventory: 324 route-method declarations; no OpenAPI source found | None for documentation-first phase; later adoption may affect contracts | Backlog, start with critical APIs only. |
| BF-07 | P2 | Metrics/alerts are per process, so horizontal replicas would fragment counters and reset state on restart. | `server/src/observability/metrics.js:110` | Infrastructure/config | Backlog until multi-replica topology/SLO approved. |
| BF-08 | P2 | External side effects do not share a transactional outbox; best-effort email/build hook can be lost on crash. | `server/src/controllers/contact.controller.js:29`, `server/src/utils/triggerBuild.js:42` | Requires additive schema/index/migration and delivery rollout | Spec first; await approval before migration/apply/deploy. |

## Đã xem xét và loại

- Không report inline imports trong `server/server.js`, mixed quotes, large files, CSP `unsafe-inline`, Cloudinary CORP hoặc YouTube frame domain: project records them as by-design/known issues.
- Không đề xuất Redis/RabbitMQ/Kafka, sharding, CQRS hoặc event sourcing without measured need; adding infrastructure would increase failure modes and operations cost.
- PostgreSQL-specific RLS/MVCC/index types from the TXT are learning examples, not direct prescriptions for the current MongoDB stack.

## Security coverage ledger

| Surface | Entry → validation → authorization → sink | Result |
|---|---|---|
| Public exercise suggestion | POST body → exact field/type/length validation + CSRF → optional identity → `ExerciseSuggestion.create` | Finding BF-01 fixed; regression covers reject-before-write and valid normalization. |
| Admin suggestion list | query → bounded enum/int/string validation + regex escaping → admin role → Mongo count/find | Finding BF-01 fixed; oversized limit rejected before query. |
| AI embedding cache | chat/KB query → normalized/bounded text → existing route/tool access → single-flight + Gemini + bounded vector search | BF-02 fixed; caller abort is isolated from shared provider work and no new authorization/data exposure path. |
| Background jobs | explicit environment role → non-overlap recurring runner → job-specific DB filters/claims → update/delete/email/provider | BF-03 fixed locally; running destructive cleanup remains explicitly out of scope. |

## Verification local

- Focused: suggestion API 6/6, suggestion client service 1/1, embedding/metrics/scheduler 16/16.
- Full unit/integration: client 85 files / 420 tests; server 151 files / 748 tests.
- Chromium E2E: 79/79.
- AI: eval 9/9; tool validator 11 tools / 0 warnings.
- Client lint, release build, fallback prerender 38/38 và bundle budget: PASS. Dynamic sources timed out, nên đây không phải strict production prerender evidence.
- Ops 26/26; dependency audits, secret scan, data-boundary, runtime logging, agent validator và `git diff --check`: PASS.
- Residual QA note: full server Vitest exits 0 but still reports Mongoose `validateSync` deprecation warnings and force-cleans one lingering process after the suite. No test imports/starts the cron starters changed here; focused scheduler tests stop all timers.
- Không chạy migration/index apply, deploy, cleanup, backup/restore hoặc production write/delete.

Deferred proof gaps: live Render probe configuration, multi-replica behavior, production query plans/index presence, provider SLA/fault injection, off-device restore and PITR evidence.
