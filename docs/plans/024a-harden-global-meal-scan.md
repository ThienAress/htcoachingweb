# Plan 024A: Harden Meal Scan cho món ăn toàn cầu và xác nhận có kiểm soát

> **Trạng thái**: DONE / LOCAL VERIFIED — WEIGHED HOLDOUT PENDING
>
> **Drift check**: Giữ nguyên toàn bộ thay đổi chưa commit ngoài Meal Scan. Không sửa schema,
> auth/CSRF, Daily Journal, upload storage hoặc các file contract/subscription đang dirty.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (health-adjacent AI output, image privacy, provider cost)
- **Depends on**: 024
- **Category**: public tool / AI / privacy / UI / benchmark
- **Planned at**: 2026-08-03
- **Verified at**: 2026-08-04

## Why This Matters

Meal Scan hiện hoạt động với Gemini và range calibration nhưng mới kiểm chứng trên Nutrition5k
và proxy món Việt. Sản phẩm phải nhận diện món toàn cầu, từ món Việt đến Âu/Mỹ, bánh ngọt,
đồ uống và thực phẩm đóng gói; đồng thời phải từ chối ảnh không đủ điều kiện và bắt người dùng
xác nhận phần AI không thể nhìn thấy. Chất lượng macro không được suy diễn từ benchmark synthetic.

## Baseline trước Plan 024A

- `server/src/services/mealScan.provider.js` dùng structured Gemini JSON nhưng chưa có image/scenario assessment và prompt locale `vi` vẫn có thể trả text tiếng Anh.
- `server/src/services/mealScanResult.js` normalize range/confidence nhưng mọi provider result đều phải có item, nên chưa biểu diễn non-food/retake rõ ràng.
- `client/src/pages/MealScan/MealScan.jsx` nén và gửi ảnh, sau đó chỉ cho chỉnh gram.
- `client/src/pages/MealScan/MealScanResult.jsx` chưa cho đổi tên, loại item sai, xác nhận từng item hoặc thêm thành phần từ Food DB.
- `server/src/models/Food.js` có P/C/F/calories trên 100 g nhưng chưa có provenance/license; chỉ dùng làm reference do người dùng chủ động chọn.
- Benchmark Nutrition5k holdout vẫn NO-GO cho beta rộng; proxy synthetic chỉ INFORMATIONAL_PASS.

## Scope

**In scope**:

- Provider contract: locale, open-world cuisine, image/scenario assessment, readable-label source, component decomposition và privacy-safe usage logging.
- Backend normalization/error contract cho non-food, retake, shared meals và hidden ingredients.
- Client preflight ảnh, UX review local: đổi tên, loại item, xác nhận item/câu hỏi, thêm Food DB reference và tính lại tổng.
- Tài liệu collection protocol đa ẩm thực, benchmark strata, quality gate và deferred external dependencies.
- Focused tests, full Meal Scan tests, client build và security/data-boundary gates.

**Out of scope**:

- Lưu ảnh/kết quả, consent training, history, Daily Journal hoặc schema mới.
- Tự gán Food DB hiện tại là nguồn dinh dưỡng canonical khi chưa có provenance/license.
- External barcode database, paid OCR provider hoặc allergy guarantee.
- Tự tạo ground truth gram/macro, deploy hoặc mở production alpha.

## Steps

### Step 1: Harden provider và result contract

Thêm image assessment/status/data source, locale text rule, scenario rules và error codes; giữ
backward compatibility cho mock/test fixture cũ khi assessment vắng mặt.

**Verify**: focused server provider/result tests pass.

### Step 2: Thêm deterministic client image preflight

Đánh giá resolution, exposure, contrast và blur theo pixel statistics; chỉ block trường hợp chắc
chắn không dùng được, còn cảnh báo có thể tiếp tục để tránh false positive.

**Verify**: helper unit tests pass với dark/bright/low-resolution/usable samples.

### Step 3: Xây review workflow local-only

Cho sửa tên món, loại item sai, xác nhận item uncertain/câu hỏi hidden ingredient, thêm Food DB
reference theo gram và chỉ cho confirm khi review đầy đủ. Không gọi mutating API.

**Verify**: helper tests + client build; loading/error/empty/disabled/focus states đầy đủ.

### Step 4: Codify global benchmark và operations

Cập nhật spec, collection protocol 40–60 mẫu đa ẩm thực, privacy/consent, holdout discipline,
model drift/cost metrics và GO/NO-GO. Ghi rõ synthetic không phải nutrition ground truth.

**Verify**: docs links hợp lệ, agent validation pass.

### Step 5: Integrated verification

Chạy toàn bộ Meal Scan client/server tests, lint/build tương xứng, secret scan, data-boundary,
`git diff --check`; review diff và không để debug/unused code.

## Test Plan

- Provider prompt/schema: locale vi/en, assessment required, component decomposition, label priority.
- Result normalization: non-food/retake fail closed, shared meal low confidence, source normalization.
- Image quality: low resolution, dark/overexposed, low contrast/blur warnings, usable image.
- Review helper: exclude item, rename, add Food DB item/100 g, confirm gating, totals.
- Existing API auth/CSRF/type/size/provider tests không regression.

## Done Criteria

- [x] Món ăn toàn cầu không bị giới hạn bởi locale; user-visible provider text theo locale.
- [x] Non-food/retake/shared/packaged/dessert có contract và fallback rõ.
- [x] User phải review phần uncertain trước confirm; mọi chỉnh sửa chỉ local.
- [x] Food DB item do user chọn được tính theo 100 g và gắn source reference, không gọi canonical.
- [x] Không lưu/log ảnh, base64, tên món hoặc câu hỏi raw.
- [x] Collection protocol và giới hạn external dependency được ghi rõ.
- [x] Tests/build/security gates phù hợp pass.

## Kết quả triển khai

- Provider nhận diện open-world cuisine, bắt toàn bộ text theo `vi`/`en`, phân loại image/scenario,
  tách lớp bánh nhìn thấy, fail closed với non-food/retake và chỉ dùng nutrition label khi đọc được
  panel + serving size.
- Lỗi Gemini tạm thời (network/408/429/5xx) được retry đúng một lần trong cùng deadline; không
  retry lỗi 4xx vĩnh viễn hoặc output malformed. Log chỉ chứa status/attempt/latency/token usage.
- Client có preflight ảnh deterministic, review local-only, rename/exclude/add Food DB reference,
  recalculation và confirmation gate; không có mutating API hay persistence mới.
- Bộ proxy global gồm 8 ảnh synthetic: pizza dùng chung, steak, carbonara, croissant/pain au
  chocolat, tiramisu, sushi, bibimbap và trà sữa. Ảnh/report nằm trong `.local-data` bị ignore.

## Verification evidence

| Gate | Kết quả |
|---|---|
| Gemini global synthetic proxy | PASS 8/8; meal name 100%; scenario 100%; visible ingredient recall 87,63%; hidden-question 100%; 8 low |
| Gemini Vietnamese synthetic proxy | PASS 8/8; meal name 100%; visible ingredient recall 85,40%; hidden-question 100%; 8 low |
| Transient provider recovery | Live global run phục hồi network failure ở attempt 2; unit guard có retry/no-retry cases |
| Release build | PASS; Vite + sitemap + prerender 785/785 + bundle budget |
| Client unit | PASS 50 files / 247 tests |
| Server unit/integration | PASS 97 files / 427 tests |
| Client lint | PASS, 0 errors; còn 1 warning cũ tại `Pricing.jsx` ngoài phạm vi |
| Repository gates | Secret scan PASS; data-boundary 0 violation; agent validation PASS; `git diff --check` PASS |
| Browser smoke | Desktop 12-column và mobile 390x844 không overflow/console error; auth result E2E chưa chạy |

Synthetic proxy chỉ là `INFORMATIONAL_PASS`; không phải nutrition-accuracy release evidence. E2E có
đăng nhập, deploy và production alpha không được thực hiện trong task này.

## STOP Conditions

- Cần thay schema hoặc tuyên bố Food DB canonical mà chưa audit provenance/license.
- Cần lưu ảnh/kết quả, dùng cho training hoặc ghi Daily Journal.
- Cần external barcode/OCR service, dependency mới hoặc dữ liệu non-commercial.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Mỗi lần đổi model/prompt/schema phải chạy lại holdout khóa trước và proxy đa ẩm thực.
- Reviewer phải kiểm tra prompt không biến locale thành cuisine restriction và không log raw payload.
- Alpha/deploy và ground-truth collection là gate bên ngoài code, không tự động thực hiện.
- `MealScan.jsx`, `MealScanResult.jsx` và provider hiện là file điều phối/contract lớn hơn 300 dòng;
  giữ nguyên để tránh refactor UI/API ngoài Plan 024A. Phải tách trước khi thêm history, persistence
  hoặc workflow mới vào các file này.
