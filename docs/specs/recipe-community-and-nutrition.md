# Spec: Recipe community và nutrition mở rộng

## Objective

Recipe Detail phải trình bày nutrition whole-recipe do admin nhập thủ công bằng một giá trị dễ đọc,
không biến nutrient thiếu dữ liệu thành 0. Người đã đăng nhập có thể gửi một đánh giá
1–5 sao kèm bình luận cho mỗi công thức, cập nhật hoặc xóa đánh giá của chính mình;
khách chưa đăng nhập vẫn xem được điểm tổng hợp và bình luận công khai.

## Assumptions

- Một user chỉ có một review trên mỗi recipe; thao tác gửi lại là update.
- Comment là plain text tối đa 1.000 ký tự, có thể để trống khi chỉ chấm sao.
- Public response chỉ trả tên hiển thị, không trả email, role hoặc metadata nội bộ.
- Recipe review dùng collection riêng nên không cần backfill Recipe hiện có. Index production
  phải được tạo qua migration/preflight riêng trước khi mở ghi thật.
- Admin nhập tổng dinh dưỡng cho toàn bộ công thức, không chia khẩu phần và không dùng
  estimator từ nguyên liệu ở public read path.
- Chuyên gia tính dinh dưỡng từ đúng tên món và danh sách nguyên liệu production được
  bàn giao; hệ thống không tự suy diễn hoặc đổi định lượng nguyên liệu khi nhập JSON.

## Related stack and conventions

- React 19, TanStack Query và service layer hiện có trong `client/src/services/`.
- Express route → controller → service → Mongoose model; mutation bắt buộc auth, CSRF,
  validation và rate limit.
- Public recipe route hiện có giữ nguyên; review nằm dưới `/api/recipes/:recipeId/reviews`.

## UI brief

- Audience: người đang đọc công thức và muốn đánh giá mức hữu ích/thực tế.
- Surface mode: **Read**; giữ dark/orange brand của Recipe Detail.
- Layout A (chọn): summary sao → composer gọn → thread phẳng, chạy một cột và responsive.
- Layout B (loại): summary/composer và comment chia hai cột; khó đọc trên mobile và tạo card lồng.
- Signature element: hàng sao tương tác rõ focus/selected; không thêm gradient text/glass card.

## Nutrition contract

- Bảng có hai cột `Dinh dưỡng` và `Giá trị`.
- Các field admin luôn nhập: `calories`, `protein`, `fat`, `carb`, `sugars`, `salt`.
- `additional` cho phép thêm nutrient khác bằng `label`, `unit`, `value`; label không trùng
  core nutrient hoặc trùng nhau trong cùng công thức.
- Giá trị là tổng toàn bộ công thức. `0` là giá trị hợp lệ do admin chủ động nhập; `null`
  hoặc thiếu nutrition nghĩa là chưa có dữ liệu.
- Public API trả `source: admin_manual`, `scope: whole_recipe`, `values` và `additional`;
  không gọi estimator hay fallback từ Food DB.
- Công thức cũ không có nutrition vẫn đọc được và public UI hiển thị empty state; không
  cần backfill/migration bắt buộc trong lần triển khai này.
- Warning nói rõ số liệu do admin tổng hợp cho toàn bộ công thức và có thể khác theo
  nguyên liệu/cách chế biến thực tế.

## Bulk nutrition import contract

- Admin có action `Nhập Giá trị dinh dưỡng` cạnh `Thêm công thức`; luồng bắt buộc là
  chọn file `.json` → xem trước không ghi → xác nhận cập nhật.
- Endpoint `POST /api/recipes/nutrition/import` dùng multipart, chỉ Admin, giữ CSRF hiện
  có và giới hạn file 8MB. `dryRun=true` chỉ trả kết quả ghép; commit phải có preview
  token còn hạn, thuộc đúng Admin và đúng SHA-256 của file đã xem trước.
- Root JSON là `{ schemaVersion: 1, recipes: [...] }`. Mỗi item chỉ có `name`,
  `ingredients` và `nutrition`; mọi field lạ đều bị từ chối.
- `ingredients` phải trả lại nguyên danh sách `{ name, measure }` từ catalog. Một item
  chỉ khớp khi tên sau trim phân biệt hoa/thường và toàn bộ danh sách nguyên liệu theo
  đúng thứ tự đều giống dữ liệu hiện tại. Tên thiếu, nguyên liệu lệch hoặc nhiều bản ghi
  cùng khớp đều chặn toàn bộ import.
- `nutrition` bắt buộc đủ sáu field core và cho phép tối đa 60 nutrient trong
  `additional`. Mỗi nutrient có `label`, `unit` thuộc `kcal | g | mg | mcg` và `value`
  là số hữu hạn không âm; label không được trùng core hoặc trùng nhau.
- Chuyên gia phải tính tất cả chất có thể xác định hợp lý từ nguyên liệu, không chỉ sáu
  nhóm core. Vitamin, khoáng chất, chất xơ, chất béo thành phần và các chất khác phải
  nằm trong `additional`; không bịa số liệu khi nguồn/định lượng không đủ.
- Commit chạy trong Mongo transaction, lặp lại bước ghép và chỉ `$set nutrition`.
  Không sửa tên, slug, nguyên liệu, hướng dẫn, ảnh, publish state, nguồn hoặc review.
- Nới giới hạn `additional` từ 20 lên 60 là tương thích ngược với document cũ; không
  đổi type/default, không bắt buộc migration hoặc backfill.

## Review API contract

- `GET /api/recipes/:recipeId/reviews?page=1&limit=10`: public + optional auth, trả
  `summary`, `items`, `myReview`, `pagination`.
- `PUT /api/recipes/:recipeId/reviews`: authenticated + CSRF + rate limit, upsert
  `{ rating, comment }` theo `{ recipeId, userId }`.
- `DELETE /api/recipes/:recipeId/reviews`: authenticated + CSRF + rate limit, chỉ xóa
  review của `req.user.id`.

## Testing strategy

- Client regression test cho scroll lock không thay `position/top`, Food table không còn
  cột nguồn, nutrition single-value và unavailable state.
- Server Food route/service test cho optional nutrients và coverage fail-closed.
- Recipe review integration test cho public read, auth/CSRF write, one-review upsert,
  ownership delete, validation và projection không lộ email.
- Client lint/build, focused tests, UI audit và browser desktop/mobile.
- Recipe importer integration test cho Admin/CSRF, strict JSON, preview no-write,
  name + ingredients matching, token/file mismatch, transaction rollback và bảo toàn
  mọi field ngoài `nutrition`; client test cho file guard, service multipart và CTA.

## Success criteria

- Đóng trainer drawer không làm trang jump/reload; scroll position giữ nguyên.
- Fitness+ drawer phủ viewport thay vì bị giới hạn trong Pricing section.
- Dashboard Food không hiển thị cột `Nguồn`; provenance backend/form vẫn được giữ để
  bảo vệ độ tin cậy dữ liệu.
- Nutrition chỉ còn một giá trị estimate và optional nutrients không bị cộng thiếu như 0.
- Rating/comment xuất hiện ngay trong code local; không phụ thuộc việc lên production mới render.
- Admin chỉ commit được file dinh dưỡng đã preview và khớp toàn bộ công thức; mọi chất
  bổ sung hợp lệ trong giới hạn được lưu và public detail tự hiển thị qua `additional`.
