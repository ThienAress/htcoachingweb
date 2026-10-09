# Spec: Repair draft Knowledge Entry publication

## Objective and authority

The owner requested checking and repairing all 28 production drafts, releasing the correction,
and publishing the validated cohort. This scoped repair supplements
[Knowledge quality](./fitness-first-ai-and-knowledge-quality.md) and preserves its privacy,
source, review and publication-fence contracts. It introduces no new product feature.

## Stack and boundaries

Express/Mongoose publication validation calls the existing knowledge privacy service.
Changes are limited to contextual grammar/concept/public-role disambiguation, synthetic regressions,
and privately prepared editorial patches. Auth, CSRF, quota, schema, provider/model and deadlines
remain governed by their existing contracts. Production payloads and credentials stay outside Git.
The owner authorized a scoped KB selection timeout change from 15 to 30 seconds on
2026-10-09; see AC-005 in [Vibi production profile](./vibi-production-profile.md).

## REQ-001 — Accept general educational knowledge while rejecting personal records

- AC-001: Public validator regressions distinguish general fitness concepts, Vietnamese grammatical
  phrases, bibliographic article phrases and question-bound public athlete aliases from private names,
  health assertions, identifiers and secrets. All prepared original entries pass privacy and publication
  validation without introducing an exemption for production IDs or bibliographic numeric identifiers.

## REQ-002 — Publish through the established release and revision contracts

- AC-002: Release uses protected PR/CI flow, paired exact-SHA staging deploys, acceptance and two
  reliability rounds with verified cleanup residue zero, fresh recovery evidence, paired production
  deploys and at least 30 minutes read-only observation. Editorial writes use authenticated CSRF API
  requests, current content hashes/revisions and publication receipts; concurrent changes fail closed.
- AC-003: Preserve six off-topic variants as separate drafts for straps, gloves, wrist wraps, F1
  exercise clearance, asthma and diabetes. Their future publication requires suitable sources and
  review; F1 clearance requires canonical internal policy. Same-topic variants and source URLs remain
  attached to the original cohort. Unsupported content is never represented as publish-ready.
- AC-004: KB search controller, selector and provider share a 30-second selection cap.
  A complete response after 20 seconds succeeds; a stalled request cancels at 30 seconds,
  a shorter caller deadline wins, and caller abort cancels without retry. Existing
  privacy, candidate eligibility, context/token bounds and error envelopes remain enforced.

## Files, style and verification

- `server/src/services/ai/knowledgePrivacy.js` and `personalHealthData.js`: existing validation seams.
- `knowledgeConceptContext.js` and `knowledgeGeneralSyntax.js`: narrow contextual helpers.
- `server/src/services/ai/__tests__/knowledgePrivacy*.test.js`: synthetic positive/negative regressions.
- [Plan 096C](../plans/096c-repair-draft-knowledge-publication.md): task and rollout ownership.

Use existing service layering and bounded text processing. Run focused privacy/publication suites,
tool validation, secret/data-boundary scans and agent/traceability validation before protected CI.
Release build/full test evidence comes from exact-SHA CI; local candidate checks never replace live
staging certification. Keep original failures and source/reviewer provenance.

## Open conditions

The upstream cause of historical Vibi latency remains unconfirmed. Failed acceptance is retained
as FAIL. Missing policy for F1 prevents publication of that separate draft until reviewed.
