# Upstream Skill Radar

## Objective

Xây dựng một hệ thống theo dõi có kiểm soát cho các Agent Skill chất lượng cao từ
[skills.sh](https://www.skills.sh/), phát hiện thay đổi upstream theo tháng và giúp maintainer quyết định
`adopt`, `adapt`, `reject` hoặc `defer` trước khi cập nhật skill/rule canonical của HTCOACHINGWEB.

Hệ thống gồm hai bề mặt liên kết với nhau:

1. `$skill-radar` và scanner repo-native phục vụ engineering governance.
2. Trang Admin **Radar công nghệ** hiển thị watchlist, drift, audit, lịch kiểm tra kế tiếp và cho Admin thêm
   GitHub repository/skill qua luồng phân tích trước khi lưu.

## Assumptions

1. `skills.sh` là nguồn discovery/ranking/audit chính, nhưng không phải nguồn chân lý duy nhất; GitHub repository
   và nội dung skill thực tế vẫn phải được kiểm tra.
2. Admin dashboard chỉ dành cho role `admin`; không mở cho Trainer/User và không cần SEO.
3. Watchlist versioned trong repo vẫn là baseline canonical. Nguồn do Admin thêm được lưu riêng trong MongoDB và hợp
   nhất ở read model; không ghi ngược vào filesystem của Render hoặc làm thay đổi Git history.
4. Release này thêm collection `SkillRadarSource` cho nguồn động. Không backfill 23 nguồn baseline và không cần
   migration dữ liệu; document cũ không bị ảnh hưởng.
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

## Approved additions — 2026-08-11

| # | Domain | Upstream skill | Source | Local targets chính | Decision |
|---:|---|---|---|---|---|
| 21 | Motion design | `emil-design-eng` | `emilkowalski/skills` | `ui-quality`, motion guidance | `adapt` — lấy decision/purpose/accessibility rules, giữ stack hiện tại. |
| 22 | Motion audit | `review-animations` | `emilkowalski/skills` | `ui-check` | `adapt` — review focused, không copy nguyên workflow. |
| 23 | Motion planning | `improve-animations` | `emilkowalski/skills` | `ui-check`, `plan-template` | `adapt` — inventory/prioritization, không auto-edit hoặc bulk rewrite. |

TencentDB Agent Memory không phải skill workflow thuần nên vẫn là technology entry canonical trong
`docs/architecture/ai-technology-radar.md`; read model Admin có thể hợp nhất nó dưới `sourceType=repository` để một bảng
hiển thị chung, nhưng không được biến nó thành Agent Skill hoặc làm trùng quyết định kiến trúc.

## Admin-added GitHub Sources

### Luồng thêm nguồn

1. Admin dán một GitHub repository URL. Release đầu chỉ nhận đúng dạng
   `https://github.com/{owner}/{repo}`; backend bỏ `.git`, query (ví dụ `fbclid`) và fragment rồi trả URL canonical.
2. Admin chọn **Phân tích**. Backend đọc GitHub metadata/README theo allowlist, timeout và response-size cap; không clone,
   cài dependency, chạy code hoặc coi nội dung third-party là instruction.
3. Backend trả preview cho các trường đang hiển thị trên bảng: loại nguồn (`skill`/`repository`), tên, lĩnh vực, tóm tắt,
   local targets dự kiến, lifecycle/drift, upstream update/review và lần quét dự kiến.
4. Admin được chỉnh các trường có tính phán đoán (`sourceType`, `domain`, `summary`, `localTargets`, `lifecycle`) rồi xác
   nhận lưu. Hàng mới xuất hiện ngay trong bảng sau response thành công.

### Phân loại deterministic

- `sourceType = skill` khi repository có tín hiệu Agent Skill rõ ràng như `SKILL.md`/topic liên quan; ngược lại là
  `repository`. TencentDB Agent Memory phải được nhận là `repository`, lĩnh vực AI Memory.
- `domain` và `localTargets` là đề xuất từ description/topics/README theo taxonomy local; khi không đủ confidence dùng
  `Công nghệ khác` và `Cần review local`, không bịa target cụ thể.
- Nguồn mới có `lifecycle = candidate`, `drift = review_due`, `decision = pending`; `lastReviewedAt` để trống cho đến khi
  con người review semantic. Metadata GitHub quan sát được vẫn được lưu làm baseline.
- Chống trùng bằng canonical URL/source key ở cả baseline file và collection động; duplicate trả `409`.

### Persistence contract

- `SkillRadarSource` lưu metadata allowlisted, snapshot gần nhất, `createdBy` và tham chiếu audit append-only; không lưu raw
  README, raw GitHub response, token hoặc query tracking từ URL nhập. Audit được ghi `failed` trước mutation và chỉ chuyển
  `succeeded` sau khi source đã lưu; document Radar giữ `auditLogId` để tránh nguồn được lưu mà không có audit tương ứng.
- Canonical repository key dùng `_id` unique mặc định. Index `skill_radar_refresh_due` phục vụ scheduler có migration
  preflight/apply được khóa target; không backfill document và không tự chạy migration khi deploy.
- Read API hợp nhất baseline file với nguồn động; baseline giữ nguyên để scanner repo-native và lịch sử audit tiếp tục chạy.

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
- Scanner deterministic kiểm tra 23 nguồn active hiện tại, content hash, commit theo source path, repository state và URL health.
- GitHub API `403/429` được ghi `rate_limited`, giữ last-known-good provenance và không suy diễn repository đã chết.
- Scanner/API phải đọc `X-RateLimit-Reset` hoặc `Retry-After` khi có, lưu `rateLimitRetryAt`, dừng các request GitHub mới
  trong batch khi quota đã cạn và hiển thị thời điểm thử lại. Thiếu header thì dùng lần quét lịch kế tiếp.
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

### Form thêm nguồn

- Form đặt trước bộ lọc, gồm URL và preview/chỉnh sửa cho đúng các cột: Skill/repository, Lĩnh vực, Ảnh hưởng local,
  Cập nhật/review, Trạng thái và Lần quét dự kiến.
- Có trạng thái đang phân tích, lỗi URL/GitHub, rate limit + thời điểm thử lại, duplicate, đang lưu và thông báo thành công.
- Không gọi GitHub trực tiếp từ browser. Mutation đi qua service layer, TanStack Query và invalidate/cập nhật read-model cache.

## Security and Operations Boundaries

- Route API bắt buộc `protect` + `requireRoles("admin")`.
- Backend chỉ trả allowlisted metadata; không trả raw third-party content hoặc filesystem paths tuyệt đối.
- Endpoint preview/lưu là mutation Admin-only, bắt buộc `protect` + `requireRoles("admin")` + CSRF + validation và limiter
  riêng. Chỉ endpoint preview/lưu được gọi GitHub server-side; GET dashboard vẫn đọc snapshot/DB local.
- Contract canonical: `POST /api/admin/skill-radar/preview` nhận `{ sourceUrl }`; `POST /api/admin/skill-radar/sources`
  nhận `{ sourceUrl, sourceType, name, domain, summary, localTargets, lifecycle }`. Khi lưu, backend phân tích GitHub lại
  và chỉ tin metadata provider-side; metadata ẩn do browser gửi thêm bị validation từ chối.
- Network fetch chỉ cho `api.github.com`, có timeout, response-size cap và redirect/host guard. Runtime dùng riêng
  `SKILL_RADAR_GITHUB_TOKEN`; token chỉ cần quyền đọc public metadata/README và browser không bao giờ nhận token.
- Security warning, license conflict hoặc repository owner change phải buộc manual review.
- Không auto-install, auto-merge, auto-commit hoặc auto-deploy. Ghi production chỉ là document nguồn đã được Admin xác nhận.

## Success Criteria

- Giữ nguyên provenance của 23 upstream skill baseline; mọi addition phải có canonical GitHub URL, loại nguồn, license,
  local targets và decision review.
- Scanner phát hiện content hash thay đổi và tạo snapshot/report deterministic mà không sửa local skill.
- Lịch tháng có thể chạy tự động và thủ công; failure không làm CI/release chính thất bại.
- `$skill-radar` và `$goad` có ranh giới rõ, validator bao phủ skill mới.
- Admin dán URL TencentDB Agent Memory, nhận preview repository/AI Memory, chỉnh được đề xuất, lưu và thấy hàng mới ngay.
- `seo-audit` rate limit giữ hash/commit gần nhất, hiển thị retry time và không bị gắn `unreachable`.
- Có Mongoose schema riêng cho nguồn động nhưng không migration/backfill; không lộ secret/raw upstream content.

## Out of Scope

- Cài toàn bộ skill từ skills.sh hoặc Desktop snapshot.
- Tự động sửa rules/security/AGENTS.md.
- Xóa/sửa nguồn động sau khi đã lưu; release này chỉ thêm mới để giữ mutation scope nhỏ.
- Xây marketplace skill riêng hoặc xuất bản skill HTCOACHINGWEB ra công khai.
- Biến popularity/install count thành tiêu chí auto-approve.
