# Meal Scan Gemini baseline — 2026-08-03

## Kết luận

**NO-GO cho beta dựa trên output AI chưa hiệu chỉnh.** Gemini hoạt động ổn định và trả
đúng structured contract, nhưng khoảng ước tính và confidence chưa phản ánh đủ độ bất
định của bài toán một ảnh.

## Thiết lập

- Provider/model: `gemini / gemini-3.1-flash-lite` qua cấu hình Doppler local.
- Smoke: 1 ảnh Nutrition5k, locale `vi`.
- Baseline: 30 ảnh overhead RGB thuộc depth test split của Nutrition5k, locale `en`.
- Ảnh được tải từ nguồn công khai, nén WebP dưới 280 KB trong RAM rồi gửi trực tiếp tới
  `mealScan.service`; không lưu ảnh/base64 vào repo, DB, Cloudinary hay log.
- Dataset: [Google Research Nutrition5k](https://github.com/google-research-datasets/Nutrition5k),
  giấy phép CC BY 4.0.

## Kết quả

| Metric | Kết quả |
|---|---:|
| Provider success | 30/30 (100%) |
| Portion median / mean APE | 21,95% / 32,77% |
| Portion range coverage | 46,67% |
| Calories median / mean / P90 APE | 33,37% / 53,15% / 70,23% |
| Calories MAE | 95,85 kcal |
| Calories range coverage | 36,67% |
| Protein median APE / range coverage | 42,50% / 33,33% |
| Carb median APE / range coverage | 26,67% / 43,33% |
| Fat median APE / range coverage | 58,31% / 30,00% |
| Ingredient recall heuristic | 46,56% |
| Hidden oil/sauce question recall | 100% |

Confidence chưa được hiệu chỉnh tốt:

- `high`: 18/30 ảnh, calorie median APE 28,42%, range coverage 38,89%.
- `medium`: 12/30 ảnh, calorie median APE 33,37%, range coverage 33,33%.
- `low`: 0/30 ảnh.
- 11/18 kết quả `high` không chứa calorie ground truth trong range.
- Hai mẫu có calorie APE trên 100%; outlier cao nhất là 445,45% trên món chỉ 22 kcal.

## Quality gate

Gate `FAIL` ở các tiêu chí:

- calorie mean APE tối đa 45%; thực tế 53,15%;
- calorie/protein/carb/fat range coverage tối thiểu lần lượt 70%/60%/60%/60%;
- ingredient recall tối thiểu 60%;
- high-confidence calorie range coverage tối thiểu 80%.

Các tiêu chí đang đạt: provider success, calorie median/P90 APE, portion median APE và
median APE của từng macro. Việc median đạt nhưng coverage thấp cho thấy estimate đôi khi
hợp lý, còn range đang quá hẹp và dễ tạo cảm giác chính xác giả.

## Quyết định kỹ thuật

1. Giữ UI hiện tại ở ngôn ngữ “ước tính”, không auto-save vào Daily Journal.
2. Chưa mở beta rộng hoặc dùng output làm nutrition canonical.
3. Vòng kế tiếp cần hiệu chỉnh prompt/range và quy tắc confidence; sau đó chạy một holdout
   Nutrition5k mới, không dùng lại 30 ảnh baseline để quyết định chất lượng.
4. Trước beta Việt Nam, bổ sung tối thiểu 20–30 ảnh món Việt chụp bằng điện thoại với
   khẩu phần cân thật và macro tham chiếu. Nutrition5k có bias căng tin California và ảnh
   từ scanning rig sạch hơn ảnh khách hàng thực tế.

## Cách chạy lại

PowerShell, từ `server/`:

```powershell
$env:MEAL_SCAN_BENCHMARK_ALLOW_LIVE='true'
doppler run -- npm run smoke:meal-scan:gemini
doppler run -- npm run benchmark:meal-scan -- --limit=30 --locale=en
```

Report chi tiết được ghi vào `.local-data/meal-scan/` (Git ignored), chỉ chứa dish ID công
khai, prediction số/text và metrics; không chứa ảnh hoặc base64.
