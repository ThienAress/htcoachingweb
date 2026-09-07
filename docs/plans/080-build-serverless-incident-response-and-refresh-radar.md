# Plan 080: Build serverless incident response và refresh Radar

> **Drift check**: trước mỗi step, kiểm tra `git diff` của file in-scope. Repo đang có thay đổi từ task khác; chỉ patch đúng hunk của Plan 080 và không chạm `.codex-worktrees/`.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 035, 048, 056, 078
- **Category**: security
- **Planned at**: 2026-09-04
- **Lifecycle**: DONE
- **Verification**: LOCAL FULL
- **Rollout**: NOT STARTED
- **Owner**: root
- **Updated at**: 2026-09-04

## Why This Matters

Polling production bằng private-repo GitHub Actions vừa chậm vừa tiêu runner minutes. Radar cũng đang đánh đồng GitHub access error với rate limit và đánh đồng limiter nội bộ với GitHub, khiến thời điểm retry liên tục trượt và che root cause. Plan này đưa probe nhẹ sang Worker, giữ remediation dưới human control và khôi phục Radar tháng 09 bằng snapshot có provenance.

## Current State

- `.github/workflows/production-monitor.yml` chạy mỗi 15 phút và chỉ mở GitHub Issue.
- `scripts/lib/production-monitoring.mjs` có allowlist production origin nhưng chưa có incident/Telegram formatter.
- `server/src/services/skillRadarGithub.service.js` coi mọi GitHub `403` là rate limit và ưu tiên `X-RateLimit-Reset` trước `Retry-After`.
- `client/src/pages/admin/skill-radar/skillRadarSourceForm.utils.js` coi mọi HTTP `429` là GitHub rate limit.
- `.agents/upstream-skills/watchlist.json` có 23 skill; `.agents/upstream-technologies/watchlist.json` có TencentDB Agent Memory nhưng Admin read model chưa hợp nhất.

## Scope

**In scope:** Worker/watchdog mới, supervised incident workflow + prompt/schema/validator, Radar GitHub/client/read-model/scanner tests, Radar snapshot/audit tháng 09, spec/plan/runbook/package scripts.

**Out of scope:** production deploy/secrets/webhook, auto-merge/deploy/rollback, schema/migration, thay auth/CSRF/JWT/payment/wallet, sửa upstream skill/rule canonical.

## Step 1: Sửa Radar rate-limit và hợp nhất technology source

**Behavior:** generic GitHub 403 và local 429 hiển thị đúng nguyên nhân; TencentDB xuất hiện từ static technology watchlist, hai repo user đưa không tạo duplicate.

**Blast radius:** Radar service/utils/tests và static read-model paths.

**Depends on:** none.

**Verify:** focused server/client Radar tests và `npm run test:agents:radar` exit 0.

## Step 2: Thêm watchdog Worker và Telegram transition contract

**Behavior:** Cron 30 phút probe allowlisted với bounded cold-start retry; Durable Object giữ state authoritative, failure/recovery/ack có message cấu trúc và callback điều tra chỉ dispatch sau xác thực.

**Blast radius:** `workers/production-watchdog/`, monitoring contract tests, runbook/config example.

**Depends on:** Step 1.

**Verify:** `node --test workers/production-watchdog/src/worker.test.mjs` exit 0.

## Step 3: Thêm supervised Codex Draft PR workflow

**Behavior:** incident dispatch tạo patch/report không đặc quyền; test/build/secret-scan chỉ chạy code từ patch trong container không network/credential; fresh publish job chỉ tạo Draft PR sau pass và gửi Telegram update sanitize.

**Blast radius:** `.github/workflows/incident-remediation.yml`, `.github/codex/`, `.github/scripts/`, contract tests.

**Depends on:** Step 2.

**Verify:** `node --test .github/scripts/incident-remediation-contract.test.mjs` và structural workflow assertions exit 0.

## Step 4: Chạy lại toàn bộ Radar và semantic review

**Behavior:** snapshot 23 entries được làm mới hoặc giữ last-known-good có transient state; audit 09/2026 ghi từng changed/review-due source và quyết định.

**Blast radius:** `.agents/upstream-skills/snapshot.json`, `docs/audits/2026-09-skill-radar.md`.

**Depends on:** Step 1.

**Verify:** `npm run agents:radar`, rồi validate snapshot count/failures/report bằng Radar tests.

## Step 5: QA, review và bàn giao rollout bị khóa

**Behavior:** focused/relevant tests, security scan và diff review pass; runbook liệt kê chính xác secrets/KV/webhook cần owner cấu hình, polling cũ chỉ disable khi Worker live.

**Depends on:** Steps 1–4.

**Verify:** `npm run test:agents:eval`, `npm run agents:validate`, `npm run security:secrets`, `npm run security:data-boundaries`, `git diff --check`.

## Done Criteria

- [x] REQ-001 đến REQ-004 có test/evidence.
- [x] Không có auto-merge, auto-deploy, production write hoặc secret hardcode.
- [x] Snapshot Radar tháng 09 có 23 items và audit semantic tương ứng.
- [x] Plan/status phản ánh đúng verification và rollout thực tế.
- [x] Không chạm worktree production đang deploy.

## Verification Evidence — 2026-09-04

- `npm run test:unit:server` equivalent rerun với `npx vitest run --reporter=verbose --maxWorkers=2`: PASS, 207 files / 1.140 tests.
- `npm run test:unit:client`: PASS, 145 files / 649 tests.
- `npx vite build` trong `client/`: PASS; chỉ có chunk-size warning hiện hữu. Không chạy release lifecycle/prerender để tránh ghi vào sitemap artifacts của task production khác.
- `npm run test:incident-response`: PASS, 32/32.
- `npm run test:ops`: PASS, 84/84.
- `npm run test:agents:radar`: PASS, 20/20.
- `npm run test:agents:eval`: PASS, 9/9.
- Focused Radar/readiness server suite: PASS, 57/57; Radar scanner full run: PASS, 23/23 sources, 0 failure, generated at `2026-09-04T04:33:37.401Z`.
- `npm run security:secrets`, `npm run security:data-boundaries`, `git diff --check`: PASS.
- `npm run agents:validate`: FAIL duy nhất vì `.agents/reference/project-inventory.json` của task khác đang stale (stored 119/193, live 127/205 client/server tests). Không chạy generator để không ghi đè artifact đang được task khác sở hữu; các phần skill/plan/traceability/Radar của validator đều PASS.
- Independent security/operations review: mọi finding về patch scope, callback binding, FIFO outbox, artifact rerun và validation isolation đã được sửa và có regression contract.

## STOP Conditions

- Worker cần quyền/secrets chưa được user cung cấp: dừng ở code + runbook, không tự tạo account/gói/token.
- Patch agent yêu cầu nhóm file auth/CSRF/payment/wallet/schema/migration/workflow/agent policy: trả `no_safe_patch`, không tạo PR.
- Radar upstream rate-limit/network fail: giữ last-known-good, ghi blocker; không đoán hash/commit.
- Verification fail ba vòng cùng root cause hoặc phát hiện overlap với task production: dừng và báo evidence.

## Maintenance Notes

Reviewer cần kiểm tra denylist artifact trước mọi mở rộng remediation scope. Khi Worker live và đã quan sát failure/recovery, mới tắt schedule 15 phút của `production-monitor.yml`; manual dispatch vẫn nên được giữ làm deep diagnostic.

Các file mới `worker.mjs`, `worker.test.mjs`, remediation contract/test và workflow vượt guideline 300 dòng vì chúng là trust-boundary deployment/contract surfaces cần kiểm tra nguyên khối và test mirror sát contract. Không split trong task này để tránh tạo cross-module import/dependency có thể mở rộng patch hoặc workflow trust boundary; reviewer phải yêu cầu split nếu các surface tiếp tục tăng.
