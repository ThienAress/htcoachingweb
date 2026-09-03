# Quy định JSON nhập dinh dưỡng công thức

Tài liệu này dành cho chuyên gia tính dinh dưỡng từ danh sách công thức production tại
`production-recipes-for-nutrition.md`. File trả về để Admin nhập vào hệ thống phải là
file `.json`; không đổi tên món, nguyên liệu hoặc định lượng đã được bàn giao.

## 1. Phạm vi tính

- Mỗi kết quả là **tổng dinh dưỡng của toàn bộ công thức**, không phải một khẩu phần.
- Dùng toàn bộ danh sách nguyên liệu và đúng định lượng `measure` đi kèm để tính.
- Bắt buộc tính đủ sáu nhóm core: năng lượng, đạm, chất béo, tinh bột, đường và muối.
- Phải tính **tất cả chất dinh dưỡng khác có thể xác định hợp lý**, không chỉ sáu nhóm
  core. Ví dụ: chất xơ, chất béo bão hòa, chất béo không bão hòa, cholesterol, natri,
  kali, canxi, sắt, magie, kẽm, vitamin A/B/C/D/E/K và các vi chất khác.
- Không điền số liệu phỏng đoán thiếu căn cứ. Nếu dữ liệu nguyên liệu không đủ để tính
  một chất bổ sung, bỏ chất đó khỏi `additional`; không dùng `null`, chuỗi rỗng hoặc 0
  để biểu thị “không biết”. Nếu không thể tính một trong sáu core, báo riêng cho Admin
  và không đưa món đó vào file import cho đến khi có số liệu hợp lệ.
- Mọi giả định chuyên môn hoặc nguồn tham chiếu cần bàn giao ở tài liệu riêng; JSON
  import không chấp nhận field ghi chú ngoài schema bên dưới.

## 2. Quy tắc định danh món

Hệ thống không ghép bằng tên đơn thuần. Một món chỉ được nhận khi đồng thời thỏa mãn:

1. `name` giống chính xác tên production sau khi bỏ khoảng trắng đầu/cuối; có phân biệt
   chữ hoa và chữ thường.
2. `ingredients` giữ đúng số lượng, thứ tự và từng cặp `{ "name", "measure" }` như file
   catalog production.

Không dịch, viết tắt, chuẩn hóa đơn vị, đổi thứ tự hoặc gộp nguyên liệu. Chỉ một món
không khớp cũng làm toàn bộ file không thể xác nhận cập nhật.

## 3. Cấu trúc JSON bắt buộc

```json
{
  "schemaVersion": 1,
  "recipes": [
    {
      "name": "Cơm gà gạo lứt",
      "ingredients": [
        {
          "name": "Ức gà",
          "measure": "200 g"
        },
        {
          "name": "Gạo lứt",
          "measure": "150 g đã nấu"
        }
      ],
      "nutrition": {
        "calories": 520,
        "protein": 42,
        "fat": 18,
        "carb": 48,
        "sugars": 7,
        "salt": 1.4,
        "additional": [
          {
            "label": "Chất xơ",
            "unit": "g",
            "value": 8.5
          },
          {
            "label": "Natri",
            "unit": "g",
            "value": 0.55
          },
          {
            "label": "Vitamin B12",
            "unit": "mcg",
            "value": 1.2
          }
        ]
      }
    }
  ]
}
```

Root chỉ được có `schemaVersion` và `recipes`. Mỗi phần tử trong `recipes` chỉ được có
`name`, `ingredients`, `nutrition`. Không thêm `_id`, `slug`, mô tả, ảnh, hướng dẫn,
nguồn, ghi chú hoặc field tự đặt.

## 4. Sáu field core

| Field | Ý nghĩa | Đơn vị mặc định |
|---|---|---|
| `calories` | Năng lượng toàn công thức | kcal |
| `protein` | Đạm toàn công thức | g |
| `fat` | Chất béo toàn công thức | g |
| `carb` | Tinh bột/carbohydrate toàn công thức | g |
| `sugars` | Tổng đường toàn công thức | g |
| `salt` | Tổng muối tương đương toàn công thức | g |

Tất cả sáu field đều bắt buộc và phải là số JSON hữu hạn, lớn hơn hoặc bằng 0. Không
thêm ký hiệu đơn vị vào giá trị. `salt` là muối tương đương tính theo gram; nếu có số
liệu natri, ghi natri riêng trong `additional` với đơn vị `g`, không chép natri vào
`salt`.

## 5. Thành phần dinh dưỡng bổ sung

- `additional` luôn phải là mảng; dùng `[]` chỉ khi thực sự không tính được chất nào khác.
- Mỗi item bắt buộc có đúng ba field: `label`, `unit`, `value`.
- `label` dài 1–80 ký tự, có nghĩa rõ ràng và không trùng nhau trong cùng món.
- `unit` của input schema v1 nhận một trong: `kcal`, `g`, `mg`, `mcg`. File mới nên dùng
  `g` thay cho `mg`; `mg` chỉ được giữ để tương thích input cũ và hệ thống sẽ chuyển
  ngay `value / 1000` sang `g` mà không làm tròn (`920 mg` thành `0.92 g`). `mcg` giữ
  nguyên; giá trị đã dùng `g` không bị chuyển đổi lần hai.
- `value` là số JSON hữu hạn, lớn hơn hoặc bằng 0.
- Tối đa 60 item cho một công thức.
- Không lặp lại sáu core bằng các label `Năng lượng`, `Đạm`, `Protein`, `Chất béo`,
  `Tinh bột`, `Đường`, `Muối` hoặc tên tiếng Anh tương đương.

## 6. Giới hạn file

- `schemaVersion` phải bằng số `1`.
- `recipes` có từ 1 đến 2.000 món.
- Mỗi món có từ 1 đến 100 nguyên liệu.
- File tối đa 8MB, mã hóa UTF-8 và có đuôi `.json`.
- Không được có hai item trùng cả `name` và toàn bộ `ingredients`.
- Không dùng comment kiểu `//`, dấu phẩy thừa, `NaN`, `Infinity`, phần trăm dạng chuỗi
  hoặc số có dấu phẩy phân cách hàng nghìn.

## 7. Trước khi bàn giao

1. Parse file bằng JSON validator để chắc chắn cú pháp hợp lệ.
2. Kiểm tra mọi món giữ nguyên tên và nguyên liệu từ catalog production.
3. Kiểm tra đủ sáu core và `additional` đã chứa mọi chất có thể tính được.
4. Kiểm tra đúng đơn vị, đã quy đổi `mg` sang `g`, không có giá trị âm, label trùng
   hoặc field lạ.
5. Gửi file `.json` cho Admin. Admin phải bấm `Xem trước`; chỉ khi toàn bộ món khớp mới
   có thể bấm `Xác nhận cập nhật`.

Khi xác nhận, hệ thống chỉ cập nhật `nutrition`. Tên món, slug, nguyên liệu, ảnh, hướng
dẫn, trạng thái hiển thị, nguồn và đánh giá cộng đồng được giữ nguyên.

## 8. Read compatibility, migration và SEO

- Public detail, public `view=prerender` và danh sách Admin đều trả `additional` theo
  đơn vị canonical. Document legacy có `mg` được đọc thành `g` ngay cả trước migration.
- Migration `20260902-normalize-recipe-nutrition-units.js` mặc định chỉ preflight; chỉ
  item `additional` có `unit: "mg"` được đổi thành `g` với `value / 1000`. Apply lần hai
  phải là no-op và không được thay `mcg`, `g`, core nutrition hoặc field Recipe khác.
- Chạy staging theo thứ tự `npm run preflight:recipe-nutrition-units:staging --prefix server`
  rồi `npm run migrate:recipe-nutrition-units:staging --prefix server`. Production dùng
  `npm run preflight:recipe-nutrition-units --prefix server` rồi
  `npm run migrate:recipe-nutrition-units --prefix server`; apply yêu cầu
  `CONFIRM_RECIPE_NUTRITION_UNIT_MIGRATION=yes` cùng target/database guard, và production
  còn yêu cầu confirmation, backup snapshot, approval theo `migrationSafety.js`.
- Không chạy migration staging/production trong lúc chỉ làm việc local. Kết quả preflight
  phải có `ready: true` và không có invalid item trước khi xin phép apply.
- Dữ liệu hiện tại là tổng toàn công thức (`scope: whole_recipe`), chưa có
  `recipeYield` hoặc nutrition theo khẩu phần. Vì vậy Recipe JSON-LD phải bỏ hẳn
  `nutrition`; không được tự đặt `recipeYield: 1`.
