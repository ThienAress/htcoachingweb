# HTCOACHINGWEB

Nền tảng coaching thể hình: website public (SEO), workspace HLV/admin, công cụ số cho học viên
(HT Assistant, Meal Scan, Meal Plan, TDEE, thư viện bài tập, theo dõi tiến trình), ví và hợp đồng.

## Giao tiếp

- Trả lời bằng tiếng Việt; giữ nguyên tên code, API và lệnh.
- Ngắn gọn, có bằng chứng; nói rõ giả định và những gì chưa kiểm chứng.
- Thiếu thông tin nhưng tra được trong repo thì tự tra rồi làm tiếp. Chỉ hỏi khi lựa chọn làm đổi đáng kể
  hành vi, dữ liệu, bảo mật hoặc phạm vi.

## An toàn Git và dữ liệu

- Git chỉ dùng read-only (`status`, `diff`, `log`) trừ khi user yêu cầu rõ. Không tự commit, push, pull,
  merge, rebase, reset hay checkout.
- Không chạy migration, seed, cleanup staging, script production hoặc ghi dữ liệu thật khi chưa có yêu cầu
  và chưa xác nhận đúng target.
- Không đọc, in hoặc commit `.env`, secret, token, cookie; không hardcode credential.
- Không xóa file backup hoặc dead code có sẵn nếu user không yêu cầu.

## Kiến trúc

- `client/`: React 19 SPA, Vite 8, React Router 7, Tailwind CSS 4, TanStack Query 5, React Hook Form + Zod.
- `server/`: Express 5, Mongoose 9/MongoDB, JWT trong httpOnly cookie + CSRF, Passport Google OAuth.
- `e2e/` Playwright · `workers/` Cloudflare watchdog · `scripts/` release/ops/security gates · `docs/` tài liệu.
- Luồng backend: route → controller → service → model. Frontend gọi API qua `client/src/services/*.service.js`
  và axios instance `client/src/utils/api.js`.
- HT Assistant nằm ở `server/src/services/ai/` (provider deepseek/gemini/mock) và `client/src/components/ChatWidget/`.
- Deploy: frontend Netlify, backend Render (Docker, `server/Dockerfile`). Node version lấy từ `.node-version`.
- Từ vựng nghiệp vụ canonical: `CONTEXT.md` (User vs Coaching Customer, Trainer, Effective Coach,
  HT Fitness+ Member...). Đọc khi chạm role, quyền, entitlement hoặc dữ liệu coaching.
- Quyết định kiến trúc bền: `docs/architecture/adr/`. Chỉ viết ADR khi quyết định khó đảo ngược, sẽ gây bất ngờ
  nếu thiếu context và có trade-off thật giữa ít nhất hai phương án.
- Taxonomy tài liệu: `docs/README.md`. Spec ở `docs/specs/`, plan ở `docs/plans/` (máy đọc qua `plan-state.json`).

## Bất biến bảo mật

Luôn đúng ở mọi thay đổi; chi tiết nằm trong `.claude/rules/security.md`.

- Không tắt hoặc nới CSRF, rate limit; JWT cookie luôn httpOnly; giữ so sánh token timing-safe.
- Role và ownership kiểm ở backend. Endpoint user-accessible lấy object theo ID phải có ownership/IDOR check.
- Không spread `req.body` vào Mongoose; validate input ở server theo pattern `server/src/middlewares/validation.js`.
- Dữ liệu sức khỏe, định danh, tài chính, hội thoại AI, token là dữ liệu nhạy cảm: chỉ lấy field cần dùng,
  log bằng `safeLog` với metadata allowlist, không log raw payload.
- Thêm external domain thì kiểm CORS và CSP trong `server/src/middlewares/securityHeaders.js`.
- Không sửa `client/src/utils/api.js` (CSRF + refresh interceptor) khi chưa rõ lý do và impact.
- Thay đổi Auth, CSRF, JWT, payment, wallet, schema hoặc AI tool có side effect: chạy skill `impact-check`
  trước khi sửa.

## Cách làm việc

- Chỉ sửa phần cần thiết, giữ style hiện có; không tiện tay refactor, format hay đổi quote style.
- File lớn đã biết (`client/src/pages/admin/KnowledgeBase.jsx`, `TrainerCoaching.jsx`, `sections/Pricing.jsx`,
  `server/src/middlewares/validation.js`...): chỉ sửa đúng đoạn cần, không tách file khi không được yêu cầu.
- File mới nên dưới 300 dòng; vượt thì phải có lý do hoặc tách module.
- Việc nhiều bước hoặc rủi ro cao: nêu plan kèm tiêu chí kiểm chứng trước khi sửa. Plan cần lưu lại
  thì dùng skill `plan-template`; feature mới chưa rõ hành vi thì dùng `feature-spec`.
- Báo cáo cuối gồm: kết quả, file chính, lệnh kiểm tra đã chạy và kết quả, phần chưa chạy, side effect.

## Kiểm chứng

Chọn tập nhỏ nhất đủ chứng minh thay đổi; mở rộng khi rủi ro cao.

| Mục đích | Lệnh |
|---|---|
| Client unit | `npm run test:unit:client` |
| Server unit/integration | `npm run test:unit:server` |
| Toàn bộ unit | `npm run test:unit` |
| E2E (cần dev servers) | `npm run test:e2e` |
| Lint client | `npm run lint --prefix client` |
| Release build client (sitemap + prerender + budget) | `npm run build --prefix client` |
| UI regression gate | `npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high` |
| Secret scan | `npm run security:secrets` |
| Repository boundary scan | `npm run security:data-boundaries` |
| Cấu hình Claude (CLAUDE.md, rules, skills) | `npm run agents:validate` |

- Không tuyên bố pass khi lệnh chưa chạy hoặc bị chặn bởi môi trường; nói rõ `NOT RUN`/`BLOCKED`.
- API change: kiểm response format `{ success, data | message }` và error contract.
- UI change: chạy UI regression gate, kiểm loading/empty/error/disabled và accessibility cơ bản.
- Không cập nhật baseline chỉ để CI xanh; đổi rule/baseline phải có test và lý do.

## Cấu hình Claude của repo

- `.claude/rules/`: luật theo đường dẫn, tự nạp khi chạm file khớp `paths`.
- `.claude/skills/`: quy trình theo nhu cầu. Chỉ chạy khi user gọi: `/release`, `/audit`,
  `/production-backup`, `/skill-radar`.
- `.claude/agents/security-reviewer.md`: reviewer bảo mật read-only cho thay đổi rủi ro cao.
- `.claude/settings.json`: permissions và hook chặn đọc/in secret.
- Rà lại cấu hình này sau mỗi đợt nâng model lớn hoặc 3–6 tháng: bỏ chỉ dẫn model đã tự làm tốt,
  giữ ràng buộc riêng của project.
