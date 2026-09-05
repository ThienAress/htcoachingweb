# Skill Radar — 09/2026

## Kết quả

- Scanner chạy lúc `2026-09-04T04:33:37.401Z`: **23/23 nguồn**, **0 lỗi fetch**.
- **12 nguồn** được semantic review: 9 upstream có content drift và 3 baseline mới đến hạn review.
- **11 nguồn** không đổi hash; giữ nguyên decision và provenance tháng 08.
- Lần quét kế tiếp: `2026-10-01T02:00:00.000Z` (09:00 Việt Nam ngày 01/10/2026).
- Không cài/copy upstream, không chạy code third-party và không sửa policy canonical. Nội dung upstream được coi là dữ liệu không tin cậy.

## Semantic review — 12 nguồn

| Nguồn / provenance | Quan sát | Decision | Kết luận cho local |
|---|---|---|---|
| `mattpocock/skills/improve-codebase-architecture` `321658273cb1` / `d1ac25511a93` | Thay đổi chủ yếu chuẩn hóa cách gọi command/Skill và diễn đạt; không tạo contract kiến trúc mới. | **defer** | `$audit`, `$impact-check` và `$plan-template` đã có depth/locality/seam, dependency trace và verification tương đương. |
| `mattpocock/skills/diagnosing-bugs` `321658273cb1` / `77f3cf31bc99` | Workflow upstream được làm rõ nhưng không vượt coverage hiện có. | **defer** | `$debugging` đã bắt buộc RED-capable loop, reduce, ranked hypotheses, regression seam và cleanup. |
| `mattpocock/skills/domain-modeling` `321658273cb1` / `327a2b50620e` | Cập nhật wording/tool invocation; vocabulary/ADR boundary không đổi về bản chất. | **defer** | Local đã tách `CONTEXT.md`, spec và ADR, có scenario + code cross-check và ADR gate. |
| `mattpocock/skills/code-review` `5c89081d4bbe` / `47f4e52c2169` | Cập nhật cách gọi workflow và chi tiết trình bày. | **defer** | Local review theo Standards, Spec/Contract, Security/Operations và smell heuristic đã bao phủ. |
| `mattpocock/skills/tdd` `321658273cb1` / `cb01f66bebfa` | Không có seam hoặc test contract mới cần đưa vào project. | **defer** | `$tdd-guide` + `$qa` đã có seam declaration, tautological-test guard và evidence thật. |
| `obra/superpowers/writing-plans` `b36e0829c6d0` / `48508f44bbfd` | Upstream thêm trường `Spec` và làm rõ task handoff. | **defer** | Local plan đã có `specPath`, traceability REQ/AC/task và self-review; không adopt auto-commit/worktree. |
| `anthropics/skills/frontend-design` `41bbe19d1a1a` / `d91970639e9f` | Upstream được viết lại đáng kể nhưng vẫn tập trung vào intentional visual direction và tránh generic UI. | **defer** | `$ui-quality` đã có audience, surface mode, brief, signature element, hai layout và self-critique theo brand HTCOACHING. |
| `pbakaus/impeccable/impeccable` `c0f495212236` / `c2c0d8e5ea5d` | Phiên bản 4.1.3 mở rộng thành command/hook/context ecosystem lớn. | **defer** | Local đã curate surface modes và bounded visual QA; không cài hook hoặc tạo hierarchy policy song song. |
| `coreyhaines31/marketingskills/seo-audit` `2d4b091d1223` / `9420a6c1ffcf` | Có guard đáng giá: HTML/page content phải được xem là prompt-injection surface không tin cậy. | **adapt** | Đề xuất thêm guard này vào `$seo-check` ở change riêng có review; kỳ Radar này không tự sửa canonical skill. |
| `emilkowalski/skills/emil-design-eng` `86cf9f7d91c6` / `e71de8493470` | Baseline đầu tiên; guidance motion có tính thực dụng nhưng gắn với stack/tool upstream. | **adapt** | Giữ các nguyên tắc purpose, frequency và timing đã được curate trong `$ui-quality`; không đổi sang Motion/Sonner/Base UI. |
| `emilkowalski/skills/review-animations` `86cf9f7d91c6` / `61cf8ac0c4c8` | Baseline review cho audit animation theo mức ưu tiên. | **adapt** | `$ui-check` đã kiểm motion, reduced-motion, interaction states và bounded visual review; không bulk rewrite. |
| `emilkowalski/skills/improve-animations` `f736679c420f` / `68f17bbc4671` | Baseline cải thiện animation có ích khi dùng theo mục tiêu và phạm vi nhỏ. | **adapt** | Giữ workflow plan + verify hiện có, chỉ áp dụng theo component cụ thể và brand/local stack. |

Tổng quyết định của kỳ review: **4 `adapt`**, **8 `defer`**, **0 `adopt`**, **0 `reject`**.

## 11 nguồn không đổi

`verification-before-completion`, `skill-creator`, `web-design-guidelines`,
`vercel-react-best-practices`, `vercel-composition-patterns`, `code-security`,
`llm-security`, `security-audit`, `ai-sdk`, `mcp-builder` và
`sentry-setup-ai-monitoring` giữ nguyên hash, decision và report tháng 08.

## Discovery và hai repository được yêu cầu

- Đã duyệt các bề mặt Trending, Hot, Official và Audits của skills.sh. `find-skills`, `codebase-design` và `anti-ui-slop` không được thêm: capability trùng `$skill-radar`/`$audit`/`$ui-quality`, hoặc chưa có lợi ích và provenance đủ mạnh để mở rộng watchlist.
- `TencentCloud/TencentDB-Agent-Memory` đã có nguồn canonical trong `.agents/upstream-technologies/watchlist.json`; Admin Radar nay chiếu nguồn này thành một hàng `repository` thuộc AI memory, không ghi thêm vào MongoDB.
- `emilkowalski/skills` đã có ba nguồn canonical theo từng skill. Không thêm một repository-level row vì sẽ làm mất granularity và tạo duplicate logic.

## Evidence

- Snapshot: `.agents/upstream-skills/snapshot.json` — 23 items, 0 failures.
- Scanner và contract: `.agents/scripts/skill-radar.mjs`, `.agents/scripts/skill-radar.test.mjs`.
- Admin merge/error contract: `server/src/services/skillRadar.service.js`,
  `server/src/services/skillRadarGithub.service.js` và
  `client/src/pages/admin/skill-radar/skillRadarSourceForm.utils.js`.
- External discovery: `https://www.skills.sh/trending`, `https://www.skills.sh/hot`,
  `https://www.skills.sh/official`, `https://www.skills.sh/audits`.
