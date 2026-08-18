# Meal Scan global data collection and evaluation protocol

## Purpose

Tạo bộ holdout ảnh điện thoại có cân thật để đánh giá Meal Scan trên món ăn toàn cầu. Bộ này là
release evidence, không phải training dataset mặc định. Không dùng ảnh synthetic, ảnh công thức
hoặc dinh dưỡng của “khẩu phần tiêu chuẩn” làm ground truth cho đúng phần ăn trong ảnh.

## Ownership and consent

- Mỗi người chụp phải đồng ý dùng ảnh cho kiểm thử nội bộ Meal Scan; consent phải tách khỏi consent
  marketing/training.
- Không chụp mặt người, tên, hóa đơn, địa chỉ, tài khoản, thuốc hoặc dữ liệu sức khỏe khác.
- Ảnh gốc nằm trong kho nghiên cứu riêng có access control và retention date; không commit vào repo,
  không upload Cloudinary và không dùng payload production.
- Dataset external chỉ dùng khi license cho phép mục đích thương mại và redistribution cần thiết.

## Minimum sample design

MVP holdout cần 40–60 phần ăn thật, chụp bằng ít nhất ba dòng điện thoại và nhiều điều kiện sáng.
Mỗi stratum có tối thiểu 6 mẫu khi khả thi:

1. Món Việt/Đông Nam Á: cơm phần, món nước, món cuốn, món chiên/xào.
2. Đông Á: Nhật, Hàn, Trung; gồm bento, mì, sushi và món sốt.
3. Âu/Mỹ: steak, pasta, pizza, burger, salad.
4. Bakery/dessert: croissant, cake, tiramisu, donut, món có nhân/kem.
5. Drink: cà phê sữa, smoothie, trà sữa, nước ép.
6. Packaged food: mặt trước, barcode và nutrition label khi có thể đọc.
7. Shared/multi-dish: pizza dùng chung, lẩu, buffet hoặc mâm cơm; chấm fallback chứ không chấm
   portion cá nhân nếu không có serving selection.

Không tune prompt trên holdout. Dùng development set riêng và khóa code/model/prompt trước batch.

## Capture protocol per sample

1. Gán `sampleId` ngẫu nhiên, không chứa tên người/quán.
2. Cân khay/đĩa rỗng, sau đó cân từng thành phần as-served đến ít nhất 1 g.
3. Ghi recipe/source, cooked/raw state, dầu, bơ, sốt, đường, topping và phần không nhìn thấy.
4. Chụp một ảnh chính theo hành vi người dùng; có thể chụp góc thứ hai chỉ để nghiên cứu riêng.
5. Với packaged food, chụp riêng nutrition label và serving size; barcode không thay cho nutrition.
6. Với shared meal, ghi tổng phần và phần thực tế người thử đã ăn; nếu không xác định được thì chỉ
   đánh giá recognition/fallback.
7. Dietitian hoặc người kiểm tra thứ hai review ingredient list và nutrition calculation.

## Required manifest fields

| Field | Meaning |
|---|---|
| `sampleId` | ID ẩn danh, immutable |
| `stratum` | cuisine/scenario group |
| `dishName` | tên món tham chiếu |
| `deviceClass` | loại thiết bị chung, không device ID |
| `captureAngle` | overhead / 45-degree / other |
| `lighting` | daylight / indoor / low-light |
| `componentName` | thành phần as-served |
| `componentGrams` | gram cân thật |
| `oilSauceGrams` | dầu/sốt/đường nếu biết |
| `calories/protein/carb/fat` | reference đã review |
| `nutritionSource` | database/label/recipe version |
| `labelVisible` | nhãn có đọc được trong ảnh chính không |
| `sharedServing` | ảnh có nhiều phần/người ăn không |
| `consentVersion` | phiên bản consent nội bộ |

Không ghi user ID, email, số điện thoại hoặc raw consent text trong benchmark report.

## Evaluation gates

- Provider success rate ≥ 95%.
- Median calorie absolute percent error ≤ 35%; mean ≤ 45%; P90 ≤ 80%.
- Calorie range coverage ≥ 70%; P/C/F coverage mỗi loại ≥ 60%.
- Ingredient recall ≥ 60% trên visible/verified ingredient labels.
- Shared/non-food/poor-image fallback recall ≥ 90% trên negative/challenging set.
- Không có `high` confidence tự chứng nhận; externally unverified scale tối đa `medium`.
- Báo metric chung và theo từng stratum; overall pass không được che một stratum nguy hiểm.

## Model drift and cost ledger

Mỗi benchmark report phải ghi timestamp, provider/model, prompt/schema version, sample IDs, locale,
latency P50/P90, success/failure code, token usage nếu provider cung cấp và chi phí ước tính theo
bảng giá tại ngày chạy. Không ghi raw image/base64, tên người, địa điểm hoặc nguyên văn prompt có
secret. Mỗi lần đổi model/prompt/schema phải tạo holdout report mới.

## Release decision

- `INFORMATIONAL_PASS` của synthetic proxy chỉ cho phép tiếp tục development.
- Alpha nội bộ yêu cầu fallback/confirmation/privacy gates pass; chưa auto-save Daily Journal.
- Beta rộng yêu cầu global weighed holdout pass và review riêng bakery/drink/shared strata.
- Nếu point estimate tiếp tục fail, dùng hybrid flow: recognition → user selection/grams → audited
  nutrition database. Không mở range rộng hơn để che point-estimate error.

## External blockers

- HTCOACHING Food database hiện thiếu source/version/license provenance; chưa được gọi canonical.
- Barcode lookup/OCR provider cần đánh giá license, privacy, CSP, latency và commercial cost riêng.
- Allergy/gluten-free/medical-safety không thể xác nhận từ ảnh và luôn nằm ngoài product claim.
- Deploy, production alpha và retention/training consent cần phê duyệt target riêng.
## Production cost controls

- Development runtime dùng Meal Scan mock mặc định và không gửi ảnh sang Gemini. Chỉ đặt
  MEAL_SCAN_PROVIDER=gemini cho thử nghiệm local có kiểm soát với ảnh test/public, không phải ảnh khách.
- Production chưa xác nhận data-use mode phải đặt `MEAL_SCAN_PROVIDER=disabled`. Paid Service dùng
  `GEMINI_PAID_SERVICE_CONFIRMED=true`; Free/Unpaid Tier chỉ dùng khi owner đã chấp thuận điều khoản dữ liệu,
  đặt `GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED=true`, giữ disclosure theo từng request ở UI và bắt buộc
  `providerDataUseAccepted=true` tại middleware trước limiter/provider;
  request fail-closed với 503 và không gọi provider. `mock` vẫn chỉ được phép cho staging.
- Production giữ data-use gate và quota server-authoritative: anonymous 1 lượt lifetime/browser,
  user thường thêm 1 lượt lifetime/account; coaching 10/ngày + 300/30 ngày và HLV 20/ngày + 600/30 ngày. Response 429 không gọi
  provider và không debit ví HTCOACHING.
- Trước deploy, owner phải xác nhận đúng AI Studio project/billing account và phê duyệt project-level
  monthly spend cap bằng USD. Không tự suy ra cap từ app wallet hoặc tier limit.
- Theo dõi Usage/Spend trong AI Studio; app rate limit là cost guard bổ sung, không thay spend cap.
- Không ghi API key, billing PII, payment method hoặc raw usage payload vào repo/runbook evidence.
