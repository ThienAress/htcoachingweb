# Plan 037: Bật provider đã phê duyệt và hoàn tất production indexes

> **Hướng dẫn thực thi**: Thực hiện tuần tự và chỉ chuyển bước khi verification đạt. Không in secret,
> không bật background jobs, không ép Netlify deploy và không drop/rename index hiện hữu.
>
> **Drift check**: `git status --short --branch` phải chỉ có thay đổi của Plan 037 cùng `.vscode/`
> do user sở hữu. Production phải trả HTTP 200 ở `/live` và `/ready` trước mọi mutation.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 025, 028C, 033
- **Category**: migration / security / operations
- **Planned at**: 2026-08-09
- **Execution**: IN PROGRESS

## Why This Matters

Meal Scan đã deploy nhưng fail closed vì production dùng Gemini Free/Unpaid Tier thay vì Paid Service.
Food Reference đã có route và provider nhưng chưa có FDC key. Đồng thời `autoIndex=false` khiến bốn unique
conversion-origin indexes và năm SEO analytics indexes chưa được bảo đảm trên production. Plan này bật đúng
provider với disclosure rõ ràng, dùng Open Food Facts read-only có attribution, áp index sau preflight và kiểm
thử các luồng production được bảo vệ mà không bật background jobs hoặc ép deploy frontend.

## Current State

- `server/src/services/mealScan.provider.js` chặn ảnh nếu chưa xác nhận data-use mode.
- `client/src/pages/MealScan/MealScanAnalyzeDialog.jsx` là điểm consent ngay trước provider-bound request.
- `server/src/services/foodReferenceLookup.service.js` thử USDA trước rồi Open Food Facts; không persist kết quả.
- `server/src/config/productionReadiness.js` là release gate cho provider flags.
- `server/src/models/conversionOrigin.schema.js` khai báo bốn unique partial indexes.
- `server/src/models/SeoDailyMetric.js` khai báo một unique và hai read indexes;
  `server/src/models/AnalyticsSyncState.js` khai báo một provider unique và một lock/read index.
- `server/src/config/db.js` giữ `autoIndex=false` khi `NODE_ENV=production`.
- Production Render service theo branch `main`; `BACKGROUND_JOBS_ENABLED=false` phải giữ nguyên.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused server | `npm run test --prefix server -- --run src/services/__tests__/mealScanProviderContract.test.js src/config/__tests__/productionReadiness.test.js src/migrations/__tests__/seoConversionIndexes.test.js` | exit 0 |
| Focused client | `npm run test --prefix client -- --run src/pages/MealScan/__tests__/mealScan.privacyCopy.test.js` | exit 0 |
| Index contract | `npm run verify:seo-conversion-indexes` | 9 contracts, exit 0 |
| Full QA | `npm run build --prefix client`, unit client/server và E2E | release evidence hợp lệ |
| Index preflight | `npm run preflight:seo-conversion-indexes --prefix server` | zero duplicate groups/name conflicts |
| Index apply | `npm run migrate:seo-conversion-indexes --prefix server` | nine indexes present/created |
| Production smoke | `npm run smoke:production` | all checks pass |

## Scope

**In scope**:

- Gemini Meal Scan data-use approval, per-request disclosure, readiness tests và docs.
- Open Food Facts-only production configuration khi không có `FDC_API_KEY`.
- Versioned preflight/apply cho chín SEO/conversion indexes, chỉ create/verify.
- Backend deploy, health observation, Google login và protected Admin verification.

**Out of scope**:

- Bật `BACKGROUND_JOBS_ENABLED`.
- Ép Netlify publish lại exact `main` SHA.
- Persist ảnh/kết quả Meal Scan hoặc thay quota 2/3/10.
- Drop index, backfill, seed, cleanup hoặc sửa dữ liệu duplicate.
- Đăng ký USDA key bằng thông tin cá nhân của owner.

## Steps

### Step 1: Cho phép Free/Unpaid Meal Scan với consent rõ ràng

Chấp nhận đúng một trong `GEMINI_PAID_SERVICE_CONFIRMED=true` hoặc
`GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED=true`. Provider vẫn fail closed nếu thiếu/mâu thuẫn. Dialog phải
nói rõ Google có thể dùng submitted data để cải thiện sản phẩm/human review và cảnh báo không gửi dữ liệu nhạy cảm.

**Verify**: focused client/server tests pass; quota/CSRF/upload validation không đổi.

### Step 2: Bật Food Reference qua Open Food Facts read-only

Cho readiness chấp nhận `FOOD_REFERENCE_LOOKUP_ENABLED=true` + `OPEN_FOOD_FACTS_ENABLED=true` khi không có
FDC key. Giữ auth, per-user limiter, GTIN validation, timeout/response-size cap và attribution ODbL.

**Verify**: readiness/service/route tests pass; protected production lookup trả 200/404 hợp lệ, không 503 config.

### Step 3: Preflight và tạo production indexes

Migration lấy manifest từ model schemas, kiểm tra existing-equivalent, name conflict và duplicate groups trước
khi create. Output chỉ có tên collection/index và counts, không có document IDs.

**Verify**: preflight success trước apply; apply chỉ trả `created`/`unchanged`; chạy lại phải idempotent.

### Step 4: Chạy QA và deploy backend theo thứ tự fail-closed

Chạy QA một lần trên exact diff. Promote staging vào main sau GO. Deploy code khi Meal Scan vẫn disabled, sau đó
đặt data-use/food flags và mới bỏ `MEAL_SCAN_PROVIDER=disabled`. Quan sát `/live`, `/ready`, logs và smoke.

**Rollback**: đặt `MEAL_SCAN_PROVIDER=disabled`, `FOOD_REFERENCE_LOOKUP_ENABLED=false`,
`OPEN_FOOD_FACTS_ENABLED=false`; rollback backend commit nếu health/readiness fail. Không drop indexes vừa tạo.

### Step 5: Kiểm thử protected production flows

Xác minh Google OAuth bằng session owner, Admin Service Access read-only, Food Reference authenticated và SEO
Analytics. Chỉ chạy SEO sync sau index apply; kiểm tra success/error contract và không in payload nhạy cảm.

**Verify**: owner vào được protected Admin; non-auth vẫn bị chặn; production smoke tiếp tục pass.

## Test Plan

- Provider blocks when neither mode is approved and allows explicitly accepted unpaid mode.
- Readiness rejects missing/ambiguous approval and accepts OFF-only lookup.
- UI copy contains provider/data-use disclosure in vi/en.
- Migration manifest contains exactly nine named indexes.
- Full client/server suites, release build, E2E and security gates before promotion.

## Done Criteria

- [ ] Meal Scan production gọi Gemini Free/Unpaid chỉ sau explicit per-request consent.
- [ ] Quota 2/3/10, CSRF và upload validation vẫn được enforce.
- [ ] Food Reference production không còn disabled/configuration error.
- [ ] Chín production indexes present, duplicate group count bằng 0 và rerun idempotent.
- [ ] QA/ship gates GO; backend `/live` và `/ready` HTTP 200 sau rollout.
- [ ] Google owner login và protected Admin checks có evidence thật.
- [ ] Background jobs vẫn false; Netlify không bị ép redeploy.

## STOP Conditions

- Preflight thấy duplicate group hoặc index name conflict.
- Production target/environment guard không xác định chính xác.
- Bất kỳ secret nào phải copy ra chat/local file để tiếp tục.
- QA, readiness, `/live` hoặc `/ready` fail sau tối đa ba vòng sửa có căn cứ.
- Google OAuth yêu cầu password/OTP/CAPTCHA mà không có user interaction được phép.

## Maintenance Notes

- Khi chuyển Gemini project sang Paid Service, đặt unpaid acceptance về `false` trước khi paid confirmation thành
  `true`; readiness cố ý chặn cả hai cùng true.
- Open Food Facts là ODbL và phải giữ attribution; không merge dữ liệu vào Food canonical nếu chưa legal review.
- Index migration chỉ create/verify. Rollback application không đồng nghĩa drop index.
