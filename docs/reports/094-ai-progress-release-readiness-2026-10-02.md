# AI + Progress staging release continuation — 2026-10-02

## Target and boundary

Continue the approved AI release plus Progress month-start hotfix. Backend baseline
is fba17e6e1cf877edfb5e0bfba3cd0a08de0f5d9a; frontend/source snapshot is
ae1252881219e4842bb144e753e9498501dc594a. GitHub staging still points to ae125288,
verified read-only during this continuation. Candidate is an isolated directory,
not a Git branch. No deployment, KB mutation, commit or push has occurred here.

The candidate keeps eight contract frontend paths at the backend-compatible
baseline. Unrelated contract, wallet, schema, migration and connection changes
from the dirty root checkout remain outside this release.

## Integrated changes

- Grafted the exact 14-file Progress closure after verifying each source against
  the saved Plan 091 QA fingerprint including Git index metadata. Raw dates remain
  record identity; periodStartDateKey supplies reporting coordinates with fallback.
- Kept refresh-only AI requests behind protect, before guest quota/provider work.
- Fixed citable historical KB hits suppressing mandatory current-source lookup.
  Only stable questions can promote a web route to reviewed KB evidence.
- Fixed requiredFoods being dropped by canonical meal arguments. The bounded
  parser covers the requested meal corpus and carries/replaces requirements on
  follow-up. The underlying tool retains unavailable/conflict safeguards.
- Made provider-failure E2E loading assertions deterministic by holding the initial
  request until assertions complete. No application timing or loading behavior changed.

## Verification ledger

Private logs and receipts are in the sibling qa directory; no customer chat,
credential or live database record is copied into this report.

| Check | Result |
|---|---|
| Progress source provenance | PASS, 14 files match earlier QA source |
| Candidate scope/lock closure | PASS, 926 baseline backend files and eight deferred contract paths |
| Full server after final patches | PASS, 3,180 tests / 290 files, all ten batches, exit 0 |
| Progress client after exact graft | PASS, 33 tests / 3 files |
| Full client after exact Progress graft | PASS, 915 tests / 186 files, exit 0; earlier 914+1 failed attempt retained |
| KB freshness regression | RED reproduced internal_kb downgrade; full file GREEN 106/106 |
| Meal request and HTTP regressions | PASS, 33/33 root-run tests; direct/provider paths, exact corpus 4/5 constraints |
| Release build | PASS, 44/44 staging-backed prerender routes, bundle budget; 10 Recipe / 0 Exercise details |
| Lint | PASS, zero errors; pre-existing TrainerTransferPanel warning |
| UI regression | PASS, no new blocking findings |
| Tool registry | PASS, 11 tools |
| AI eval after final AI patches | PASS, 73/73; 11 oracle fixtures and zero live runtime captures |
| Changed documentation privacy | PASS |
| Dependency high/critical audits | PASS reused for unchanged lockfiles; exact four-package closure verified |
| Full E2E + affected rerun | Initial 123/124 passed; one 350 ms mock race. Fixed Retry/Edit subset 2/2, zero retries, exit 0. Remaining 122 unaffected cases reuse the initial successful results |
| Agents/inventory | BLOCKED: no candidate Git index; do not regenerate a zero-file inventory |
| Index-based secret/data-boundary scans | PENDING until candidate is a real isolated Git checkout |
| Backup release freshness | BLOCKED: backup older than 24 hours; no timestamp/policy override |

During final server QA, an independent content-hash comparison against the frozen
pre-run inventory found no changes in server/client/e2e. Only plan/report files
changed to record progress. One initial meal HTTP assertion searched raw SSE for a
complete sentence; it was corrected to concatenate text events, with the complete
33-test gate then passing. The failed attempt remains in meal-http-initial.log.

Local receipts are self-attested diagnostic evidence. They do not replace trusted
CI, exact deployment identity or live staging acceptance.

All application QA commands now completed. Full server runner counts total tests
but discards successful batch reports, so no zero-skip claim is made. MongoDB
memory-server used the existing local 8.2.1 binary while requesting 8.2.6; warnings
are retained. Its first three batch teardowns required its own SIGKILL fallback,
after successful reports; all ten commands and the aggregate runner exited zero.

## Review and remaining sequence

Independent reviewer traced auth/guest/CSRF/ownership and Progress date identity.
Two confirmed MED findings were addressed: KB freshness and meal canonicalization.
Both findings were re-reviewed and closed with focused evidence. The exact corpus
5 helper removes tofu; preserving every other food/quantity is still unverified
end-to-end (scopedAdjustment remains false for that wording). Do not label the live
15-case run complete until this separate acceptance condition is exercised.
Workers used requested roles Astra/xhigh for review and Sol/high for the meal fix;
root owns integration and release decisions. Execution routing is not inferred
from spawn requests.

1. Complete affected QA and final content hashes. Preserve failed attempts.
2. Create a reviewable branch descended from the current staging SHA, replace only
   the reviewed tree, commit and push after explicit Git-write authorization under
   AGENTS.md. No force push. Run index gates and trusted CI on that exact candidate.
3. Deploy both staging services to the same passing SHA and verify provider IDs.
4. Refresh backup/recovery evidence and independent encrypted-snapshot key custody;
   preflight exact staging digest, re-embed, authenticated Admin review/publication,
   then retrieval verification. Existing 28 drafts have not been published here.
5. Run the preserved corpus: 14 original prompts plus labeled replacement 5, with
   baselines for 5 and 7; record semantic outcomes and exact synthetic cleanup.

Corpus provenance was frozen separately as corpus-provenance.json with SHA256
6df9bf0c1f5b4c823c1a39216c4eade59ac49cf834419fd53e33f28471afcbfc.
Its liveRunStatus remains NOT_RUN. No substitute automated 11-prompt run is counted
as satisfying these 15 requested prompts.

The current operational result remains NO-GO pending the listed gates. Git-write
authorization is not inferred from the local result: AGENTS.md explicitly limits
Git to read-only unless the user requests those operations. The proposed branch
is codex/ai-progress-staging, parent ae125288, ordinary commit and push only;
promotion-review.json lists 141 differences from that parent including intentional
deferred files. No force push or mutation of the current dirty checkout is proposed.
