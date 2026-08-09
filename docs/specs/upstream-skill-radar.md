# Upstream Skill Radar

## Objective

Xây dựng một hệ thống theo dõi có kiểm soát cho các Agent Skill chất lượng cao từ
[skills.sh](https://www.skills.sh/), phát hiện thay đổi upstream theo tháng và giúp maintainer quyết định
`adopt`, `adapt`, `reject` hoặc `defer` trước khi cập nhật skill/rule canonical của HTCOACHINGWEB.

Hệ thống gồm hai bề mặt liên kết với nhau:

1. `$skill-radar` và scanner repo-native phục vụ engineering governance.
2. Trang Admin **Radar công nghệ** hiển thị watchlist, drift, audit và lịch kiểm tra kế tiếp ở chế độ read-only.

## Assumptions

1. `skills.sh` là nguồn discovery/ranking/audit chính, nhưng không phải nguồn chân lý duy nhất; GitHub repository
   và nội dung skill thực tế vẫn phải được kiểm tra.
2. Admin dashboard chỉ dành cho role `admin`; không mở cho Trainer/User và không cần SEO.
3. Giai đoạn đầu không cho sửa watchlist từ production UI. Thêm, đổi hoặc loại nguồn phải qua file versioned trong
   repo để giữ Git history và review.
4. Không thêm Mongoose schema. Dashboard đọc manifest/snapshot đã sanitize thông qua API admin-only.
5. Job tự động chỉ thu thập metadata và phát hiện drift. Nó không tự cài skill, sửa `.agents/skills/`, sửa
   `.agents/rules/`, commit, merge hoặc deploy.

## Canonical Boundaries

- `AGENTS.md` và `.agents/rules/` tiếp tục là policy canonical.
- `.agents/skills/` tiếp tục là workflow đã thích nghi cho HTCOACHINGWEB.
- Upstream skill chỉ là input tham khảo, không bao giờ thắng policy/security/project contract.
- `$skill-radar` xử lý **external upstream drift** và tạo báo cáo.
- `$goad` xử lý **internal codebase drift** sau khi một local skill được chọn để review.
- `skills.sh` có thể giúp discovery, popularity và security audit, nhưng install count không chứng minh chất lượng
  hoặc độ phù hợp với project.

## Initial Watchlist — 20 Skills

| # | Domain | Upstream skill | Source | Local targets chính | Lý do theo dõi |
|---:|---|---|---|---|---|
| 1 | Architecture | `improve-codebase-architecture` | `mattpocock/skills` | `audit`, `impact-check`, `plan-template` | Phát hiện coupling và thiết kế refactor có giới hạn. |
| 2 | Debugging | `diagnosing-bugs` | `mattpocock/skills` | `debugging` | Nâng chất lượng hypothesis/reproduction loop. |
| 3 | Domain | `domain-modeling` | `mattpocock/skills` | `domain-modeling`, `CONTEXT.md` | Giữ vocabulary và boundary nghiệp vụ nhất quán. |
| 4 | Review | `code-review` | `mattpocock/skills` | `code-review` | Học cách review có evidence và severity rõ. |
| 5 | Testing | `tdd` | `mattpocock/skills` | `tdd-guide`, `qa` | Theo dõi TDD workflow thực dụng cho coding agents. |
| 6 | Planning | `writing-plans` | `obra/superpowers` | `feature-spec`, `plan-template` | Cải thiện decomposition và verification checkpoint. |
| 7 | Delivery | `verification-before-completion` | `obra/superpowers` | `qa`, `cleanup-delivery`, `ship` | Ngăn agent tuyên bố hoàn thành khi chưa có evidence. |
| 8 | Skill authoring | `skill-creator` | `anthropics/skills` | Toàn bộ `.agents/skills/` | Theo dõi format, progressive disclosure và evaluation. |
| 9 | UI | `frontend-design` | `anthropics/skills` | `ui-quality` | Nâng taste, hierarchy và chất lượng frontend. |
| 10 | UI audit | `web-design-guidelines` | `vercel-labs/agent-skills` | `ui-check` | Theo dõi accessibility và web UI review checklist. |
| 11 | React | `vercel-react-best-practices` | `vercel-labs/agent-skills` | `ui-quality`, `qa` | Phù hợp React 19, performance và client rendering. |
| 12 | React architecture | `vercel-composition-patterns` | `vercel-labs/agent-skills` | `ui-quality`, `impact-check` | Giảm prop/state coupling và component API kém bền. |
| 13 | Design quality | `impeccable` | `pbakaus/impeccable` | `ui-quality`, `ui-check` | Nguồn tham khảo mạnh để tránh UI slop. |
| 14 | AppSec | `code-security` | `semgrep/skills` | `audit`, `audit-playbook`, security rules | OWASP và secure coding theo ngôn ngữ. |
| 15 | AI security | `llm-security` | `semgrep/skills` | `ai-chat-system`, `ai-check`, security rules | Prompt injection, tool abuse và OWASP LLM risks. |
| 16 | Security audit | `security-audit` | `cloudflare/security-audit-skill` | `audit`, `code-review`, security rules | Tập trung vào finding khai thác được và impact thật. |
| 17 | AI application | `ai-sdk` | `vercel/ai` | `ai-chat-system`, `new-tool`, `ai-check` | Theo dõi streaming, tool calling, structured output và agent loops. |
| 18 | Agent tooling | `mcp-builder` | `anthropics/skills` | `new-tool`, future MCP workflows | Học schema, tool annotation, pagination và eval MCP. |
| 19 | Observability | `sentry-setup-ai-monitoring` | `getsentry/sentry-agent-skills` | AI operations/observability | Theo dõi latency, token, tool calls và PII boundaries. |
| 20 | SEO | `seo-audit` | `coreyhaines31/marketingskills` | `seo-check` | Bổ sung crawlability, indexation, schema và content audit. |

## Watchlist Data Contract

Tách dữ liệu do maintainer quản lý khỏi dữ liệu scanner sinh ra:

### Watchlist entry

- `id`: stable skills.sh id, dạng `{owner}/{repo}/{skill}`.
- `name`, `sourceRepo`, `sourcePath`, `repoUrl`, `skillsShUrl`.
- `domain`, `summary`, `localTargets`.
- `trustTier`: `official`, `expert` hoặc `community`.
- `lifecycle`: `candidate`, `active`, `watch`, `dormant`, `archived`, `rejected`.
- `reviewIntervalDays`, `addedAt`, `license`, `notes`.

### Generated snapshot

- `contentHash`, `lastUpstreamCommitAt`, `lastCheckedAt`, `lastReviewedAt`, `nextCheckAt`.
- `drift`: `unknown`, `clean`, `changed`, `review_due`, `rate_limited`, `unreachable`, `audit_warning`.
- `auditSummary`: kết quả từ các audit provider, không coi một provider đơn lẻ là tuyệt đối.
- `decision`: `pending`, `adopt`, `adapt`, `reject`, `defer`.
- `decisionReason`, `reportPath` và lỗi fetch đã sanitize.

Không lưu token, raw GitHub response, toàn bộ nội dung third-party skill hoặc dữ liệu production trong snapshot.

## Lifecycle Policy

- `candidate`: nguồn mới tìm thấy từ Trending/Hot/Official/Audits; chưa vào scan chính thức.
- `active`: liên quan trực tiếp tới local target; kiểm tra hàng tháng.
- `watch`: giá trị tiềm năng nhưng ưu tiên thấp; kiểm tra hàng quý.
- `dormant`: không có thay đổi có ý nghĩa ít nhất 12 tháng **và** không còn local target đang dùng; kiểm tra 6 tháng/lần.
- `archived`: repo bị archive/xóa hoặc skill được upstream thay thế; ngừng scan nhưng giữ record quyết định.
- `rejected`: license, security hoặc compatibility không đạt; giữ record để tránh rediscovery lặp lại.

Không tự hạ trạng thái chỉ vì repo ít commit. Một skill trưởng thành có thể ổn định. Chỉ chuyển `active → watch → dormant`
khi đồng thời xét activity, relevance, local usage, maintainer response, security và nguồn thay thế. Không xóa vật lý record
đã review; archive giúp giữ lịch sử quyết định.

## Monthly Review

- Lịch dự kiến: 09:00 ngày 1 mỗi tháng theo `Asia/Saigon` (`0 2 1 * *` theo UTC).
- Scanner deterministic kiểm tra 20 nguồn active, content hash, commit theo source path, repository state và URL health.
- GitHub API `403/429` được ghi `rate_limited`, giữ last-known-good provenance và không suy diễn repository đã chết.
- Source chưa có `lastReviewedAt` phải qua baseline content comparison; `clean` chỉ mô tả hash drift sau baseline.
- `$skill-radar` đọc kết quả, duyệt Trending/Hot/Official/Audits trên skills.sh, tìm candidate mới và tạo
  `docs/audits/YYYY-MM-skill-radar.md`.
- Mỗi thay đổi phải được phân loại `adopt`, `adapt`, `reject` hoặc `defer` kèm evidence.
- Chỉ sau phê duyệt mới dùng `$goad`/skill domain tương ứng để cập nhật local canonical source.

## Admin — Radar công nghệ

### Summary

Hiển thị số nguồn `active`, `changed`, `review_due`, `candidate` và `dormant` cùng thời điểm quét kế tiếp.

### Table columns

1. Skill / repository.
2. Lĩnh vực và tóm tắt giá trị.
3. Local targets bị ảnh hưởng.
4. Trust/audit status.
5. Lifecycle và drift.
6. Upstream update gần nhất.
7. Review gần nhất.
8. Ngày quét dự kiến theo giờ Việt Nam, hiển thị dạng `DD/MM/YYYY`.
9. Link skills.sh/GitHub và report gần nhất.

Thông tin phụ như SHA/hash, license, decision history và ghi chú nằm trong detail drawer để tránh bảng ngang quá tải.
Trang phải có search, filter theo domain/lifecycle/drift và đầy đủ loading/empty/error states.

## Security and Operations Boundaries

- Route API bắt buộc `protect` + `requireRoles("admin")`.
- Backend chỉ trả allowlisted metadata; không trả raw third-party content hoặc filesystem paths tuyệt đối.
- Không gọi skills.sh/GitHub từ request của người dùng; dashboard đọc snapshot local để tránh latency, rate limit và outage.
- Network fetch chỉ chạy trong scanner, có timeout, retry giới hạn, response-size cap và domain allowlist.
- Security warning, license conflict hoặc repository owner change phải buộc manual review.
- Không auto-install, auto-merge, auto-commit, auto-deploy hoặc ghi database production.

## Success Criteria

- Có đúng 20 upstream skill ban đầu, mỗi entry có provenance và local targets.
- Scanner phát hiện content hash thay đổi và tạo snapshot/report deterministic mà không sửa local skill.
- Lịch tháng có thể chạy tự động và thủ công; failure không làm CI/release chính thất bại.
- `$skill-radar` và `$goad` có ranh giới rõ, validator bao phủ skill mới.
- Admin thấy summary, filters, trạng thái, lần review và ngày quét dự kiến từ API admin-only.
- Không thêm Mongoose schema, không có production mutation và không lộ secret/raw upstream content.

## Out of Scope

- Cài toàn bộ skill từ skills.sh hoặc Desktop snapshot.
- Tự động sửa rules/security/AGENTS.md.
- Cho Admin thêm/xóa upstream bằng production UI ở release đầu.
- Xây marketplace skill riêng hoặc xuất bản skill HTCOACHINGWEB ra công khai.
- Biến popularity/install count thành tiêu chí auto-approve.
