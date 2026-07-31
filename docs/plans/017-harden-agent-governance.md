# Plan 017: Harden agent governance and eliminate instruction drift

> **Hướng dẫn thực thi**: Thực hiện theo từng nhóm file độc lập, dùng subagents chỉ khi
> task đủ phức tạp và các nhóm file không chồng lấn. Root agent chịu trách nhiệm tích hợp,
> review chéo và verification cuối. Nếu phát hiện cần thay đổi Doppler hoặc cấu hình môi
> trường thì dừng phần đó vì đã được user hoãn rõ ràng.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security | tech-debt | dx
- **Planned at**: 2026-07-31
- **Approval**: User đã duyệt triển khai toàn bộ findings của audit, ngoại trừ Doppler/environment safety.

## Why This Matters

Hệ thống `AGENTS.md` và `.agents/` có nền tảng tốt nhưng đang drift so với code thật,
có một số hướng dẫn debug không an toàn, path lỗi thời và pipeline verification bị chạy
trùng. Kế hoạch này biến governance thành một hệ thống có nguồn canonical, validator tự
động và quy tắc phân loại task rõ ràng để root agent biết khi nào tự làm, khi nào giao các
subagents rồi tổng hợp.

## Current State

- `AGENTS.md` có safety và coding rules tốt nhưng chưa có rubric đánh giá độ phức tạp/task delegation.
- `.agents/skills/debugging/SKILL.md` gợi ý dùng jwt.io và log raw request/JWT payload.
- `.agents/skills/tdd-guide/SKILL.md` hardcode 10 test files trong khi repo có nhiều hơn đáng kể.
- `.agents/reference/project-guide.md` hardcode số models/controllers/routes đã lỗi thời.
- `.agents/rules/seo/seo.md`, `new-page`, `seo-check` và Home JSON-LD không thống nhất.
- `.agents/skills/pre-deploy/SKILL.md` mô tả skill drift bằng các path cũ và chạy lại QA qua `$ship`.
- `.agents/scripts/` mới chỉ có validator cho AI tools, chưa validate instruction system.
- `.agents/skills/new-tool/SKILL.md` bắt buộc UI card dù runtime contract cho phép `uiCard?`.
- `.agents/skills/goad/SKILL.md` phụ thuộc artifact/`RequestFeedback` không portable.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Agent system validation | `node .agents/scripts/validate-agent-system.mjs` | exit 0, không có error |
| AI tool validation | `node .agents/scripts/validate-tools.mjs` | 11 tools pass |
| Markdown/reference scan | validator ở trên | không có broken internal reference thật |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope:**

- `AGENTS.md`
- `.agents/reference/project-guide.md`
- `.agents/rules/code/*`, `.agents/rules/security/security.md`, `.agents/rules/seo/seo.md`
- `.agents/rules/workflow/task-orchestration.md`
- Các skill bị finding: `audit`, `debugging`, `goad`, `new-page`, `new-tool`,
  `pre-deploy`, `qa`, `schema-change`, `seo-check`, `ship`, `tdd-guide`
- `.agents/scripts/validate-agent-system.mjs`, `.agents/scripts/validate-tools.mjs`
- Root `package.json` và CI workflow nếu cần đăng ký validator
- Plan này và `docs/plans/README.md`

**Out of scope:**

- Doppler project/config, secrets và mọi environment mutation.
- Deploy, migration, seed, cleanup staging/production.
- Product source code trong `client/src` và `server/src`, trừ đọc để xác minh canonical facts.
- Những thay đổi UI/navigation đang có sẵn trong worktree.

## Steps

### Step 1: Fix unsafe and stale instructions

Sửa hướng dẫn JWT/logging, path lỗi, số liệu hardcode, SEO schema và workflow AI tool
theo code thật. Không thêm dữ liệu production hoặc secret vào tài liệu.

**Verify**: tìm lại các pattern `jwt.io`, raw `req.body`, `known_issues.md`, `tdd.md`,
`ai-chat-system.md` và xác nhận không còn reference sai.

### Step 2: Add task complexity and delegation governance

Thêm rubric SIMPLE/MODERATE/COMPLEX, tiêu chí dùng subagents, ownership file và trách
nhiệm của root agent. Quy tắc phải tôn trọng giới hạn công cụ/system hiện hành.

**Verify**: rule nêu rõ root đánh giá mọi task; task dễ root tự cover; task phức tạp chỉ
delegate phần độc lập; root tích hợp và review cuối.

### Step 3: Make skill drift executable

Tạo validator kiểm tra frontmatter, directory/name, internal references, package scripts,
deprecated references và facts có thể đếm từ repo. Đăng ký command ở root package và CI.

**Verify**: `node .agents/scripts/validate-agent-system.mjs` exit 0.

### Step 4: Remove duplicate verification work

Để `qa` sở hữu build/tests, `ship` tổng hợp release/security/cleanup evidence và
`pre-deploy` orchestration không chạy lại cùng command. Đồng bộ PASS/WARN/NO-GO semantics.

**Verify**: mỗi expensive command chỉ có một workflow owner và pre-deploy mô tả reuse evidence.

### Step 5: Integrate and re-audit

Root agent review tất cả diff từ subagents, re-run validator, AI tool validator,
`git diff --check` và kiểm tra worktree không có thay đổi ngoài scope do task này tạo ra.

## Test Plan

- Validator agent system: positive path trên repo hiện tại.
- Validator AI tools: giữ nguyên 11/11 pass.
- Static grep cho unsafe debug examples và stale path.
- Review thủ công canonical Home JSON-LD và package scripts.
- Không chạy client/server test suite vì không thay product runtime code.

## Done Criteria

- [x] Không còn hướng dẫn đưa JWT lên website ngoài hoặc log raw body/token payload.
- [x] Không còn hardcode test/model/controller/route counts dễ drift.
- [x] SEO Home schema thống nhất với `client/src/pages/Home.jsx`.
- [x] Task complexity/delegation rule được root `AGENTS.md` route rõ ràng.
- [x] Agent-system validator pass và được CI/pre-deploy sử dụng.
- [x] `pre-deploy`, `qa`, `ship` không chạy trùng build/tests.
- [x] `new-tool` hỗ trợ text-only và optional UI card.
- [x] `goad` dùng repo-native draft/review flow.
- [x] Doppler/environment safety chưa bị thay đổi.
- [x] `docs/plans/README.md` cập nhật trạng thái Plan 017.

## STOP Conditions

- Cần sửa product runtime behavior để làm validator pass.
- Cần đụng Doppler, secret manager hoặc staging/production target.
- Một subagent phát hiện file được giao đã bị thay đổi đồng thời bởi người khác.
- Verification fail ba vòng với cùng root cause.

## Maintenance Notes

- Không lặp canonical facts trong nhiều skill; link tới rules/reference rồi validate path.
- Facts có thể đếm phải được validator sinh/so sánh, không ghi snapshot cố định.
- Subagents không tự động đồng nghĩa với chất lượng: chỉ dùng cho workstreams độc lập và
  root agent luôn chịu trách nhiệm kết quả cuối.
