# Plan095 DeepSeek PR202 verification checkpoint

Date: 2026-10-06. Scope: local implementation and PR CI; no DeepSeek live trial.

[Canonical plan](../plans/095-integrate-deepseek-staging-trial.md).

### Staging release authorization — 2026-10-06

- Owner approved commit and deploy while explicitly continuing the prior chat's
  request to merge PR202 into staging. Authority includes scoped push and protected
  merge; no bypass of protection, production rollout or paid provider trial.
- Current pre-commit check confirms PR202 OPEN/CLEAN/MERGEABLE on the same head
  and successful CI37455832149. Product source remains unchanged.
- Commit only this report, Plan095, its runbook, machine state and its index row.
  Preserve the pre-existing Plan094C edits. Fresh trusted CI is required for the
  documentation commit and the eventual staging merge SHA.
- Deploy code with existing Gemini settings; verify exact SHA on both providers
  and GET health before owner key entry and a separately bounded live trial.

### Trusted CI continuation checkpoint — 2026-10-06

- [PR202](https://github.com/ThienAress/htcoachingweb/pull/202) remains OPEN/CLEAN,
  targeting `staging`, head `089cb700dde95716c1d7c546c09eb42e8a7bef8f`.
  Current staging ref is `0a25bba1bcc79bfb2a057c2dc40703eb9d8851aa`.
- [CI37455832149](https://github.com/ThienAress/htcoachingweb/actions/runs/37455832149)
  completed SUCCESS: client, server, secrets, E2E and Docker, all five jobs.
  Checkout logs identify the PR merge ref `0d5cac3`, combining the exact head and
  staging base above; this is PR CI evidence, not evidence for a later merge SHA.
- Server: `310 files / 3,616 tests`; client: `186 files / 939 tests`;
  AI eval: `73/73`; canonical `npm run test:e2e`: `129 passed`, exit0 on Ubuntu.
  Trusted CI resolves the local Windows E2E completion blocker for this source.
- Client lifecycle build passed with `SKIP_DYNAMIC_ROUTES=true`, API
  `https://example.invalid/api`, `9/9` static prerender routes and bundle budget.
  This remains a non-production artifact; full staging deployment must be verified.
- Prior independent security/closure review remains applicable: product source is
  unchanged. GitHub has no submitted review or inline review comment at this check.
  An independent read-only continuation check confirmed config/corpus/rollback
  prerequisites; it did not inspect live secrets, database or provider configuration.
- Existing staging GET-only health passed `7/7` at `2026-10-06T14:48:37.585Z`.
  Command: `ALLOW_REMOTE_STAGING_HEALTH=true node scripts/staging-health.mjs`;
  exit0 after two liveness timeouts and the existing bounded retries. This says
  nothing about DeepSeek activation or deployed SHA. No auth or LLM request was sent.
- Remaining: owner approval for merge/staging deploy, exact deployed SHA and
  provider identity, current nonsecret config/rollback snapshot, eligible corpus
  count/bytes, synthetic fixture, paid-call cap and cleanup scope; owner enters
  `DEEPSEEK_API_KEY` directly on the verified Render staging service.
- Continuation edits are documentation only. Keep the three pre-existing dirty
  Plan094C files/sections outside any Plan095 commit; primary checkout is untouched.

### Local implementation checkpoint — 2026-10-06

- TASK-001/002/003 are implemented locally: provider SSE/tool contract, bounded
  LLM KB selection/facade, strict staging gate and web-search fail-closed path.
- Local unit/compile evidence covers provider, controller SSE, selector, Admin Search,
  prompt labels, metrics and config. Independent security review and incremental
  closure review are complete. A diagnostic staging-targeted release build passes;
  canonical E2E exit and trusted CI/publish gates remain pending. This is not live
  staging or production evidence.
- Earlier local full checkpoint: server `310 files / 3,611 tests`, client `186 files / 939 tests`,
  AI eval `73/73`, lint, compile-only Vite build, tool validation, UI regression,
  secrets/data-boundary/docs-privacy/agent scans all pass. The focused local E2E
  assertions pass `14/14`, but Playwright web-server teardown hangs on Windows and
  exits only after interruption, so it is diagnostic rather than release evidence.
  The earlier server count predates final regression closure and is not the fresh
  full-server verdict. Client source has not changed since its recorded checks.
- Independent security review found and root fixed deterministic-fallback model
  attribution plus additive persisted KB retrieval evidence (`kbRetrieval`); no raw
  prompt/KB content is stored. Earlier release-build probes were blocked by local
  network/config: `EACCES`, cache mismatch and one omitted public `VITE_API_URL`.
  The final Node `22.23.1` probe with all three public API URL variables targeting
  staging passed (`44/44` prerender routes, bundle budget and search-index gate;
  `10 Recipe + 0 Exercise` details). It used non-strict/fallback dynamic-route mode
  after list-source timeouts; this is diagnostic staging-build evidence, not a
  strict production build or trusted CI artifact. Generated tracked sitemaps were
  restored to their pre-probe contents to keep the product diff scoped.
- Final regression closure adds exact persisted entryId/rank/revision allowlist,
  no-hit counts, legacy `kbRetrieval:null`, and public history/detail/fork exclusion.
  Scope/equipment/mixed/tool-result fallback attribution is exercised directly.
  A newly covered required-tool-missing reply also uses `server_tool_missing_v1`
  instead of claiming the discarded provider draft as its source. No response text,
  tool permissions, schema indexes or data lifecycle changed in that correction.
- Fresh root checks after the additive trace: 214 focused server tests passed;
  final missing-tool and successful sanitized tool-result regressions passed;
  AI eval `73/73`, tool validation, secrets/data-boundary/docs-privacy and agent
  validation passed. Terminal-default Node `24` was rejected by the existing runner
  without loosening it. Node `22.23.1` full recheck passed batch1
  (`32 files / 393 tests`) but batch2 failed six index/migration fixtures: MongoDB test temp on C:
  fell below its 500 MiB disk minimum. Retained diagnostic rerun confirmed the same
  six disk-space errors (`197 PASS / 6 FAIL`), not an assistant regression. A final
  full recheck used process-scoped `TEMP`/`TMP` under
  `.local-data/plan095-test-tmp-20261006` on D: (which had >85 GiB free);
  no user backup/file deletion or MongoDB guard relaxation was performed.
- Fresh canonical `npm run test:unit:server` completed all ten batches with exit0:
  `310 files / 3,616 tests PASS` under Node `22.23.1` and temp storage on D:.
  This supersedes the earlier `3,611` count for the final server source/test tree.
- One bounded alternative E2E attempt kept independently owned Vite and mock API
  servers healthy before the canonical focused command. Playwright announced
  `15 tests / 1 worker`, then hung without a completion summary or exit0. Result:
  `BLOCKED`, not PASS. Only test-owned processes were stopped; ports `4174/5100`
  were confirmed released. No code/config/test changes, timeout relaxation or
  further local retry. Resolve the canonical E2E gate in trusted CI before merge.
- Incremental closure reviewer found no reachable new finding. Residual test gap:
  provider-error required-tool-missing attribution has no separate assertion;
  the normal missing-tool and successful tool-result branches are covered.
