# Báo cáo Phase 3 - Product Workflows, Render và E2E

Ngày: 2026-07-19

## Kết quả

- Server unit/integration suite: **15 files, 82 tests passed**.
- Client unit suite: **5 files, 85 tests passed**.
- Playwright public E2E: **22/22 tests passed** trên Chromium.
- Client lint: **0 errors**, còn 48 warnings cũ về React hooks và unused
  eslint-disable.
- Production build và prerender: **thành công**, prerender đủ 20 routes.
- Node syntax checks và `git diff --check`: **passed**.
- Migration Phase 3 đã được tạo nhưng **chưa chạy trên database thật**.

## 1. AI Chat

- Thêm API fork conversation để retry/edit tạo nhánh hội thoại thật trên server,
  không sửa lịch sử cũ chỉ ở client.
- Mỗi stream có session ID và request UUID riêng; callback chỉ được cập nhật đúng
  conversation đã gửi request.
- Abort stream trước khi đổi conversation, tạo mới hoặc xóa conversation để tránh
  token từ request cũ chảy vào UI mới.
- Gom token stream theo nhịp 80 ms để giảm số lần React render khi model trả token
  nhanh.
- Khi stream hoàn tất hoặc bị hủy, client reconcile lại conversation từ server để
  tránh lệch state sau disconnect.
- Nén ảnh chat trước khi gửi, chỉ nhận JPEG/PNG/WebP và dùng stable message keys.
- Xóa toàn bộ React Query cache khi logout để dữ liệu tài khoản trước không xuất
  hiện trong session tiếp theo.

## 2. Knowledge Base

- Chuyển màn hình quản trị sang actor-scoped React Query keys, abort signal và
  mutation invalidation có chủ đích.
- Danh sách conversation có pagination thay vì tải toàn bộ.
- Hiển thị provenance/source, trạng thái publish và trạng thái embedding rõ ràng.
- Thêm thao tác regenerate embedding và khóa thao tác trong lúc mutation chạy.
- UI gửi version hiện tại để làm việc đúng với optimistic concurrency từ Phase 2.
- Các request đã hỗ trợ cancellation, giảm nguy cơ response cũ ghi đè màn hình sau
  khi người dùng chuyển filter hoặc entry.

## 3. Check-in

- Thêm endpoint `/orders/checkin-options` chỉ trả projection nhẹ cần cho form.
- Server kiểm tra trainer ownership, trạng thái order, session hợp lệ, giới hạn
  số bản ghi và escape nội dung tìm kiếm regex.
- Thêm compound index `trainerId + status + sessions` phục vụ truy vấn này.
- Client dùng debounced server search, actor-scoped query keys, abort signal và
  invalidate đúng cache sau check-in.
- Giới hạn độ dài notes ở UI, trong khi server vẫn là nơi thực thi giới hạn dữ liệu.

## 4. Coaching Content

- Trainer editor dùng local exercise ID ổn định thay cho array index.
- Toàn bộ nested plan/exercise update chuyển sang immutable update.
- Timeline/detail request có race guard; response cũ không thể thay selected date
  hoặc selected plan mới.
- Upload result giữ đúng plan/exercise ID tại thời điểm bắt đầu upload.
- Customer feedback gửi JSON DTO theo exercise ID, không dùng multipart khi không
  có file.
- Autosave timer tách riêng theo exercise và được cleanup khi unmount.
- Bỏ lần submit feedback bị lặp sau upload video.
- Khi thay hoặc xóa feedback video, server dọn Cloudinary asset cũ để tránh rác
  storage và dữ liệu tham chiếu không còn dùng.

## 5. Blog

- Thêm index cho danh sách popular và category-related posts.
- `sort=popular` sắp xếp thật theo views, không còn tái sử dụng danh sách mới nhất.
- Admin search được escape regex và các query string được giới hạn độ dài.
- Related posts ưu tiên cùng category và tag overlap, sau đó mới fallback theo
  views.
- Tăng views bằng atomic update và được await trước khi trả response.
- Client query hỗ trợ abort signal, stale time và dependency ổn định.

## 6. Recipe

- Recipe mới mặc định là draft: `isPublished: false`.
- Create/update chỉ nhận whitelist DTO và kiểm tra kiểu cho string, boolean, tags,
  ingredients, instructions và source.
- Tự sinh slug từ tên khi create; duplicate slug trả 409, payload sai trả 400.
- Public search tìm cả `name` và `nameEn`; category/area/tag/source/slug đều được
  giới hạn.
- Bookmark add/remove chuyển thành thao tác idempotent dựa trên cache theo user.
- Explorer đồng bộ search với URL, giữ dữ liệu cũ khi đổi trang, cancel request cũ
  và clamp page hợp lệ.
- Admin có đầy đủ create/edit form, trạng thái publish, ingredients, instructions,
  source và upload thumbnail sau khi record đã được tạo.

## 7. React Render và Bundle

- Chat stream batching giảm render theo từng token.
- Callback/message keys ổn định hơn trong Chat Bubble và Chat Panel.
- Các màn hình dữ liệu lớn dùng React Query cancellation và cache lifecycle thay
  vì effect request rời rạc.
- `ExercisesPage` chỉ dynamic-import `@react-pdf/renderer`, PDF document và
  `file-saver` khi người dùng export.
- Route chunk của Exercises giảm từ khoảng **1,579 kB** xuống **26.56 kB**
  (gzip từ khoảng **524.93 kB** xuống **7.58 kB**). PDF chunk lớn vẫn tồn tại nhưng
  không còn nằm trên đường tải trang thông thường.

## 8. E2E

- Homepage assertions chuyển từ copy tiếng Việt cố định sang locator semantic và
  chấp nhận nội dung i18n.
- Playwright có `webServer` tự khởi động Vite, health-check URL và tái sử dụng
  server đang chạy.
- Base URL thống nhất về `127.0.0.1`, tránh chênh lệch localhost/IPv6.
- Toàn bộ 22 public routing, navigation và SEO cases đã pass.

## Migration

Chỉ chạy sau khi backup và kiểm thử trên staging:

```bash
cd server
npm run migrate:phase3
```

Migration này:

- đặt các Recipe cũ thiếu `isPublished` thành draft;
- tạo hai Blog indexes cho popular và related-category queries;
- tạo Order index cho trainer check-in options.

**Migration chưa được chạy trong quá trình fix này.**

## File thay đổi trong Phase 3

### Client runtime

- `client/src/components/ChatWidget/ChatBubble.jsx`
- `client/src/components/ChatWidget/ChatPanel.jsx`
- `client/src/components/ChatWidget/ChatWidget.jsx`
- `client/src/context/AuthContext.jsx`
- `client/src/hooks/useAiChat.js`
- `client/src/pages/Blog.jsx`
- `client/src/pages/BlogDetail.jsx`
- `client/src/pages/ExercisesPage/ExercisesPage.jsx`
- `client/src/pages/RecipeExplorer/RecipeDetail.jsx`
- `client/src/pages/RecipeExplorer/RecipeExplorer.jsx`
- `client/src/pages/admin/Checkin.jsx`
- `client/src/pages/admin/KnowledgeBase.jsx`
- `client/src/pages/admin/RecipeEditModal.jsx`
- `client/src/pages/admin/RecipeManagement.jsx`
- `client/src/pages/customer/OnlineCoaching.jsx`
- `client/src/pages/trainer/TrainerCoaching.jsx`
- `client/src/services/ai.service.js`
- `client/src/services/blog.service.js`
- `client/src/services/checkin.service.js`
- `client/src/services/coaching.service.js`
- `client/src/services/knowledgeBase.service.js`
- `client/src/services/order.service.js`
- `client/src/services/recipe.service.js`
- `client/src/utils/compressChatImage.js`

### Server runtime

- `server/package.json`
- `server/src/controllers/ai.controller.js`
- `server/src/controllers/blog.controller.js`
- `server/src/controllers/coaching.controller.js`
- `server/src/controllers/order.controller.js`
- `server/src/controllers/recipe.controller.js`
- `server/src/models/BlogPost.js`
- `server/src/models/ChatConversation.js`
- `server/src/models/Order.js`
- `server/src/models/Recipe.js`
- `server/src/routes/ai.routes.js`
- `server/src/routes/order.routes.js`
- `server/src/migrations/20260719-phase3-content-performance.js`

### Tests và tooling

- `client/src/utils/__tests__/compressChatImage.test.js`
- `server/src/controllers/__tests__/phase2.ai-kb.integration.test.js`
- `server/src/controllers/__tests__/phase3.content.integration.test.js`
- `e2e/homepage.spec.js`
- `playwright.config.js`
- `client/public/sitemap.xml` (chỉ chuẩn hóa newline sau build)
- `docs/phase-3-fix-report-2026-07-19.md`

## Việc còn lại ưu tiên cao (trạng thái lịch sử)

Các mục dưới đây là trạng thái tại thời điểm báo cáo Phase 3 ban đầu. Tất cả mục
có thể xử lý trong codebase đã được hoàn thành; xem báo cáo chốt tại
docs/phase-3-remaining-fix-report-2026-07-19.md và docs/phase-5-fix-report-2026-07-19.md.

- Viết authenticated E2E cho admin, trainer và customer. Bộ 22 case hiện tại chỉ
  bao phủ public routes/SEO.
- Thêm API E2E có database cô lập cho AI fork/stream, KB publish/regenerate,
  coaching upload, check-in ownership và Recipe publish lifecycle.
- Giảm tiếp các lazy chunks lớn: PDF khoảng 1.54 MB, app index khoảng 635 kB và
  BlogManagement khoảng 474 kB trước gzip.
- Xử lý 48 lint warnings cũ theo từng feature; không nên sửa hàng loạt nếu chưa có
  regression tests cho các effect đó.
- Bổ sung metrics/alerts cho AI abort/latency, embedding failures, Cloudinary
  cleanup, check-in conflicts và query latency theo index.
- Chỉ bật `KB_VECTOR_INDEX` sau khi Atlas vector index và filter fields đã được
  cấu hình đúng như báo cáo Phase 2.
