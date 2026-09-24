# ADR 0001: Bind staging AI acceptance to a runtime cohort

- **Status**: ACCEPTED
- **Date**: 2026-09-15
- **Amended**: 2026-09-18 — define pre-cohort and catalog-readiness evidence boundaries
- **Owners**: release engineering / AI operations
- **Supersedes**: none

## Context

AC-009 measures process-local Knowledge Base fallback counters while exercising
live staging chat. Render's current-instance endpoint repeatedly returned JSON
`null`, including immediately after a successful health wake, so it cannot provide
an authoritative topology census. Metrics snapshots before and after a run expose
one boot UUID, but alone do not prove that every counter-producing request between
them reached that runtime.

The release gate must fail closed without inventing an instance count, must keep
normal Chat/API contracts byte-compatible, and must not expose runtime identifiers,
tokens, prompts or conversation content to users or artifacts.

## Decision

AC-009 will use a request-cohort proof. Every fallback-counter-producing request
inside the certified metrics window—seven chat attempts and two admin Knowledge
Base searches—uses a short-lived, one-time, staging-only capability bound to exact
SHA, boot UUID, run, actor, action, request and canonical payload digest. The
backend writes an internal admission receipt and a terminal settlement receipt
from the actual runtime. Both metrics snapshots and every receipt must identify
the same boot UUID and exact SHA, and the request inventory must correspond
one-to-one with receipts.

The trusted runner preregisters each exact JTI as `issued`; the backend admits only
through a no-upsert compare-and-set `issued → admitted`, then settles only after
business persistence/finalization is acknowledged. Safe raw/candidate evidence
replaces the boot UUID with a run-scoped fingerprint and retains structured
before/after snapshots (timestamp, SHA, fingerprint and allowlisted counters) so
the validator can recompute every claimed delta. The validator also enforces that
each injected provider-failure receipt settled before its matching Retry or Edit
recovery request was admitted; an artifact cannot claim recovery by merely listing
both attempts in the same metric window.

Receipts live in the existing staging acceptance control collection and are read
only by the trusted runner through its staging Mongo connection. Runtime identity
is not added to public DTOs, SSE frames or response headers. Ordinary requests do
not create receipts or change provider, authorization, CSRF, quota or response
behavior.

Before that certified window, the runner may execute a `pre-cohort readiness`
phase to absorb Atlas Search eventual consistency after creating the synthetic
fixture. This phase is a non-certifying barrier, not part of the exact-nine request
inventory: each bounded attempt performs one root and one variant search without
acceptance capability or receipt. A successful attempt requires both responses to
contain the exact fixture and a zero fallback delta between its snapshots on the
same boot UUID and exact SHA. Its final `after` snapshot is reused unchanged as
the cohort `metrics-before` baseline; the exact-nine cohort begins only after that
baseline. The barrier has a hard deadline, and timeout, restart, runtime/SHA drift
or an inconclusive snapshot fails closed instead of advancing the baseline.

Because pre-cohort vector readiness makes no release claim by itself, it adds no field, JTI or
receipt. Raw evidence schema v3 adds a separate allowlisted
`catalogReadiness` snapshot for Exercise/Food/allergen/fresh-price coverage; the
validator requires it to pass and then keeps release-candidate schema v3 unchanged.
Absolute fallback counters in `metrics-before` may include earlier readiness
attempts; validators continue to certify only the recomputed delta inside the
exact-nine window.

The runner also creates a separate durable `fixture_create` journal before the
admin Knowledge Base POST. It is not a tenth counter-producing cohort receipt.
It binds the run, SHA, synthetic admin and normalized-question digest and moves
from `pending` to `settled` only after a fully validated HTTP 201. Recovery never
manufactures this terminal state; missing, pending or malformed proof retains the
revocation tombstone and fixtures for manual investigation.

This proof attributes AC-009's measured counter window only. It is not a statement
that the whole Render service has one instance. Provider inventory verification
continues to reject missing, `null` or malformed census data wherever a global
topology claim is required.

## Alternatives Considered

- **Keep the Render topology census gate**: strongest global claim, but currently
  cannot run because the read-only provider API returns `null`; CPU history and plan
  limits are not current census evidence.
- **Return runtime identity in an HTTP header**: provides admission attribution but
  not proof that abort/error rollback and quota finalization settled; it also opens
  unnecessary infrastructure metadata at a public boundary.
- **Use shared/aggregated metrics**: could support multi-runtime attribution but adds
  infrastructure, consistency and operational cost unsupported by this bounded
  staging workload.

## Consequences

- Positive: restart, load balancing, missing/duplicate request or unacknowledged
  finalization makes the run fail instead of producing a false certificate.
- Positive: no production mutation and no public API/SSE contract expansion.
- Negative: each acceptance request performs small control writes and exact cleanup;
  CI validators and release artifacts require new schema versions.
- Negative: pre-cohort readiness can conservatively delay or fail acceptance, but
  it cannot replace or satisfy any of the nine certified requests.
- Negative: after a hard kill, recovery must keep the revocation tombstone and
  synthetic fixtures whenever an `admitted` receipt cannot reach a terminal state;
  it may not manufacture settlement or a zero-residue certificate.
- Negative: unrelated traffic on the same runtime can increment a counter and cause
  a conservative false negative; it cannot create a false zero because counters are
  monotonic.
- Follow-up trigger: reconsider shared metrics only if staging runs concurrently at
  material frequency or AC-009 must make a global multi-instance service claim.

## Evidence

- `docs/specs/knowledge-base-embedding-staging-rollout.md` — AC-009 behavior.
- `docs/plans/090a-roll-out-guarded-knowledge-embeddings-on-staging.md` — live
  `null` inventory probes, request coverage and rollout steps.
- `docs/operations/runbooks/release-promotion.md` — candidate and cleanup contract.
