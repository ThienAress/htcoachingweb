# Meal Scan calibrated holdout — 2026-08-03

## Kết luận

**Calibration cải thiện đáng kể tính trung thực của range, nhưng Meal Scan vẫn NO-GO cho
beta rộng.** Hai hạn chế còn lại nằm ở point estimate và nhận diện đầy đủ thành phần; không
nên tiếp tục che chúng bằng cách mở range rộng hơn.

## Thiết lập

- Provider/model: `gemini / gemini-3.1-flash-lite`.
- Holdout: 30 ảnh Nutrition5k depth-test không trùng 30 dish baseline.
- Locale: `en` để ingredient token recall so sánh được với nhãn Nutrition5k.
- Code được khóa trước khi chạy batch; không chỉnh prompt/range trong lúc benchmark.
- Ảnh chỉ tồn tại trong RAM, được nén WebP dưới 280 KB và zero buffer sau request.

## Thay đổi calibration

- Gemini phải trả `scaleReferenceVisible` và được hướng dẫn rằng đĩa/bát không phải vật
  chuẩn kích thước.
- Thiếu vật chuẩn: confidence bị hạ về `low`.
- `high` do model tự khai không còn được tin như xác nhận bên ngoài; bản cuối cap ở
  `medium`. `high` chỉ nên mở lại khi request có reference do người dùng/hệ thống xác minh.
- Backend áp uncertainty floor theo confidence nhưng giữ nguyên point estimate.
- Prompt yêu cầu tách mọi thành phần nhìn thấy, dùng trọng lượng cooked/as-served và
  cross-check calories với P/C/F.

## Baseline và holdout

| Metric | Baseline 30 | Calibrated holdout 30 |
|---|---:|---:|
| Provider success | 100% | 100% |
| Portion median APE | 21,95% | 23,71% |
| Portion range coverage | 46,67% | 90,00% |
| Calories mean APE | 53,15% | 40,54% |
| Calories median APE | 33,37% | 36,63% |
| Calories P90 APE | 70,23% | 78,71% |
| Calories range coverage | 36,67% | 83,33% |
| Protein range coverage | 33,33% | 86,67% |
| Carb range coverage | 43,33% | 90,00% |
| Fat range coverage | 30,00% | 63,33% |
| Ingredient recall heuristic | 46,56% | 46,79% |

Calibration đạt mục tiêu range coverage và giảm mean calorie error trên holdout, nhưng
không cải thiện ingredient recall. Median calorie error còn vượt ngưỡng 35% khoảng 1,63
điểm phần trăm.

Trong batch có một ảnh hạnh nhân bị model tự gắn `high`: dự đoán 30 g / 175 kcal trong khi
ground truth là 52 g / 300,61 kcal. Safety cap cuối cùng loại bỏ `high` tự chứng nhận này.
Point estimate và kết luận NO-GO không thay đổi.

## Quality gate cuối

Gate vẫn `FAIL` ở:

- calorie median APE: 36,63% > 35%;
- ingredient recall: 46,79% < 60%.

Các gate còn lại đạt trên holdout: provider success, calorie mean/P90 APE, portion error,
calorie/P/C/F range coverage và median error của từng macro. Confidence `high` từ model đã
được cap nên không còn được hiển thị xanh như một kết quả đã xác minh.

## Quyết định sản phẩm

1. Có thể giữ feature dưới dạng alpha nội bộ/opt-in với disclaimer và bắt buộc người dùng
   xác nhận gram, dầu/sốt và thành phần.
2. Chưa auto-save vào Daily Journal, chưa dùng để quyết định dinh dưỡng hoặc y tế.
3. Bước đánh giá kế tiếp phải dùng 20–30 món Việt chụp bằng điện thoại, cân gram thật và có
   macro tham chiếu. Nutrition5k không đại diện cho món Việt hay điều kiện camera khách hàng.
4. Nếu bộ món Việt vẫn không đạt point/ingredient gate, cần chuyển sang luồng AI nhận diện
   + người dùng chọn món/khẩu phần + nutrition database, thay vì cố làm model nhìn ảnh và tự
   tính toàn bộ.

Report JSON chi tiết nằm tại
`.local-data/meal-scan/nutrition5k-gemini-calibrated-holdout-30-en.json` và được Git ignore.
