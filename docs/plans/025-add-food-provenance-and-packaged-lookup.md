# Plan 025: Thêm provenance Food DB, packaged-food lookup và authenticated Meal Scan E2E

> **Trạng thái**: COMPLETE / LOCAL VERIFIED — LIVE CONFIG & REAL HOLDOUT PENDING
>
> **Drift check**: Working tree đang dirty bởi nhiều task khác. Chỉ sửa Food provenance,
> Meal Scan barcode/reference, E2E và tài liệu 025; không sửa contract/subscription/chat ngoài scope.

> **Superseded UI note (2026-08-05)**: Plan 026B replaced the post-analysis review surface with the
> declared-ingredient gate requested by the product owner. The current release retains Food provenance
> and the authenticated read-only GTIN lookup API, but removes the unreachable ZXing/barcode review
> client and its dependencies. Reintroducing packaged lookup requires a new backend-authoritative
> selection contract; the client must not submit nutrition values as canonical totals.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (schema compatibility, external data license, image privacy)
- **Depends on**: 024A
- **Category**: data / API / privacy / tests
- **Planned at**: 2026-08-04

## Why This Matters

`Food` hiện chỉ có tên và macro/100 g nên không thể chứng minh nguồn, phiên bản hay license. Meal
Scan cũng chưa có đường an toàn để dùng barcode của thực phẩm đóng gói. Plan này giữ record cũ là
`legacy_unknown`, bổ sung reference lookup không persistence và khóa workflow bằng E2E có auth local.

## Current State

- `server/src/models/Food.js:4-29` chỉ chứa `label`, `protein`, `carb`, `fat`, `calories`.
- `server/src/controllers/food.controller.js:73-168` cho create/batch mà không nhận provenance.
- `client/src/pages/admin/FoodManagement.jsx:138-173` gửi form/batch chỉ gồm macro.
- `client/src/pages/MealScan/MealScanReviewPanel.jsx` chỉ tìm Food DB hiện có.
- `playwright.config.js:27-46` đã có Vite + mock API local; `e2e/auth.spec.js:8-17` có auth actor
  deterministic qua `x-e2e-role`, không cần credential thật.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Client dependency | `npm install --prefix client @zxing/browser` | package/lock update, exit 0 |
| Focused server | `cd server && npx vitest run <food-reference tests>` | exit 0 |
| Focused client | `cd client && npx vitest run <Meal Scan tests>` | exit 0 |
| E2E | `npx playwright test e2e/meal-scan.spec.js --project=chromium` | exit 0 |
| Full QA | root client/server tests + release build | exit 0 |

## Scope

**In scope**:

- Backward-compatible provenance fields cho `Food`; new writes phải khai báo source.
- Read-only audit script; không backfill/write database.
- Server-side GTIN lookup: USDA FoodData Central trước, Open Food Facts fallback; không persistence.
- Browser-local barcode decode bằng ZXing lazy import; UI thêm reference vào review local-only.
- Auth/rate-limit/validation/error contract và focused integration/unit/E2E tests.
- Gemini paid-plan privacy gate trong docs/config checks; không thêm OCR provider mới.

**Out of scope**:

- Chạy migration/seed, sửa record production, gọi staging/production API, deploy/commit/push.
- Gọi Food DB hoặc external lookup là nutrition canonical.
- Lưu barcode, ảnh nhãn, ảnh món, kết quả scan hoặc tự upload ảnh lên Open Food Facts.
- GS1 enterprise API, Google Cloud Vision hoặc paid OCR integration.

## Steps

### Step 1: Add backward-compatible Food provenance

Thêm `nutritionBasis=per_100g` và nested `source` với default `legacy_unknown`. Create/batch mới phải
gửi source; update giữ source hiện tại nếu không đổi macro và yêu cầu source khi nâng cấp legacy data.
Admin UI hiển thị/nhập source; Meal Scan note phải phản ánh đúng attribution.

**Verify**: model/controller/validation tests cover legacy, valid source và invalid source.

### Step 2: Add read-only barcode reference lookup

Tạo route `GET /api/food-references/barcode/:gtin` theo route → controller → service. Route phải
`protect`, rate-limit, validate GTIN/check digit, gọi provider server-side, normalize per 100 g,
không log/persist payload. USDA key nằm ở `FDC_API_KEY`; OFF chỉ chạy khi flag cho phép.

**Verify**: provider mocks cover USDA, OFF fallback, missing macro, timeout/error và disabled config.

### Step 3: Add local barcode decode and review UX

ZXing chỉ lazy-load khi user chọn ảnh barcode. Component gọi hook; hook gọi service; result được thêm
như external reference local-only với source/license/attribution rõ. Loading/error/disabled/a11y đầy đủ.

**Verify**: helper/hook contract tests, client lint/build.

### Step 4: Add authenticated local E2E

Tạo `e2e/meal-scan.spec.js` dùng actor mock, intercept analysis deterministic và ảnh fixture runtime.
Cover auth result, review gate, non-food/error và mobile overflow; không gọi Gemini/DB thật.

**Verify**: Chromium E2E file pass.

### Step 5: Integrated QA and cleanup

Re-trace schema/API consumers; chạy release build, client/server tests, E2E, security/data-boundary,
agents validation và `git diff --check`. Ghi rõ warning/blocker ngoài scope.

## Test Plan

- Schema defaults không đổi semantics document cũ; source enum và field lengths fail closed.
- Create/batch source required; update macro của legacy record không được âm thầm thành verified.
- GTIN 8/12/13/14 check digit; provider ordering và normalization kcal/P/C/F trên 100 g.
- Không external call khi feature disabled; API key không đi xuống client/log.
- Barcode UI: unsupported image/no code/provider error/success reference.
- E2E: auth upload → result → review → confirm; 422 non-food; mobile 390 px.

## Done Criteria

- [x] Record cũ hiển thị `legacy_unknown`; không migration/write production.
- [x] Record mới có source/version/license; client/API contract đồng bộ.
- [x] Barcode decode local; lookup server-side; external result không persist.
- [x] OFF attribution/license hiển thị; USDA CC0 metadata nằm trong reference local-only.
- [x] Gemini Paid Service là runtime + production-readiness gate fail-closed.
- [x] Authenticated Meal Scan E2E local pass; không deploy.
- [x] QA/security/cleanup gates phù hợp pass.

## Completion Evidence — 2026-08-04

- Focused server: Food provenance + provider/config/route lookup `34/34` tests pass.
- Full unit: client `253/253`; server `445/445`.
- Authenticated Meal Scan Chromium E2E `3/3`: upload/review/confirm + barcode reference,
  `422` retake và mobile 390 px không overflow.
- Client lint exit `0`; có một warning cũ ở `Pricing.jsx` ngoài scope, không có lint error.
- Vite production compile pass; prerender `785/785` và bundle budget pass. Meal Scan route chunk
  khoảng `43.2 kB` raw; ZXing nằm trong lazy route chunk riêng.
- Secret scan, repository data-boundary, client dependency policy, AI tool validation và agent
  instruction validation đều pass; `git diff --check` không có whitespace error.
- Không chạy provenance audit trên live DB, migration/seed, external provider live call, deploy,
  commit hoặc push. Production vẫn cần cấu hình key/flags và xác nhận project Gemini Paid Service.

## STOP Conditions

- Cần suy đoán provenance record cũ hoặc ghi/backfill dữ liệu thật.
- Cần đưa OFF vào canonical MongoDB mà chưa có legal review ODbL.
- Cần external key/Cloud billing mutation hoặc nới auth/CSRF/rate limit.
- Cần deploy, commit, push hoặc production alpha.

## Maintenance Notes

- USDA FDC là CC0 nhưng độ phủ branded ngoài Mỹ có giới hạn; label đọc được vẫn ưu tiên hơn barcode.
- OFF là crowdsourced/ODbL; giữ provider boundary và attribution, không merge im lặng với Food DB.
- Nếu OCR benchmark về sau fail, đánh giá Cloud Vision trong plan riêng thay vì thêm provider tại đây.
