# HTCOACHINGWEB — CODEX PROJECT INSTRUCTIONS

## Phạm vi và giao tiếp

- Áp dụng cho toàn bộ repository. `AGENTS.md` hoặc `AGENTS.override.md` nằm gần file đang sửa hơn được ưu tiên cho subtree đó.
- Giao tiếp, giải thích và báo cáo bằng Tiếng Việt; giữ tên code, API và lệnh bằng ngôn ngữ gốc.
- Làm việc như full-stack developer partner: ngắn gọn, rõ ràng, có bằng chứng; không che giấu giả định hoặc lỗi.
- Nếu thiếu thông tin nhưng có thể suy luận an toàn từ code, hãy kiểm tra code rồi tiếp tục. Chỉ hỏi khi lựa chọn làm thay đổi đáng kể hành vi, dữ liệu, bảo mật hoặc phạm vi.

## Cách làm việc

1. Đánh giá task là `SIMPLE`, `MODERATE` hoặc `COMPLEX` theo `.agents/rules/workflow/task-orchestration.md` trước khi hành động.
2. Đọc file liên quan và trạng thái Git trước khi sửa. Không đoán schema, route, API response hoặc convention.
3. Với task nhiều bước, nêu plan có tiêu chí kiểm chứng và cập nhật plan khi thực hiện.
4. Task dễ do root agent tự xử lý. Task phức tạp chỉ giao các workstream độc lập cho subagents khi môi trường cho phép; root agent giữ vai trò lập plan, tích hợp, review chéo, verification và báo cáo cuối.
5. Không để nhiều agents sửa cùng file; mỗi subagent phải có file ownership, phạm vi cấm sửa và verification riêng.
6. Chỉ thay đổi phần cần thiết; giữ style hiện có; không refactor, format hoặc xóa dead code ngoài phạm vi.
7. Dọn import/biến/code thừa chỉ khi chính thay đổi hiện tại tạo ra chúng.
8. Tự đọc lỗi, xác định root cause, sửa và chạy lại tối đa 3 vòng trước khi báo blocker.
9. Trước khi bàn giao, chạy kiểm tra tương xứng với rủi ro và báo rõ file, logic, side effect, kiểm tra đã chạy.

## An toàn Git và dữ liệu

- Chỉ dùng Git read-only (`git status`, `git diff`, `git log`) trừ khi user yêu cầu rõ thao tác khác.
- Không tự chạy `git pull`, `git checkout`, `git merge`, `git rebase`, `git reset`, commit hoặc push.
- Không xóa file backup/dead code có sẵn nếu user không yêu cầu.
- Không chạy migration, seed, cleanup staging, script production, hoặc thao tác ghi dữ liệu thật khi chưa có yêu cầu và xác nhận target.
- Không in hoặc commit secret, token, cookie, nội dung `.env`; không hardcode credential.

## Kiến trúc chính

- `client/`: React 19 SPA, Vite 8, React Router 7, Tailwind CSS 4, TanStack Query 5, React Hook Form + Zod.
- `server/`: Express 5 API, Mongoose 9/MongoDB, JWT trong httpOnly cookies, CSRF, Passport Google OAuth.
- Luồng chuẩn: route → controller → service → model. Frontend gọi API qua `client/src/services/` và axios instance hiện có.
- Deploy: frontend Netlify, backend Render. Node version chuẩn lấy từ `.node-version`, `.nvmrc`, và `package.json`.
- Tài liệu kiến trúc, roles, naming, SEO, testing và known issues chi tiết: `.agents/reference/project-guide.md`. Chỉ đọc các section liên quan khi cần thêm context.

## Luật code bắt buộc

### Frontend

- Lazy-load mọi page route bằng `lazy(() => import(...))`; không import page trực tiếp vào router.
- Đặt API calls trong `client/src/services/*.service.js`; component/page chỉ gọi service.
- Dùng TanStack Query cho server state; Context chỉ dùng cho auth nếu không có yêu cầu kiến trúc mới.
- Dùng Tailwind classes; tránh inline style và thao tác DOM trực tiếp khi React state/ref giải quyết được.
- Dùng Lucide React cho icon mới và tuân theo UI skill khi sửa giao diện.
- Page public mới phải có SEO component, metadata phù hợp, internal links, sitemap và prerender entry khi cần.

### Backend

- Giữ MVC/service layering: routes khai báo endpoint + middleware; controllers xử lý HTTP; services chứa business logic; models chứa schema.
- Validation server đặt theo pattern hiện có trong `server/src/middlewares/validation.js`; kiểm tra model thật trước khi dùng field.
- Mỗi loại upload có middleware riêng và phải validate type/size.
- Endpoint user-accessible truy cập object theo ID phải có ownership/IDOR check; role phải được kiểm tra ở backend.
- Security-critical logging dùng `safeLog`; không log raw error có thể chứa PII.
- Dữ liệu sức khỏe, định danh, token, cookie và nội dung hội thoại là dữ liệu nhạy cảm; chỉ lấy field cần thiết, không log raw payload và phải kiểm tra ownership ở backend.

### Bảo mật nhạy cảm

- Thay đổi Auth, CSRF, JWT, Payment hoặc Wallet: phân tích ảnh hưởng trước khi sửa và đọc `.agents/rules/security/security.md`.
- Không disable CSRF/rate limit, không đổi JWT cookie khỏi httpOnly, không hạ timing-safe token comparison.
- Mutating request phải đi qua cơ chế CSRF hiện có. Không sửa `client/src/utils/api.js` nếu chưa xác định lý do và impact.
- Khi thêm external domain, kiểm tra Helmet CSP whitelist.
- Thay đổi Mongoose schema phải trace controllers, services, routes, validation, indexes, migration/backfill và backward compatibility; dùng skill `schema-change`.

## SEO

- Khi sửa public route, meta tag, sitemap hoặc prerender, đọc `.agents/rules/seo/seo.md` và kiểm tra cả `client/scripts/generate-sitemap.js` lẫn `client/scripts/prerender.js`.
- Không tạo orphan public page; bổ sung internal links tự nhiên tới ít nhất hai public page liên quan khi phù hợp.
- Slug public dùng kebab-case, ưu tiên tiếng Việt không dấu theo convention hiện có.

## Known issues không tự ý sửa

- `client/src/pages/admin/TrainerManagement.old.jsx`: file backup; không xóa.
- Các inline imports trong `server/server.js`: giữ nguyên nếu không trực tiếp thuộc task.
- Các file UI lớn và `server/src/middlewares/validation.js`: chỉ sửa đúng phần cần thiết, không tiện tay refactor.
- Chi tiết mới nhất nằm trong skill `known-issues` và `.agents/reference/project-guide.md`.

## Verification

Chọn tập kiểm tra nhỏ nhất đủ chứng minh thay đổi; mở rộng khi rủi ro cao:

- Client unit: `npm run test:unit:client`
- Server unit/integration: `npm run test:unit:server`
- Tất cả unit: `npm run test:unit`
- E2E: `npm run test:e2e` (cần môi trường/dev servers phù hợp)
- Client lint: `npm run lint --prefix client`
- Client build: `npm run build --prefix client`
- Secret scan: `npm run security:secrets`
- Repository boundary scan: `npm run security:data-boundaries`
- Agent instructions: `npm run agents:validate`

Không tuyên bố pass nếu lệnh chưa chạy hoặc bị phụ thuộc môi trường. Với API change, kiểm tra response format và error contract; với UI change, kiểm tra loading/empty/error/disabled states và accessibility cơ bản.

## Rules và Codex skills

Rules chi tiết được giữ trong `.agents/rules/`:

- Task orchestration: `.agents/rules/workflow/task-orchestration.md`
- Code patterns: `.agents/rules/code/tech_patterns.md`
- Anti-patterns: `.agents/rules/code/anti_patterns.md`
- Security: `.agents/rules/security/security.md`
- SEO: `.agents/rules/seo/seo.md`

Thứ tự nguồn canonical để tránh instruction drift:

1. `AGENTS.md`: quyền hạn, safety và routing bắt buộc.
2. `.agents/rules/`: policy canonical theo domain; skill phải link tới rule thay vì chép lại.
3. `.agents/reference/project-guide.md`: kiến trúc và file map, không phải nguồn policy.
4. `.agents/skills/`: workflow thực thi, không hardcode số liệu có thể đếm từ repo.
5. `docs/specs/` và `docs/operations/`: nghiệp vụ và runbook canonical.

Codex tự phát hiện skill từ `.agents/skills/<skill-name>/SKILL.md`. Khi task khớp description hoặc user gọi `$skill-name`, phải đọc toàn bộ `SKILL.md` trước khi hành động. Ưu tiên các skill sau:

- Quy trình: `feature-spec`, `plan-template`, `debugging`, `cleanup-delivery`, `tdd-guide`.
- Chất lượng/tham khảo: `audit-playbook`, `ui-quality`, `known-issues`, `pdf-generation`, `ai-chat-system`.
- Workflow chuyển thành skill: `audit`, `ship`, `seo-check`, `new-page`, `schema-change`, `ui-check`, `pre-deploy`, `qa`, `ai-check`, `new-tool`, `goad`.

Các tên `/audit`, `/ship` cũ không phải slash command native của Codex. Dùng `$audit`, `$ship`, ... hoặc mô tả yêu cầu bằng ngôn ngữ tự nhiên.

## Điều kiện hoàn thành

- Không còn debug log, commented-out code mới, unused import hoặc hardcoded secret do thay đổi tạo ra.
- Không tạo breaking change ngoài yêu cầu; file mới nên dưới 300 dòng, nếu vượt phải có lý do hoặc tách module.
- Báo cáo cuối nêu: kết quả, files chính, validation đã chạy, phần chưa chạy/blocker và side effect nếu có.
