# Plan 026C: Tính thành phần khai báo vào tổng Meal Scan

> **Hướng dẫn thực thi**: Chạy từng bước và chỉ deploy staging khi toàn bộ release gate bắt buộc pass.
> Không deploy production, không chạy migration/seed/cleanup và không gọi Gemini live trong local QA.
>
> **Drift check**: `analyzeMealImage` phải vẫn tách mock/Gemini trong
> `server/src/services/mealScan.service.js`; `applyPortionAdjustments` vẫn tự tính lại total từ items;
> `MealScanResult` vẫn hiển thị declared ingredients từ React state. Nếu khác, dừng và trace lại contract.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 026B
- **Category**: bug
- **Planned at**: 2026-08-05
- **State**: RELEASE CANDIDATE VERIFIED — STAGING PENDING

## Why This Matters

Meal Scan đang nhận và hiển thị dầu/thành phần người dùng khai báo nhưng không cộng chúng vào calo,
macro hoặc điểm cân bằng. Với dầu 30 g, kết quả mock hiện vẫn giữ 625 kcal và 14,6 g fat thay vì cộng
xấp xỉ 270 kcal và 30 g fat. Đây là lỗi correctness trên dữ liệu dinh dưỡng và phải được sửa trước staging.

## Current State

- `server/src/services/mealScan.service.js:80-103` chuyển declared ingredients cho Gemini nhưng mock bỏ qua.
- `server/src/services/mealScan.provider.js:158-167` coi declared ingredients là context, chưa khóa chống trùng.
- `server/src/services/mealScanResult.js:166-170` chỉ cộng total từ AI items.
- `client/src/pages/MealScan/mealScan.helpers.js:36-67` khi chỉnh portion chỉ cộng lại AI items.
- `client/src/pages/MealScan/MealScanResult.jsx:160-181` chỉ in tên/gram khai báo.
- Food DB dùng basis `per_100g`; chỉ record có provenance khác `legacy_unknown` được dùng để tính.

## Commands You Will Need

| Purpose | Command | Expected |
|---|---|---|
| Server focused | `cd server && npx vitest run src/services/__tests__/mealScanDeclaredIngredients.test.js src/services/__tests__/mealScan.service.test.js src/services/__tests__/mealScanProviderContract.test.js` | exit 0 |
| Client focused | `cd client && npx vitest run src/pages/MealScan/__tests__/mealScan.helpers.test.js` | exit 0 |
| Meal Scan E2E | `npx playwright test e2e/meal-scan.spec.js --project=chromium` | exit 0 |
| Release QA | `npm run test:unit && npm run build --prefix client && npm run test:e2e` | exit 0 |
| Governance | `npm run security:secrets && npm run security:data-boundaries && npm run agents:validate` | exit 0 |

## Scope

**In scope**:

- Meal Scan spec/plan.
- Server resolver/merger cho declared ingredients và tests.
- Gemini prompt chống cộng trùng.
- Client total recalculation, result copy/UI và Meal Scan E2E.
- Full working-tree release gates; preserve SEO, TanStack Query, Chat, Contract/Auth changes đã có.

**Out of scope**:

- Mongoose schema, migration, seed hoặc sửa dữ liệu Food thật.
- Lưu ảnh/kết quả/thành phần vào DB.
- Thay uncertainty multipliers khi chưa có weighed holdout.
- Deploy production hoặc gửi Search Console.

## Steps

### Step 1: Khóa regression bằng test đỏ

- Dầu 30 g phải tạo exact range 270 kcal, 30 g fat.
- Food DB verified `per_100g` phải scale theo gram; legacy/unknown không được tính.
- Mock và Gemini phải merge declared totals giống nhau.
- Chỉnh AI portion không được làm mất declared totals.
- Prompt phải yêu cầu không trả item trùng declared ingredients.

### Step 2: Thêm server-authoritative resolver

- Chỉ nhận `{ name, grams }` từ client.
- Resolve nhóm pure fat bằng công thức 9 kcal/g; fallback exact-label Food DB có provenance.
- Unknown trả `status=unresolved`, `includedInTotal=false`; không fail toàn scan.
- Merge exact declared ranges vào min/estimate/max sau calibration và trả declared breakdown.

### Step 3: Đồng bộ UI và local recalculation

- Hiển thị “Đã tính vào tổng” cùng kcal/P/C/F hoặc “Chưa tính vào tổng”.
- Gọi range là “Khoảng có thể từ ảnh”, không trình bày như mục tiêu dinh dưỡng.
- Macro score và mọi chỉnh portion dùng total gồm declared ingredients.
- Giữ loading/error/disabled/mobile/a11y states hiện có.

### Step 4: Verify và release gate

- Chạy focused tests, full QA, UI/SEO/AI/security/agent gates.
- Chỉ khi Ship kết luận GO mới commit/push toàn release candidate lên `staging` một lần.
- Chờ Netlify/Render đúng SHA rồi chạy staging health/security và Meal Scan smoke read-only.

## Done Criteria

- [x] Dầu 30 g được cộng vào total và điểm macro ở mock lẫn Gemini flow.
- [x] Unknown ingredient có cảnh báo rõ, không âm thầm bị coi là đã tính.
- [x] Không cộng trùng declared ingredient với AI items theo prompt/contract.
- [x] Chỉnh portion giữ declared totals.
- [x] Full release gates không còn BLOCK/HIGH.
- [ ] Staging frontend/backend live đúng cùng candidate SHA và smoke pass.
- [x] Không deploy production, không migration/seed/cleanup, không commit `.vscode/`.

## Verification Evidence — 2026-08-05

- Focused regression: client `5 files / 17 tests` và server `8 files / 53 tests` pass; dependency-focused
  server rerun `3 files / 24 tests` pass sau khi cập nhật transitive security patches.
- Full unit/integration: client `50 files / 250 tests`; server `101 files / 460 tests` pass.
- Release build: Vite `2.807 modules`, prerender `785/785` routes và bundle budget pass; Meal Scan
  route khoảng `38,8 kB` raw. Dynamic API timeout dùng fallback và không làm mất sitemap route.
- Full Chromium E2E `68/68` pass; Meal Scan riêng `6/6`, gồm anonymous/auth quota, declared ingredient,
  result total/score, stable `422` và viewport 390 px.
- Client lint exit `0` với một warning React đã có ở HEAD trong `Pricing.jsx`; không có lint error.
- Secret scan pass; repository data-boundary `0` vi phạm; commercial contract, ops `17/17`, AI tools
  `11/11` và agent validation pass.
- Client dependency policy pass với waiver RSC đã review; server dependency audit và `npm audit`
  đều `0` vulnerability sau khi nâng transitive `fast-uri 3.1.5`, `ip-address 10.4.0` và
  `brace-expansion 5.0.9` trong lockfile.
- SEO invariants: sitemap `785` URL, không duplicate/query/hash, mọi public path có trailing slash và
  `/quet-mon-an/` có canonical, prerender, sitemap cùng internal links từ navbar/footer.
- Không gọi Gemini/Food provider live, không migration/seed/cleanup và chưa deploy production.

## STOP Conditions

- Food DB phải được sửa dữ liệu hoặc chạy migration mới giải quyết được.
- Không xác định được staging branch/target/credential hoặc candidate chứa secret/data thật.
- Test/release gate fail ba vòng cùng một root cause.
- Netlify và Render không thể deploy cùng candidate SHA mà cần thao tác production.

## Maintenance Notes

- Chỉ mở rộng alias/formula khi có quy tắc dinh dưỡng rõ; không đoán macro cho tên tự do.
- Thay đổi uncertainty multipliers phải dựa trên weighed holdout riêng.
- Khi thêm selection Food DB ở UI, backend vẫn phải lookup lại và không tin macro từ client.
