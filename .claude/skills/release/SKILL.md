---
name: release
description: Pipeline release gate trước push/deploy staging hoặc production của HTCOACHINGWEB — gom QA evidence, security, SEO, UI, AI, cấu hình Claude và promotion evidence rồi kết luận GO/NO-GO. Chỉ chạy khi user gọi /release.
disable-model-invocation: true
argument-hint: "[staging|production] [skip-ui|skip-ai|skip-audit]"
---

# /release — Release gate

Kết luận `GO FOR STAGING`, `GO`, `GO WITH WARNINGS` hoặc `NO-GO`. Kết quả **không** tự cấp quyền push,
deploy hay migration; chỉ làm khi user yêu cầu rõ.

Trước khi chạy: xác định target `staging` hoặc `production` (hỏi nếu `$ARGUMENTS` không nói), đọc policy
canonical `.claude/rules/release-promotion.md` và runbook `docs/operations/runbooks/release-promotion.md`.
Skill này chỉ điều phối; không tự định nghĩa contract khác hai nguồn đó.

Các gate độc lập (1–5) có thể chạy song song. Gate fail thì vẫn hoàn tất các kiểm tra read-only để báo cáo
đầy đủ, nhưng tuyệt đối không deploy.

## Gate 1 — QA evidence

- Dùng skill `qa` ở mode full đúng một lần; tái sử dụng evidence còn hợp lệ (đúng `HEAD`, working tree, scope,
  chưa hết hạn) thay vì chạy lại build/tests.
- `qa quick` không phải release evidence. E2E phải `PASS` hoặc `SKIP` có lý do và đánh giá rủi ro.
- QA `FAIL`/`BLOCKED` hoặc evidence không hợp lệ → `NO-GO`.

## Gate 2 — Security

Đọc diff và kiểm theo `.claude/rules/security.md`:

- Không hardcode secret; mutating request vẫn qua CSRF; route mới có `protect`/`requireRoles`/`requireTrainerAccess`
  phù hợp; input validate ở server.
- IDOR: `findById(req.params.id)` trên endpoint user-accessible phải có ownership check hoặc nằm sau `requireRoles("admin")`.
- CSRF vẫn `crypto.timingSafeEqual()`; CSP trong `server/src/middlewares/securityHeaders.js` còn nguyên;
  `client/public/.well-known/security.txt` tồn tại.
- Security-critical path log bằng `safeLog`, không log PII/token.
- Diff nhạy cảm (auth, payment, wallet, contract, trust boundary mới): ghi coverage ledger theo
  `.claude/skills/audit/references/security-coverage-ledger.md`; cân nhắc giao `security-reviewer` subagent.
- Chạy:

```bash
npm run security:secrets
npm run security:data-boundaries
npm run security:audit --prefix client
npm run security:audit --prefix server
```

Không có lỗ hổng dependency mức `high`/`critical`. Scan trả phí (`npm run security:codex`) chỉ khi user cấp scope
và chi phí; ghi đúng `SKIP`/`PREFLIGHT ONLY`/`COMPLETE`/`PARTIAL`, preflight không phải PASS.

## Gate 3 — AI (skip nếu diff không chạm `server/src/services/ai/`, `client/src/components/ChatWidget/`, `client/src/hooks/useAiChat.js`)

Chạy phần "Kiểm tra trước bàn giao" của skill `ai-chat-system`.

## Gate 4 — UI (skip nếu diff không chạm `client/src/{pages,sections,components,layouts}/`)

```bash
npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high
```

Finding mới `high` → FAIL. Review rendered theo skill `ui-quality` khi diff đổi layout/interaction.

## Gate 5 — SEO (skip nếu diff không chạm route public, metadata, sitemap, prerender)

Chạy skill `seo` ở mode static; tái sử dụng report còn hợp lệ.

## Gate 6 — Cấu hình Claude và cleanup

```bash
npm run agents:validate
```

Exit khác 0 → `NO-GO`. Không có `console.log` debug, commented-out code mới, unused import, hardcoded URL/credential
do diff tạo ra; file mới ≤ 300 dòng hoặc có lý do.

## Gate 7 — Promotion evidence

- `staging`: ghi `PENDING (created only after live staging acceptance)`; không block `GO FOR STAGING`.
- `production`: tải per-release candidate artifact và chạy `scripts/release-gate.mjs --mode=candidate` với recovery
  manifest hiện tại. PASS chỉ khi CI/client/server/candidate SHA trùng nhau, staging acceptance PASS, cleanup
  verified residue `0`, release + off-device recovery ready và có hai rollback deploy IDs.
- Thiếu/stale/lệch SHA → `NO-GO FOR PRODUCTION`. Không dùng QA local thay live staging evidence; không chạy
  acceptance mutating lên production.

## Quyết định

| Điều kiện | Kết quả |
|---|---|
| Gate bắt buộc `FAIL`/`BLOCKED`, hoặc còn finding `BLOCK`/`HIGH` | `NO-GO` |
| Mọi gate pass, có MED được ghi đủ evidence, rủi ro, lý do, owner, follow-up | `GO WITH WARNINGS` |
| Target staging, mọi gate local pass | `GO FOR STAGING` |
| Target production, mọi gate kể cả promotion evidence pass | `GO` |

MED không được dùng để hạ cấp build/test/security failure. Sau khi user sửa finding: invalidate evidence bị ảnh
hưởng, chỉ chạy lại gate liên quan rồi kết luận lại.

## Báo cáo

```text
RELEASE GATE — HTCoachingWeb
Target: staging | production
QA evidence:   PASS (reused | generated) | FAIL | BLOCKED
Security:      PASS | FAIL
AI:            PASS | FAIL | SKIP (<lý do>)
UI:            PASS | FAIL | SKIP
SEO:           PASS | FAIL | SKIP
Config/cleanup: PASS | FAIL
Promotion:     PENDING (staging) | PASS (<SHA + run>) | FAIL

Findings (theo severity): | # | Gate | Finding | file:line | Severity |
RESULT: GO FOR STAGING | GO | GO WITH WARNINGS | NO-GO
Reason: <kết luận có bằng chứng>
```
