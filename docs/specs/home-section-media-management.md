# Spec: Quản lý ảnh Classes và Tools theo từng mục

## Objective

Thay giao diện upload ảnh chung của toàn bộ section hình ảnh trên Homepage bằng từng slot có nhãn rõ ràng. Mỗi ảnh được lưu bằng stable key, không phụ thuộc thứ tự hiển thị, để tránh gán nhầm ảnh. Homepage và Admin dùng chung catalog; khi thêm item vào catalog này, slot tương ứng tự xuất hiện trong Admin. Mọi section có thể thu gọn/mở rộng độc lập để dashboard gọn hơn.

## Tech Stack liên quan

- React 19, TanStack Query 5, React i18next và Tailwind CSS 4 ở frontend.
- Express 5, Multer, Mongoose 9 và Cloudinary ở backend.
- API hiện tại: `GET /api/site-settings`, các route upload được bảo vệ bởi Admin auth và CSRF.

## Commands

- Client unit: `npm run test:unit:client`
- Server unit: `npm run test:unit:server`
- Client lint: `npm run lint --prefix client`
- Client build: `npm run build --prefix client`
- Diff hygiene: `git diff --check`

## Cấu trúc File bị ảnh hưởng

- `client/src/config/homeSectionCatalog.js` — catalog canonical cho class/tool, gồm stable key và metadata render.
- `client/src/sections/Hero.jsx`, `About.jsx`, `Trainers.jsx` — resolve keyed image cho Banner, Avatar, About và ảnh HLV nổi bật.
- `client/src/sections/class/Classes.jsx` — render class và resolve ảnh theo key.
- `client/src/sections/Tools.jsx` — render tool và resolve ảnh theo key.
- `client/src/pages/Home.jsx` — truyền image maps mới, đồng thời giữ legacy fallback.
- `client/src/pages/admin/SiteSettings.jsx` — render từng upload slot từ cùng catalog.
- `client/src/components/admin/KeyedMediaSection.jsx` — UI slot tái sử dụng, trạng thái upload/xóa độc lập.
- `client/src/services/siteSetting.service.js` — gửi item key cho upload/remove.
- `server/src/models/SiteSetting.js` — thêm hai map URL tùy chọn.
- `server/src/controllers/siteSetting.controller.js` — ghi/xóa ảnh theo section và item key.
- `server/src/routes/siteSetting.routes.js` — endpoint upload một ảnh cho từng item.
- Tests frontend/backend tương ứng với catalog, resolver và API contract.

Danh sách có thể thu hẹp hoặc bổ sung test file sau khi lập implementation plan; không thay đổi public route hay SEO metadata.

## Code Style

- Frontend chỉ gọi API qua `siteSetting.service.js`; server giữ route → controller → model như hiện tại.
- Stable key dùng kebab-case, ví dụ `personal-training`, `cardio-hiit`, `boxing`, `tdee`, `meal-scan`.
- UI Admin dùng Tailwind/Lucide, có label, preview, loading, disabled, success/error rõ ràng và keyboard focus.
- Ảnh mặc định vẫn nằm trong client assets; ảnh Admin upload chỉ override theo key.

## Testing Strategy

- Catalog là nguồn chung cho homepage và Admin; thêm item giả lập phải tạo được slot mà không sửa form Admin.
- Resolver chọn đúng ảnh theo key kể cả khi đổi thứ tự item.
- Documents cũ chỉ có `classesImages`/`toolsImage` vẫn hiển thị bằng legacy fallback.
- Upload/remove item hợp lệ cập nhật đúng key; item key sai format bị trả `400`.
- Kiểm tra loading/error/disabled, preview và accessible label của từng slot.
- Chạy client/server unit phù hợp, lint, client build và `git diff --check`.

## Boundaries

- Always: validate item key ở backend; giữ Admin auth, role và CSRF; giữ middleware kiểm tra loại/kích thước ảnh; dùng `safeLog` cho lỗi upload.
- Ask first: thay đổi kiểu hoặc xóa field hiện hữu; chạy migration/backfill; ghi dữ liệu staging/production; deploy.
- Never: map ảnh bằng array index làm contract mới; hardcode credential; nới CSRF/rate limit; xóa ảnh Cloudinary hoặc dữ liệu legacy ngoài yêu cầu.

## Data Contract và tương thích

- Thêm các map optional/default rỗng: `heroImagesByKey`, `heroAvatarsByKey`, `aboutImagesByKey`, `trainerImagesByKey`, `classesImagesByKey` và `toolsImagesByKey`.
- Giữ nguyên toàn bộ field legacy. Homepage ưu tiên keyed map, sau đó legacy value tương ứng, cuối cùng ảnh asset mặc định. Riêng Trainer, SiteSetting chỉ override ảnh HLV nổi bật đầu tiên; xóa override sẽ trả về ảnh canonical từ Trainer API.
- Không cần migration bắt buộc: document cũ tiếp tục đọc được; dữ liệu keyed được tạo dần khi Admin upload lại từng mục.
- Upload mới thay thế duy nhất URL của item key được chọn, không ảnh hưởng các item khác.
- Thêm class/tool trong tương lai chỉ cần đăng ký một lần trong catalog canonical; Admin và homepage cùng nhận item đó.

## Success Criteria

- Admin hiển thị riêng Personal Training, Cardio & HIIT, Boxing và từng tool hiện có, bao gồm Meal Scan.
- Hero Banner có 5 slot, Hero Avatar có 3 slot, About có 5 slot và Trainer có 1 slot ảnh HLV nổi bật.
- Tất cả section có nút chevron với `aria-expanded`, mở/đóng độc lập và giữ đầy đủ loading/error/disabled state khi mở.
- Mỗi slot chỉ chọn/upload/xóa ảnh của đúng item và hiển thị trạng thái xử lý độc lập.
- Homepage hiển thị đúng ảnh theo stable key khi thứ tự catalog thay đổi.
- Item mới trong catalog tự có slot Admin và dùng ảnh mặc định cho tới khi được upload.
- Dữ liệu SiteSetting hiện tại không mất, không cần migration và không có thao tác staging/production.
- Các gate test/lint/build đã chọn pass trước bàn giao.

## Open Questions

- Không còn. User đã xác nhận hai map optional và contract tương thích ngày 2026-08-06.
