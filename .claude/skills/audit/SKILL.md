---
name: audit
description: Audit sức khỏe codebase HTCOACHINGWEB theo 7 nhóm (bugs, security, performance, tests, tech debt, dependencies, DX) với evidence file:line, hoặc reconcile backlog docs/plans. Chỉ chạy khi user gọi /audit.
disable-model-invocation: true
argument-hint: "[quick|security|perf|tests|<category>|reconcile]"
---

# /audit — Quét codebase tìm vấn đề ẩn

Advisor: quét, vet, báo cáo, viết plan khi user chọn. Chỉ sửa code khi user yêu cầu ("fix #1").
Không thay `qa` hay `/release`: audit tìm vấn đề, không sở hữu build/test hay quyết định release.

| Gọi | Phạm vi |
|---|---|
| `/audit` | Standard: key packages, đủ 7 nhóm |
| `/audit quick` | Hotspot (git churn) + critical path auth/payment/wallet/contract; Security + Bugs + Tests; ~5 finding HIGH confidence |
| `/audit <nhóm>` | Một nhóm, quét sâu (`security`, `perf`, `tests`...) |
| `/audit reconcile` | Rà lại `docs/plans/` |

Mọi finding phải có evidence `file:line`. "Có lẽ có N+1 ở đâu đó" không phải finding;
"`orders/api.js:142` query mỗi item trong loop" mới là finding. Không bao giờ chép giá trị secret vào finding.
Luôn ghi rõ phần **không** audit.

## 1. Recon

1. `CLAUDE.md`, `client/package.json`, `server/package.json`, `server/server.js` (routes/middlewares),
   `client/src/App.jsx` (routes, lazy loading).
2. `.claude/rules/known-issues.md` — pattern by-design, không báo thành finding.
3. `git log --oneline -20` và churn để tìm hotspot.

## 2. Audit theo nhóm

1. **Correctness**: catch rỗng hoặc chỉ log trên critical path; promise không await; race (đặc biệt refresh token trong
   `client/src/utils/api.js`); `findById`/`findOne` không xử lý `null`; `req.user` chưa kiểm; off-by-one pagination,
   timezone; transition trạng thái order/subscription bị bỏ sót; listener/connection leak.
2. **Security**: route thiếu `protect`/`requireRoles`; IDOR (`findById(req.params.id)` không ownership, trừ admin-only);
   input không qua validation; upload thiếu type/size; mass assignment/operator injection; so sánh secret không
   timing-safe; log có PII; dependency `npm run security:audit --prefix client|server` mức high/critical.
   Diff chạm URL fetch, filesystem path, object merge/query, regex động, browser output, shell hoặc GitHub Actions:
   đọc [JavaScript and workflow threat routing](references/javascript-threat-routing.md).
3. **Performance**: N+1 Mongoose trong loop, độ phức tạp sai (nested find thay Map/Set), query lặp mỗi request,
   select thừa field, thiếu pagination, bundle/code-splitting/ảnh, việc đồng bộ nên đưa vào queue.
4. **Tests**: critical path chưa có test (auth, wallet, CRUD), file churn cao không test; nêu top 5 theo rủi ro
   (quy ước ở `.claude/rules/testing.md`).
5. **Tech debt & architecture**: trùng logic, vi phạm layering, dead code, god object, nhiều cách làm cùng một việc,
   shallow module, low locality. Đọc [Architecture depth review](references/architecture-depth.md); chỉ giữ candidate
   có friction thật, deletion test và seam before/after rõ. File lớn không tự là finding.
6. **Dependencies**: major-version lag, API deprecated, package bỏ rơi, trùng package.
7. **DX & tooling**: thiếu typecheck/formatter, feedback chậm, env var không có tài liệu, log không cấu trúc.

## 3. Security candidate lifecycle

Map untrusted input → validation → authorization → sink. Candidate chỉ thành finding khi có đường đi attacker
kiểm soát, reachability và impact thực tế; thiếu proof ghi `proof gap`. Finding bị loại ghi lý do để không báo lại.
Với `/audit security` hoặc quick audit chạm critical path, thêm ledger theo
[security coverage ledger](references/security-coverage-ledger.md). Không tuyên bố "full coverage" khi còn vùng deferred.
Có thể giao `security-reviewer` subagent cho phần trace độc lập. Scan trả phí (`npm run security:codex`,
runbook `docs/operations/runbooks/codex-security-scan.md`) không chạy mặc định; chỉ khi user cấp scope và chi phí.

## 4. Vet và xếp hạng

Mở lại code tại từng `file:line`; loại false positive, by-design, trùng lặp; sửa attribution sai.
Xếp hạng `leverage = impact ÷ effort × confidence`.

## 5. Báo cáo

Dùng format trong [templates](references/templates.md):

```text
AUDIT REPORT — HTCoachingWeb
Depth: standard | Audited: ... | Not audited: ...
| # | Finding | Category | Impact | Effort | Risk | Evidence |
Considered and rejected: <by-design / known issue>
```

Sau đó hỏi user: "plan #1, #3" → viết plan bằng skill `plan-template` vào `docs/plans/`; "fix #1" → sửa trực tiếp.

## Reconcile `docs/plans/`

Đọc `docs/plans/README.md`, `plan-state.json` và từng plan:
DONE → spot-check done criteria; BLOCKED → điều tra, viết lại hoặc REJECTED; IN PROGRESS lâu → báo user;
PLANNED → kiểm drift, refresh hoặc REJECTED ("fixed independently"). Báo cáo nhóm theo trạng thái.
