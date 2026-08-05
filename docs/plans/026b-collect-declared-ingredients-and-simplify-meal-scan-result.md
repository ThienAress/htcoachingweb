# Plan 026B: Thu thập thành phần khai báo và đơn giản hóa kết quả Meal Scan

> **Hướng dẫn thực thi**: Giữ nguyên privacy, CSRF và quota của Plan 026A. Thành phần người dùng
> khai báo chỉ được gửi cùng request phân tích, không persist và không log. Mỗi bước phải pass focused
> tests trước khi chuyển bước; không deploy, commit, push hoặc gọi Gemini live.
>
> **Drift check**: `MealScan.jsx` đang gọi `analyzeMeal(image, locale)`, middleware chỉ tạo
> `{ mimeType, base64, locale }`, và `MealScanResult.jsx` đang render confidence badge + review panel.
> Nếu ba contract này thay đổi trong lúc thực thi thì dừng và re-trace trước khi sửa tiếp.

## Status

- **Execution**: IMPLEMENTED / LOCAL VERIFIED — FULL E2E BASELINE FAILURE OUTSIDE SCOPE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED (health copy, quota confirmation và dữ liệu khai báo trong provider prompt)
- **Depends on**: 026A
- **Category**: feature / UX / API / tests
- **Planned at**: 2026-08-04

## Why This Matters

Luồng hiện tại cho phép gọi provider ngay sau khi chọn ảnh, trong khi người dùng chưa có cơ hội cung cấp
dầu, sốt hoặc thành phần bị che. Kết quả còn hiển thị confidence và provenance kỹ thuật khó hiểu. Luồng mới
buộc người dùng rà soát thông tin trước request, xác nhận rõ một lượt quota sẽ được dùng, sau đó trình bày
kết quả ngắn gọn với thành phần khai báo tách khỏi thành phần AI ước tính.

## Current State

- `client/src/pages/MealScan/MealScan.jsx` sở hữu ảnh, request, kết quả và review state.
- `client/src/pages/MealScan/MealScanUploader.jsx` chỉ disable CTA khi chưa có ảnh hoặc đang busy.
- `client/src/pages/MealScan/MealScanResult.jsx` render confidence badge, raw reasons, questions,
  `MealScanReviewPanel`, disclaimer và action row.
- `client/src/services/mealScan.service.js` gửi `{ image, locale }`.
- `server/src/middlewares/mealScanImage.js` validate ảnh/locale trước quota và tạo `req.mealScanImage`.
- `server/src/services/mealScan.provider.js` gửi ảnh cùng prompt calibration sang Gemini.
- Không có schema/model/storage cho Meal Scan; boundary này phải được giữ nguyên.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused client tests | `npm run test --prefix client -- --run src/pages/MealScan/__tests__/mealScan.helpers.test.js src/pages/MealScan/__tests__/mealScan.declaredIngredients.test.js src/services/__tests__/mealScan.service.test.js` | exit 0 |
| Focused server tests | `npm run test --prefix server -- --run src/routes/__tests__/mealScan.routes.integration.test.js src/services/__tests__/mealScan.service.test.js src/services/__tests__/mealScanProviderContract.test.js` | exit 0 |
| Client compile | `npx vite build` trong `client/` | exit 0 |
| Meal Scan E2E | `npx playwright test e2e/meal-scan.spec.js --project=chromium` | exit 0 khi dev servers sẵn sàng |

## Scope

**In scope**:

- Meal Scan page/components/helpers và vi/en copy.
- Client service request contract.
- Server request validation, service/provider prompt plumbing.
- Focused client/server/E2E tests.
- Spec và plan index.

**Out of scope**:

- Schema, DB, history, Daily Journal, wallet, billing, quota values hoặc provider mới.
- Deploy, Gemini live call, migration, commit hoặc push.
- Cá nhân hóa điểm theo bệnh lý, mục tiêu tập luyện hoặc chế độ ăn.

## Steps

### Step 1: Khóa contract bằng test

- Thêm unit tests cho khai báo thành phần và điểm cân bằng macro.
- Cập nhật service/integration/provider tests để chứng minh danh sách đã sanitize đi xuyên request nhưng
  không xuất hiện trong log/storage.
- Cập nhật E2E để CTA bị khóa, cần khóa thông tin, hiện confirmation và chỉ gọi API sau đồng ý.

**Verify**: focused client/server tests phải fail đúng các behavior chưa implement.

### Step 2: Thêm pre-analysis ingredient gate

- Sau khi chọn ảnh, render form tên thành phần + gram; cho phép khóa danh sách rỗng nếu người dùng không biết.
- Mọi chỉnh sửa hoặc đổi ảnh mở khóa lại và disable CTA.
- Trước provider-bound request, mở dialog xác nhận một lượt quota; hủy dialog không gọi API.

**Verify**: focused client tests + Meal Scan E2E.

### Step 3: Gửi context qua API an toàn

- Request nhận tối đa 8 phần tử `{ name, grams }`, tên tối đa 80 ký tự, gram 1–3000.
- Middleware normalize trước limiter/controller; provider prompt coi đây là dữ liệu người dùng khai báo,
  không phải bằng chứng ảnh hay nguồn dinh dưỡng canonical.
- Không log raw danh sách và không persist.

**Verify**: route integration + service/provider contract tests.

### Step 4: Rút gọn kết quả và Việt hóa

- Đổi Protein/Carb/Fat thành Chất đạm/Chất bột đường/Chất béo ở tiếng Việt.
- Dùng icon biểu đồ cho “Kết quả ước tính”.
- Thay confidence badge bằng “Điểm cân bằng macro X/10”; tính từ tỷ lệ năng lượng P/C/F và ghi rõ đây
  là heuristic tham khảo, không phải điểm sức khỏe.
- Tách “Thành phần bạn khai báo” và “Thành phần AI ước tính”; bỏ review/provenance kỹ thuật khỏi result.

**Verify**: helper tests, i18n parse, client compile và E2E responsive.

### Step 5: Re-trace và QA

- Re-run `rg` cho request payload, confidence labels, review panel và quota CTA.
- Chạy QA client theo skill, `git diff --check`, scoped lint và cập nhật evidence/status plan.

## Test Plan

- Empty/partial/valid declared ingredient rows; max count, trim và gram bounds.
- Macro score: balanced, high-fat imbalance và zero-data fallback.
- API accepts sanitized list, rejects malformed/oversized list before quota, and forwards exact normalized data.
- Provider prompt labels declarations as user-provided context.
- UI: analyze disabled until locked; edit relocks; cancel confirmation sends no request; agree sends one request;
  declared section renders separately in result; mobile has no horizontal overflow.

## Done Criteria

- [x] Analyze CTA chỉ mở khi ảnh có sẵn và ingredient state đã khóa.
- [x] Confirmation xuất hiện trước mọi provider-bound attempt; cancel không gọi API.
- [x] Declared ingredients đi xuyên API an toàn, không persist/log và hiển thị riêng trong kết quả.
- [x] Result không còn confidence badge/review Food DB/provenance kỹ thuật.
- [x] Điểm macro 1–10 deterministic, có nhãn giới hạn rõ ràng.
- [x] Focused tests, client QA, E2E phù hợp và `git diff --check` pass.
- [x] Không deploy/commit/push/provider live call.

## Verification Evidence

- TDD RED: client thiếu helper/score/payload; server chưa normalize/forward declarations và provider prompt
  chưa có context. GREEN: focused client 10/10, focused server 23/23.
- Scoped ESLint: exit 0. UI anti-slop scan: không có gradient text, bounce/elastic, purple-blue,
  side-stripe, arbitrary z-index hoặc hidden-by-default content trong các file Meal Scan đã sửa.
- Visual browser check: desktop 5/12–7/12, locked state, disabled/enabled CTA; mobile dialog vừa viewport,
  focus mặc định vào hành động quay lại và không submit khi hủy.
- Meal Scan E2E Chromium: 6/6 pass, gồm cancel không gọi API, đồng ý gọi đúng một request,
  declared/estimated sections và mobile overflow.
- Release build: exit 0; Vite compile pass, prerender 38/38, bundle budget pass. Dynamic content fetch có
  timeout warning nhưng fallback giữ sitemap hiện có và build vẫn pass.
- Client suite: 53 files, 259/259 tests pass. Server suite: 100 files, 453/453 tests pass.
- Full E2E: 67/68 pass; Meal Scan 6/6 pass. Một failure ngoài scope ở Today Dashboard do test kỳ vọng
  `/exercises` trong khi UI dùng `/exercises/`; không sửa vì không liên quan Plan 026B. Vì vậy QA full
  không phải release evidence hợp lệ.
- AI tool validation: 11/11 pass. Secret scan pass. Repository data-boundary: 0 violations.
- Không deploy, commit, push, provider live call, schema/migration, wallet hoặc billing mutation.
## STOP Conditions

- Cần lưu thành phần hoặc kết quả vào DB/history.
- Cần thay quota, wallet hoặc billing để hoàn tất UI.
- Provider phải coi khai báo là nutrition ground truth thay vì context có thể sai.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Adult AMDR chỉ là tham chiếu phân bố năng lượng theo chế độ ăn tổng thể; score trên một bữa là product
  heuristic và không được đổi thành medical/health claim.
- Nếu sau này có macro target cá nhân canonical, score nên dùng target đó thay vì heuristic chung.
- `confidence` vẫn giữ trong API cho calibration/quality gate, chỉ không dùng làm badge chính trên UI.
