# Security workflow skill drift audit — 2026-08-02

## Kết luận

Các security rules/skills hiện tại đúng nền tảng nhưng thiếu ba contract cần dùng lâu dài: threat model,
coverage ledger và bounded Codex Security scan. Giữ CI/local gates hiện có, bổ sung evidence contract và
cost/scope guard; không biến paid scan thành job tự động.

## Targets được audit

- `.agents/skills/audit/SKILL.md`
- `.agents/skills/audit-playbook/SKILL.md`
- `.agents/skills/pre-deploy/SKILL.md`
- `.agents/skills/ship/SKILL.md`
- `.agents/rules/security/security.md` — **manual review only**, không cho `$goad` auto-overwrite
- New context/tooling: `SECURITY.md`, scan runbook và bounded wrapper

## Evidence

- 🟢 **Verified** — Stack và security scripts khớp `client/package.json`/`server/package.json`.
- 🟢 **Verified** — CI chạy dependency audit, lint, tests, build, secret/data-boundary và E2E gates.
- 🟢 **Verified** — OAuth state đã browser-bound; dev-login explicit local opt-in; F1 assignment fail closed.
- 🟢 **Verified** — Audit 2026-08-02 có findings/validation, nhưng Codex Security dừng ở preflight.
- 🟢 **Verified** — Trước Plan 020 không có `SECURITY.md`, coverage ledger hoặc `--max-cost` wrapper.

## GIỮ

- 🟢 **Verified** — Recon, focused/quick/standard modes và evidence `file:line`.
- 🟢 **Verified** — False-positive, mis-attribution, duplicate và by-design vetting.
- 🟢 **Verified** — `$qa` sở hữu build/tests; `pre-deploy`/`ship` reuse evidence và fail closed BLOCK/HIGH.
- 🟢 **Verified** — httpOnly JWT, CSRF, role/ownership, upload, safeLog, SSRF/webhook/redirect/CSP rules.

## XÓA / THU GỌN

- 🟢 **Verified** — Xóa stateful “Patterns đã fix” khỏi `audit-playbook`; dùng canonical context/code hiện tại.
- 🟢 **Verified** — Không lặp command/mechanical checks giữa skills; giữ owner QA/CI/ship rõ ràng.
- 🟢 **Verified** — Sửa Gate 1 `pre-deploy` thành Security + Bugs + Tests, đúng `$audit quick`.
- 🟢 **Verified** — Không thêm automatic paid scan vào CI; không coi `--max-cost` là hard cap.

## THÊM

### Root security context

- 🟢 **Verified** — Entry points, untrusted inputs, trust boundaries, assets, invariants, severity và exclusions.
- 🟢 **Verified** — Review trigger cho auth/payment/wallet/integration/upload/private data.

### Coverage ledger và candidate validation

- 🟢 **Verified** — Ghi revision/scope, reviewed surfaces, entry point → validator → authorization → sink,
  tests/evidence, deferred areas và proof gaps.
- 🟢 **Verified** — Candidate → validate/reject → impact/path → bounded fix → focused regression → re-validation.
- 🟢 **Verified** — Candidate thiếu attacker-controlled path/proof không được gọi confirmed vulnerability.

### Risk-based Codex Security

- 🟢 **Verified** — Routine change chỉ dùng local/CI gates.
- 🟢 **Verified** — High-risk/release bắt đầu working-tree/diff/path; full/deep cần scope + cost authority.
- 🟢 **Verified** — Trạng thái SKIP/PREFLIGHT/COMPLETE/PARTIAL-BLOCKED phải đúng thực tế.

### Wrapper và runbook

- 🟢 **Verified** — Default dry-run + working-tree, low max-cost, explicit execute/full/deep acknowledgement.
- 🟢 **Verified** — Unit tests không gọi network/paid scan; không log credential/raw finding payload.

## VERIFY

1. `npm run agents:validate`.
2. `node --test scripts/codex-security-scan.test.mjs`.
3. `npm run security:codex -- --working-tree --dry-run` — preflight-only.
4. Secret/data-boundary/dependency gates, tests và `git diff --check`.
5. Targeted diff review; không sửa `.vscode/`, schema hoặc production data.

## Approval

- User approved the draft on 2026-08-02.
- Apply scope is locked to the GIỮ/XÓA/THÊM/VERIFY sections above.
