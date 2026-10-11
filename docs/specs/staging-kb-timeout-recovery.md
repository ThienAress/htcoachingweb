# Staging KB timeout recovery

Owner approved evidence-bound recovery with review/tests on 2026-10-08.
Scope is the read-only KB search receipt from failed acceptance37758558812.
Original acceptance remains FAILED and cannot be used for release certification.

Completion inventory includes every `http.request` and `ai.deepseek_request_completed`
event within the original run window via separate Render text-event queries, without
request-ID filtering. Both inventories must be unpaginated. Unrelated console lines
are not request-completion evidence; every returned completion line is validated.

## REQ-001 — Close completed read-only failures

- AC-001: after an authenticated KB handler has returned a completed503,
  settle its receipt as failed. Open, disconnected, throwing or mutation handlers
  remain fail-closed; do not change timeouts, provider fallback, auth or quotas.

## REQ-002 — Archive and recover only the registered incident
- AC-002: historical recovery only accepts the registered incident tuple,
  exact failed artifact and operator-attested Render HTTP/provider completion logs.
  Matching503 and DEEPSEEK_TIMEOUT must share the provider request ID and cover
  the receipt admission with no overlapping KB request. This is an operator
  attestation, not cryptographic linkage between the two different request IDs.
- AC-003: require exact staging database/origins/service/deploy/SHA, expired receipt,
  revoked tombstone, exact synthetic admin and unchanged CAS receipt binding.
  Persist the closed proof/receipt archive as a GitHub artifact before deletion.
  Delete that admitted receipt only; never rewrite it to settled or make the old run PASS.
- AC-004: use existing canonical recovery for all remaining fixtures and require
  two quiescent inventories, verified residue0 and a provenance-bearing report.
  All other admitted receipts, uncertain logs, proof drift and foreign data fail closed.

## Registered incident

- SHA: 88b5d3078ca6abadcead29e079bd6a677f1aae09.
- Run: 9c7c1ab5-f0a1-43fa-b1ea-d3aa73326dbc.
- JTI: 2e4b64d0-bc8a-4bc8-8f31-91d5c7eb54ca.
- Capability request ID: 09cd2948-8c7f-421c-841b-758b93990eb6.
- Render HTTP/provider request ID: 9d43dd56-557f-4eb1-98c0-426f77730cd0.
- Actor: 6ac7661faf520cc224129e8f; action kb_search; purpose kb_search_root.
- Render service: srv-d9g8em61a83c73b4l61g; deploy dep-db3ma0favr4c73acli70.

Logs prove a completed read-only HTTP request after provider cancellation. They do
not certify global topology. Render instances returned an empty array while the
service was live, so inventory alone is rejected as drain proof. No suspension,
bulk deletion, production write or paid request belongs to this recovery.

## Boundaries

Default recovery remains unchanged without explicitly supplied validated proof.
Chat mutation/unknown fixture recovery and production are never eligible.
Missing archive provenance blocks deletion. New incidents need their own review.
