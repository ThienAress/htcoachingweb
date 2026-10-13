# Audit sức khỏe codebase sau khi chuyển từ Codex sang Claude Code — 2026-10-13

- **Target**: `main` @ `98babb4` (sau merge PR #258, #259).
- **Phạm vi**: bảo mật backend (CSRF, auth, IDOR, mass assignment, injection/ReDoS, SSRF, webhook, OAuth redirect,
  upload, rò rỉ lỗi), XSS và lưu trữ phía client, dependency, code rác/dead code, chất lượng UI, test/lint, môi trường dev.
- **Phương pháp**: quét tĩnh có script + đọc tay từng ứng viên; scan sẵn có của repo; kết quả CI trên Node 22.
- **Ngoài phạm vi**: pen test động, cấu hình production (Render/Netlify/Atlas), dữ liệu thật, scan trả phí.
  Ownership ở tầng service của từng module sức khỏe/coaching được dựa vào bộ authorization integration test hiện có,
  chưa trace tay toàn bộ.

## Kết luận

**Không phát hiện lỗi P0 hoặc P1.** Các lớp bảo vệ quan trọng đã đúng: mọi route ghi dữ liệu có CSRF + auth,
không thấy IDOR, webhook SePay ký HMAC + chống replay + idempotency, SSRF có allowlist, XSS qua DOMPurify,
0 lỗ hổng dependency high/critical. Còn 5 việc P2 nên sửa và một số việc dọn dẹp P3.

## P2 — nên sửa sớm

### P2-1. Regex tìm kiếm không escape ở endpoint công khai (ReDoS / lỗi 500)

Chuỗi `search` từ người dùng đi thẳng vào `$regex` MongoDB:

| Vị trí | Ai gọi được |
|---|---|
| `server/src/controllers/food.controller.js` (`getFoods`) | Public `GET /api/foods?search=` |
| `server/src/controllers/gym.controller.js` (`getGyms`) | Public `GET /api/gyms?search=` |
| `server/src/services/ai/tools/getGymInfo.tool.js` (`district`, tối đa 100 ký tự) | HT Assistant, kể cả khách |
| `trainer.controller.js` (`getAdminTrainers`), `user.controller.js`, `contact.controller.js`, `customerStory.controller.js` (`getAdminCustomerStories`) | Admin |

Tác động: pattern kiểu `(a+)+$` làm MongoDB tốn CPU; regex sai cú pháp gây 500 (kèm `err.message`, xem P2-3).
Rate limit toàn cục production (300 req/15 phút/IP) giảm nhưng không loại bỏ rủi ro.
Sửa: dùng `escapeRegex()` đã có trong `server/src/utils/escapeRegex.js` + giới hạn độ dài như các controller
`exercise`, `blog`, `recipe` đang làm.

### P2-2. `GET /api/foods` không giới hạn kích thước trả về

`?all=true` hoặc `?limit=` tùy ý trả toàn bộ catalog kèm tính giá thị trường (`withMarketPrices`) cho mỗi request;
`page` âm tạo `skip` âm → lỗi 500. Sửa: chặn trần `limit` (ví dụ 100), validate `page ≥ 1`,
chỉ cho `all=true` với admin nếu thực sự cần.

### P2-3. ~80 chỗ trả nguyên `err.message` cho client, bỏ qua error handler an toàn

`server/src/middlewares/errorHandler.js` đã ẩn chi tiết lỗi khi production, nhưng nhiều controller tự trả
`res.status(500).json({ message: error.message })`. Nhiều nhất: `contract.controller.js` (13), `recipe.controller.js` (12),
`gym`, `food`, `exercise` (7 mỗi file), `f1AiRule` (5). Lỗi nội bộ Mongo/GridFS/provider có thể lộ ra ngoài.
Sửa: với lỗi không chủ đích trả thông điệp chung hoặc `next(error)`; chỉ trả message của lỗi nghiệp vụ có `statusCode`.

### P2-4. Accessibility (từ `npm run ui:audit`)

- 78 nút chỉ có icon thiếu tên cho trình đọc màn hình (`icon-button-accessible-name`).
- 13 ô nhập thông tin cá nhân thiếu `autocomplete` (`personal-input-autocomplete`).
- 9 chỗ tắt viền focus bàn phím (`focus-visible-not-suppressed`).

Gate hiện vẫn PASS vì đây là nợ cũ nằm trong baseline (0 lỗi mới, 36 lỗi đã được sửa so với baseline).

### P2-5. Môi trường dev local lệch chuẩn — không chạy được test server tại máy

- Máy đang dùng Node `24.15.0`; repo yêu cầu `22.23.1` (`.node-version`) và runner test server từ chối chạy.
  Cài `nvm-windows` hoặc `fnm` rồi dùng 22.23.1.
- npm cache cấu hình tại thư mục `codex-cache` do Codex đặt; `npx vitest` có lúc lấy vitest từ cache này thay vì
  `client/node_modules`. Đặt lại: `npm config delete cache`.
- Dev server (Vite, nodemon, Mongo local) đang chạy từ checkout gốc trong lúc checkout chuyển sang `main`:
  cần khởi động lại để chạy đúng code mới.

## P3 — dọn dẹp, gia cố

1. **Mass assignment ở route admin**: `f1AiRule.controller.js` (`...req.body`, `Object.assign(rule, req.body)`),
   `gym.controller.js` `updateGym` (`{ ...req.body }`) không có allowlist/validation. Chỉ admin gọi được,
   nhưng có thể ghi đè field hệ thống (`createdBy`, `_id`...). Thêm allowlist + validator.
2. **Dead code (~14 file, ~1.180 dòng, không nơi nào import)**: `client/src/components/BlogContentPreview.jsx`,
   `components/ChatWidget/ChatWidget.jsx` (đã thay bằng `DeferredChatPanel`, chỉ còn test tham chiếu),
   `components/F1/F1ForecastPanel.jsx`, `hooks/useGsap.js`, `pages/ExercisesPage/ExerciseListModal.jsx`,
   `pages/ExercisesPage/ExerciseSuggestionBox.jsx`, `pages/progress/CoachingActivityPanel.jsx`,
   `pages/progress/WeightTrendChart.jsx`, `sections/class/ParallaxCard.jsx`, `services/auth.service.js`,
   `utils/csrf.js`; `server/src/controllers/f1Customer/media.helpers.js`,
   `server/src/services/bodyAssessmentRetention.service.js`, `server/src/utils/mealdbAdapter.js`.
   Xác nhận lại trước khi xoá.
3. **File quá lớn**: `server/src/controllers/ai.controller.js` 3.112 dòng (rủi ro sửa cao nhất repo);
   `knowledgePrivacy.js` 1.797; `knowledgeBase.controller.js` 1.525.
4. **Workout plan**: bản ghi cũ thiếu `clientId` cấp quyền xem theo email trùng khớp; nên backfill `clientId`
   rồi bỏ fallback theo email (CONTEXT.md khuyến cáo không liên kết dữ liệu bằng email).
5. **Riêng tư phía client**: `TdeeCalculator.jsx` lưu `tdeeForm` (cân nặng, chiều cao, tuổi) vào `localStorage`;
   cân nhắc `sessionStorage` hoặc không lưu.
6. **Gemini API key nằm trên URL** (`?key=`) ở `knowledgeBase.controller.js` (AI suggest); chuyển sang header
   `x-goog-api-key`.
7. **`recipeUpload.js` không có `fileFilter`** ở tầng multer (Cloudinary `allowed_formats` vẫn chặn; route admin).
8. **UI debt**: 194 `transition-all`, 14 z-index cực lớn.
9. **Dấu vết Codex còn lại**: workflow `incident-remediation.yml` vẫn chạy `openai/codex-action` với secret
   `OPENAI_API_KEY`; `scripts/codex-security-scan.mjs` + runbook; `.gitignore` còn `.codex-worktrees/`.
   Quyết định giữ (nếu vẫn trả phí OpenAI cho CI) hay chuyển sang Claude/bỏ.
10. **Cấu hình Claude**: skill `ai-chat-system` mô tả `ChatWidget.jsx` là widget chính — thực tế là
    `DeferredChatPanel.jsx`; cập nhật lại sơ đồ.

## Đã kiểm và ổn (không phải finding)

| Hạng mục | Bằng chứng |
|---|---|
| CSRF + auth trên mọi route ghi dữ liệu | Script quét toàn bộ `server/src/routes`; ngoại lệ có chủ đích: webhook SePay (HMAC), `/api/ops` telemetry (rate limit), `/auth/refresh`/`logout` (CSRF) |
| IDOR | `findById`/`findOne`/`updateOne`/`deleteOne` theo `req.params` ngoài admin: workout plan có kiểm owner; hội thoại AI lọc `userId`; KB/F1 rule sau `requireRoles("admin")` |
| Webhook SePay | HMAC trên raw body, timestamp ±300 giây, `timingSafeEqual`, idempotency key khi cộng ví |
| SSRF | F1 media: allowlist host + https + `redirect: "error"` + timeout + giới hạn dung lượng; provenance: chỉ đọc header redirect |
| XSS | Mọi `dangerouslySetInnerHTML` qua `DOMPurify`, trừ chuỗi i18n tĩnh |
| OAuth redirect | `clientUrl` chỉ nhận giá trị trong allowlist |
| Secret fallback | Khóa HMAC ẩn danh hóa; production bắt buộc `LOG_HASH_SECRET` ≥ 32 ký tự (`productionReadiness.js`) |
| AI chat / Meal Scan | CSRF + limiter khách + limiter chung + quota theo gói |
| Dependency | `security:audit` client/server: 0 high/critical |
| Code rác | 0 `console.log`/`debugger` runtime, 0 TODO/FIXME, không có file backup |

## Lệnh kiểm chứng

| Lệnh | Kết quả |
|---|---|
| CI `main` @ `98babb4` (Node 22) | 5/5 job PASS — server 354 file / 4.061 test, client 188 file, e2e 123 test |
| `vitest run` client (local) | 188 file / 952 test PASS |
| `npm run lint --prefix client` | PASS |
| `npm run ui:audit -- --baseline ... --fail-on-new-high` | PASS (0 mới, 36 đã sửa; 359 nợ cũ) |
| `npm run security:audit --prefix client` / `server` | PASS |
| `npm run security:secrets`, `security:data-boundaries`, `security:docs-privacy` | PASS |
| `npm run agents:validate` | PASS |
| Test server local | NOT RUN — runner yêu cầu Node 22.23.1, máy có Node 24 (dùng CI làm bằng chứng) |
| `npm run build --prefix client` local | NOT VERIFIED — thiếu `VITE_API_URL` trong môi trường audit nên prerender trang động bị bỏ qua; job `client` trên CI build PASS |

## Việc đã làm trong phiên (ngoài audit)

- Merge PR #258 (chuyển cấu hình sang Claude Code) và #259 (đồng bộ tài liệu local).
- Lưu toàn bộ thay đổi chưa commit của checkout cũ vào branch local `backup/local-wip-20261013` (không push),
  chuyển checkout gốc sang `main`.
- Gỡ file khóa kẹt `.git/index.lock` từ 2026-10-02 (không có tiến trình git nào giữ).

## Kết quả xử lý (PR gia cố P2/P3, 2026-10-13)

| Mục | Quyết định | Chi tiết |
|---|---|---|
| P2-1 Regex không escape | **Đã sửa** | `escapeRegex()` cho `food`, `gym`, `trainer`, `user`, `contact`, `customerStory` và AI tool `getGymInfo`; test `food.listHardening.integration.test.js`. |
| P2-2 `/api/foods` không giới hạn | **Đã sửa một phần có chủ đích** | Trần `limit` 100, `page` không hợp lệ về 1. **Giữ `?all=true`** vì Meal Plan công khai cần cả catalog (`coaching.queries.js` → `getAllFoods`). |
| P2-3 Lộ `err.message` | **Đã sửa** | 46 nhánh lỗi 500 gọi `errorHandler(err, req, res)` (log + ẩn chi tiết ở production + map ValidationError/duplicate key); `order.approve` ẩn message khi ≥500. Lỗi nghiệp vụ có `statusCode`/`code` giữ thông điệp. |
| P2-4 Accessibility | **Đã sửa** | 94 chỗ trong 39 file: nhãn nút icon (qua `common:a11y.*` ở màn hình đa ngôn ngữ), `autoComplete` (`off` khi admin/HLV nhập dữ liệu người khác), viền focus. Còn 4 cảnh báo focus là báo động giả (khung bao đã có `focus-within`). Baseline `ui:audit` siết từ 359 xuống 257. |
| P2-5 Môi trường dev | **Hướng dẫn, không đổi cấu hình** | Cần Node 22.23.1 (cài `fnm`/`nvm-windows`). **Giữ** npm cache ở thư mục `codex-cache` trên ổ D vì xoá cấu hình sẽ đưa cache về ổ C; lỗi `npx vitest` thực chất do `client/node_modules` cài thiếu khi dev server khóa file. |
| P3-1 Mass assignment admin | **Đã sửa** | Allowlist field cho F1 AI rule và gym; phát hiện thêm bug `createdBy`/`updatedBy` luôn rỗng do dùng `req.user._id` (đã sửa thành `req.user.id`); test `adminFieldAllowlist.integration.test.js`. |
| P3-2 Dead code | **Đã xoá 13 file** | Giữ `bodyAssessmentRetention.service.js`: phần chuẩn bị cho chính sách lưu giữ dữ liệu sức khỏe, xoá cần quyết định nghiệp vụ/spec. |
| P3-3 `ai.controller.js` 3.112 dòng | **Hoãn** | Tách file lõi chat là refactor rủi ro cao; cần plan riêng có test hành vi trước khi chia. |
| P3-4 Workout plan fallback email | **Hoãn** | Bỏ fallback cần backfill `clientId` trên production trước; nếu bỏ ngay sẽ khóa quyền xem giáo án cũ. |
| P3-5 TDEE trong `localStorage` | **Giữ nguyên** | Là tính năng: Meal Plan đọc lại kết quả TDEE qua `useMacroSet` giữa các tab/lần truy cập; dữ liệu chỉ ở máy người dùng và có nút làm lại để xoá. |
| P3-6 API key trên URL | **Đã sửa (mở rộng)** | Cả 5 lời gọi Gemini chuyển sang header `x-goog-api-key`; USDA FDC chuyển sang `X-Api-Key`. |
| P3-7 `recipeUpload` thiếu `fileFilter` | **Đã sửa** | Chặn file không phải ảnh jpg/jpeg/png/webp trước khi upload Cloudinary. |
| P3-8 `transition-all` / z-index | **Hoãn** | Đổi hàng loạt dễ làm hỏng animation/stacking mà test không bắt được; baseline đã chặn phát sinh mới, sửa dần theo màn hình. |
| P3-9 Dấu vết Codex | **Gỡ một phần** | Gỡ `scripts/codex-security-scan.*`, runbook và `npm run security:codex`. **Giữ** workflow `incident-remediation.yml` (Codex action) vì được watchdog production gọi; chuyển sang Claude cần thêm secret `ANTHROPIC_API_KEY` và thử end-to-end. |
| P3-10 Skill `ai-chat-system` | **Đã sửa** | Sơ đồ trỏ đúng `DeferredChatPanel.jsx`. |
