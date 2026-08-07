# Spec: Quét món ăn và ước tính calo/macro từ ảnh

**Status:** IMPLEMENTED / LOCAL VERIFIED — ALPHA WEIGHED-HOLDOUT GATE PENDING

## Objective

Tạo trang public `/quet-mon-an` để người dùng tải ảnh món ăn và nhận ước tính
calo, protein, carb, fat theo khoảng. Công cụ cho phép kiểm tra thành phần và
chỉnh khẩu phần, nhưng không trình bày output AI như số liệu chính xác tuyệt đối.

## Product contract

- Navbar: `Công cụ → Quét món ăn`; tiếng Anh là `Meal Scan`.
- Trang và thao tác phân tích ảnh đều public. Anonymous được 2 lượt/24 giờ theo IP; user thường được
  3 lượt/24 giờ; coaching customer và HLV được 10 lượt/24 giờ theo user. Vượt quota trả 429, không gọi
  provider và không debit ví.
- Desktop: upload 5/12, kết quả 7/12; mobile xếp dọc.
- Ảnh nén tại browser, chỉ xử lý tạm thời, không lưu DB/Cloudinary/log/chat.
- JPEG/PNG/WebP; tối đa 280 KB client và 300 KB API sau nén.
- Sau khi chọn ảnh, người dùng có thể khai báo tối đa 8 thành phần đã biết bằng tên + gram. Danh sách
  rỗng vẫn được phép khóa để không buộc người dùng đoán; hàng nhập dở dang hoặc gram ngoài 1–3000 bị chặn.
- Nút phân tích chỉ mở sau khi danh sách khai báo được khóa. Mọi chỉnh sửa thành phần hoặc đổi ảnh mở
  khóa lại. Trước request provider-bound, UI phải xác nhận rõ một lượt quota sẽ được dùng; hủy không gọi API.
- Kết quả gồm tên món, range calo/P/C/F, điểm cân bằng macro 1–10, thành phần người dùng khai báo tách
  riêng và thành phần AI ước tính với range khẩu phần.
- Gram từng thành phần có thể chỉnh và tổng được tính lại local; không auto-save
  hoặc ghi Daily Journal trong MVP.
- Luôn có disclaimer đây là ước tính từ một ảnh, không thay thế cân thực phẩm,
  nhãn dinh dưỡng hoặc tư vấn y tế.

## API contract

`POST /api/meal-scans/analyze`

- Middleware: `optionalMealScanAuth → csrfProtection → validateMealScanImage →
  mealScanAnonymousLimiter → mealScanLimiter`.
- Request: `{ image: "data:image/...;base64,...", locale?: "vi" | "en", declaredIngredients?:
  [{ name: string, grams: number }] }`. Middleware giới hạn tối đa 8 mục, trim tên tối đa 80 ký tự và
  chỉ nhận gram 1–3000 trước khi request có thể tiêu quota.
- Response: `{ success: true, data: MealScanResult, meta: { quota: { serviceKey, tier, limit, remaining,
  resetAt } } }`, header `Cache-Control: private, no-store`. Lỗi 429 trả cùng `meta.quota`.
- Non-production Meal Scan mặc định trả mock deterministic, độc lập với AI_PROVIDER toàn cục;
  MEAL_SCAN_PROVIDER=gemini chỉ là opt-in test local có kiểm soát. Runtime production luôn dùng
  AI_PROVIDER=gemini và fail closed nếu thiếu Paid Service/config hoặc output sai. Riêng
  APP_ENV=staging được phép đặt MEAL_SCAN_PROVIDER=mock để không gửi ảnh thử nghiệm tới Gemini khi
  project chưa có billing; override này không có hiệu lực ở production.
- Không tạo model, collection, migration hoặc retention job.

```js
{
  mealName,
  confidence: "high" | "medium" | "low",
  confidenceReasons: [],
  imageAssessment: {
    status: "ok",
    foodVisible: true,
    quality: "good" | "usable" | "poor",
    scenario: "plated_meal" | "shared_meal" | "packaged_food" | "drink" | "dessert" | "unknown",
    servingsVisible,
    nutritionLabelVisible,
    barcodeVisible,
    issues: []
  },
  total: {
    calories: { min, estimate, max },
    protein: { min, estimate, max },
    carb: { min, estimate, max },
    fat: { min, estimate, max }
  },
  declaredIngredients: [{
    name, grams,
    status: "included" | "unresolved",
    includedInTotal,
    sourceType: "macro_formula" | "food_database" | "unresolved",
    calories?, protein?, carb?, fat?
  }],
  items: [{
    id,
    label,
    portionGrams: { min, estimate, max },
    calories: { min, estimate, max },
    protein: { min, estimate, max },
    carb: { min, estimate, max },
    fat: { min, estimate, max },
    note,
    needsConfirmation,
    dataSource: "visual_estimate" | "nutrition_label"
  }],
  questions: [],
  disclaimer,
  allergyDisclaimer
}
```

Backend chuẩn hóa range, giới hạn item và tự cộng `total` từ item. AI chỉ ước
tính thành phần/khẩu phần/dinh dưỡng, không phải nutrition source canonical.
`MEAL_SCAN_NO_FOOD` và `MEAL_SCAN_RETAKE_REQUIRED` trả `422`; lỗi provider tạm thời được retry một
lần trong deadline rồi mới trả contract lỗi generic. Shared/multi-serving luôn bị ép `low`.

## UI states

Idle; selected/preview; declared-ingredient editing; declared-ingredient locked; quota confirmation;
compressing/analyzing; result; error/retry.

## SEO và discoverability

- SEO canonical `/quet-mon-an`; JSON-LD `WebApplication` + `FAQPage`.
- Có trong sitemap, prerender và `llms.txt`.
- Internal links tới `/tdee-calculator`, `/mealplan`,
  `/cong-thuc-nau-an`.
- HT Assistant biết và dẫn link tới page, không nhúng Meal Scan vào chat.

## Boundaries

### Always

Optional auth, CSRF, anonymous per-IP + authenticated per-user rate limit, payload bound, no-store,
không log/lưu ảnh, hiển thị range/confidence và page chỉ gọi API qua `client/src/services/`.

### Ask first

Persist ảnh/kết quả, Daily Journal/history, quota theo gói,
tính phí, provider mới hoặc dùng ảnh cho training/human review.

### Never trong MVP

FoodSAM/depth/LiDAR/3D/custom model; nutrition/medical claim canonical; disable
CSRF/rate limit; persist raw ảnh/base64.

## Success criteria

- Route/navbar/SEO/sitemap/prerender đầy đủ.
- API test auth, CSRF, MIME/size, provider output và deterministic mock.
- Gemini dùng structured JSON + timeout.
- UI đủ loading/error/retry/auth, ingredient lock, quota confirmation và chỉnh gram tính lại tổng.
- Focused tests, lint/build, AI/SEO/UI/security gates phù hợp pass.

## Calibration contract

- The provider must return `scaleReferenceVisible`; a plate or bowl alone is not a trusted scale.
- Model-claimed scale can raise an estimate only to `medium` in the MVP. `high` requires a future externally verified reference contract.
- Missing scale forces `low` confidence and a bounded uncertainty floor while preserving the point estimate.
- Benchmark holdouts must exclude previously evaluated dish IDs and must not persist raw images or base64.
- Beta quality remains blocked until point-estimate and ingredient-recall gates pass on a weighed Vietnamese phone-photo dataset.

## Global cuisine and review contract

- Cuisine is open-world and independent from locale. `vi`/`en` controls every user-visible text
  field, not which dishes may be recognized.
- Provider classifies the image as plated meal, shared meal, packaged food, drink, dessert or
  unknown; non-food and unusable images fail closed with a retake action.
- Shared meals, hidden fillings, desserts and unreadable labels force low confidence and targeted
  questions. A readable nutrition label may be marked as label evidence; barcode presence alone
  is not nutrition data.
- User review remains local-only: declare known ingredients before analysis and adjust estimated grams
  after analysis. Rename/exclude/Food DB/barcode review controls are not rendered in the simplified result.
- Existing Food records are per-100-g references but are not canonical for Meal Scan until source,
  version and commercial license provenance are audited. AI estimates remain visibly separate.
- Synthetic proxy images measure recognition only. Beta macro gates require locked, weighed,
  real phone-photo holdouts across Vietnamese/Asian, Western, bakery/dessert, drink, packaged and
  shared-meal strata.
- No allergy, gluten-free or medical-safety guarantee may be inferred from a photo.

## Food provenance and packaged-food contract

- Existing Food documents without provenance are `legacy_unknown`; the system must never infer their
  source, version or license. All values remain per 100 g.
- New or upgraded Food records carry source type, provider, external ID, dataset version, license,
  attribution and verification/retrieval timestamps. This metadata does not make nutrition canonical.
- Product lookup API accepts a validated GTIN server-side behind auth and rate limit; API keys never
  reach the client. The simplified Meal Scan UI does not expose barcode decoding or lookup controls.
- Lookup order is USDA FoodData Central, then explicitly enabled Open Food Facts fallback. Results are
  read-only API references and are never persisted automatically.
- USDA references carry CC0 attribution. Open Food Facts references remain isolated as ODbL data with
  visible attribution; they are not merged into the canonical Food collection without legal review.
- A barcode identifies a product but is not nutrition evidence. A readable nutrition panel and serving
  basis override visual/barcode estimates when the user provides the label image.
- Meal images may reach Gemini only through a Cloud project confirmed as a Paid Service for the alpha;
  unpaid Gemini API is not approved for customer images. No additional OCR provider is added in Plan 025.
- Runtime fail-closed unless `GEMINI_PAID_SERVICE_CONFIRMED=true`. Packaged lookup is separately
  controlled by `FOOD_REFERENCE_LOOKUP_ENABLED`; USDA requires backend-only `FDC_API_KEY`, while
  `OPEN_FOOD_FACTS_ENABLED` only enables the attributed fallback. Provider calls have timeout and
  response-size caps; no provider hostname or API key is client-controlled.

## Anonymous access and presentation contract

- Anonymous analysis requires the existing CSRF mechanism and server image validation. Invalid
  payloads do not spend quota; every provider-bound request, including a `422` non-food result, does.
- Anonymous limit là 2 requests/24 giờ theo normalized IP; user thường 3 requests/24 giờ; coaching customer
  và HLV 10 requests/24 giờ theo user ID. Lượt vượt quota dừng trước controller/provider và không tạo wallet ledger. Limiter dùng
  ephemeral in-memory store và không persist/log raw IP; horizontal scaling cần shared privacy-reviewed
  store.
- Barcode/external packaged-food lookup remains authenticated and is not rendered in the simplified result;
  anonymous users may declare ingredients before analysis and adjust portions locally afterward.
- Hero highlights calories/macros with the solid brand accent. The unified guide appears before the
  tool; each of its three steps integrates the matching accuracy guidance. A separate why-try rail explains
  speed, controlled estimates and privacy; upload/result Step 01/02 labels use pill styling.
## Declared ingredients and simplified result contract

- Thành phần người dùng khai báo là context có thể sai và không phải bằng chứng ảnh. Backend chỉ tính
  mục pure-fat được quy đổi 9 kcal/g hoặc mục khớp Food DB `per_100g` có provenance đã biết; mục còn lại
  phải trả `unresolved` và UI ghi rõ “Chưa tính vào tổng”. Client không được gửi macro làm nguồn tính.
- Declared item đã resolve được cộng dưới dạng exact range vào min/estimate/max sau khi AI range được
  calibration. Provider phải loại declared items khỏi output để giảm double count; backend vẫn là nguồn
  cộng total và client phải giữ declared totals khi người dùng chỉnh portion AI items.
- Danh sách này chỉ tồn tại trong React state và request hiện tại; backend không persist và không log raw
  tên/gram. Kết quả hiển thị chúng dưới “Thành phần bạn khai báo”, tách khỏi “Thành phần AI ước tính”.
- Primary result không render `MealScanReviewPanel`, barcode/Food DB provenance hoặc raw technical copy.
  Confidence vẫn tồn tại trong API/calibration nhưng badge chính được thay bằng điểm cân bằng macro.
- Điểm cân bằng macro dùng năng lượng 4 kcal/g protein, 4 kcal/g carbohydrate và 9 kcal/g fat; từng tỷ lệ
  được so với adult AMDR protein 10–35%, carbohydrate 45–65%, fat 20–35%, rồi quy đổi deterministic về
  1–10. Đây chỉ là heuristic của một bữa, không phải điểm sức khỏe, chẩn đoán hoặc target cá nhân.
- UI tiếng Việt dùng “Chất đạm”, “Tinh bột”, “Chất béo”; icon “Kết quả ước tính” là biểu đồ thống kê.
- Dòng min–max được gọi rõ là “Khoảng có thể từ ảnh”; đây là uncertainty interval, không phải mục tiêu
  calo. Thành phần khai báo đã tính và chưa tính phải có trạng thái riêng ngay trong kết quả.
