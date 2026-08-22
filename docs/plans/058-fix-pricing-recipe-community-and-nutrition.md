# Plan 058: Ổn định Pricing và hoàn thiện Recipe community/nutrition

> **Hướng dẫn thực thi**: Follow từng behavior slice và chạy verification trước khi
> chuyển bước. Không ghi staging/production; migration index chỉ được tạo dưới dạng code.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — public UGC, nutrition correctness và checkout presentation
- **Depends on**: 025, 052A, 057
- **Category**: bug / product / data / tests
- **Planned at**: 2026-08-20
- **Status**: DONE / LOCAL VERIFIED

## Why This Matters

Checkout drawer đang làm mất continuity của Pricing: trainer close gây layout jump và
Fitness+ drawer bị transform ancestor giới hạn. Recipe nutrition đang trình bày range quá
phức tạp và chưa có data path cho fibre/sugars/saturates/salt. Rating/comment trước đó chưa
được implement nên production không thể tự hiển thị.

## Current State

- `Pricing.jsx:145-175` khóa body bằng `position: fixed` và tự `scrollTo` khi close.
- `FitnessPlusPlans.jsx:257-268` render fixed drawer dưới `.pricing-panel-enter`, một
  animated transform containing block.
- `FoodManagement.jsx:421-464` hiển thị cột provenance `Nguồn`.
- `RecipeNutritionPanel.jsx` render Minimum/Estimate/Maximum; Food model chỉ có 4 macro.
- Recipe routes chưa có review/rating model, API, service hay UI.

## Scope

**In scope**: modal scroll/portal, ẩn Food source column, optional Food nutrients,
single-value nutrition table, RecipeReview model/API/UI, tests và index migration code.

**Out of scope**: tự đoán nutrient từ ảnh/tên rau, backfill Food production, moderation
dashboard, nested replies, likes hoặc chia nutrition theo serving.

## Steps

### Step 1: Giữ viewport ổn định cho hai checkout drawer

Thay body position lock bằng overflow lock có cleanup; portal Fitness+ drawer ra body.

**Verify**: unit test scroll-lock + Browser: open/close giữ `scrollY`, drawer rect phủ viewport.

### Step 2: Làm gọn dashboard Food và nutrition read-model

Ẩn cột nguồn khỏi list nhưng giữ provenance form/backend. Thêm optional nutrients xuyên
Food schema/validation/controller/admin form và aggregate coverage fail-closed. UI Recipe
chỉ render cột giá trị estimate.

**Verify**: Food integration + recipe nutrition service/client component tests.

### Step 3: Thêm đánh giá sao và bình luận Recipe

Tạo RecipeReview collection/index, route/controller/service và client service/query/component.
Mutation dùng auth + CSRF + limiter; delete ràng buộc `userId`; public DTO không có email.

**Verify**: integration test create/update/list/delete và component markup/copy test.

### Step 4: Integrated QA và visual review

Chạy focused/full gates tương xứng, browser desktop/mobile, UI regression và diff review.

**Verify**: client lint/build, focused server tests, `git diff --check`, browser evidence.

## Done criteria

- [x] Pricing drawer behavior đạt hai acceptance cases.
- [x] Food list không còn cột nguồn; provenance data contract không bị xóa.
- [x] Recipe nutrition dùng một value column và optional nutrients có coverage rõ.
- [x] Review/comment CRUD theo owner hoạt động; public response không lộ PII.
- [x] Tests/lint/build/UI gates pass hoặc blocker được ghi rõ.

## Verification evidence

- Release build: 26/26 staging routes prerendered; bundle budget pass.
- Client unit: 102 files / 478 tests pass; scoped ESLint pass.
- Server unit/integration: 386 suites / 915 tests pass; focused feature set 21/21 pass.
- UI regression: 0 new findings, 0 high-confidence blocking findings.
- Security: secret scan và repository data-boundary scan pass.
- Browser desktop: trainer và Fitness+ drawer đóng với `scrollY` delta bằng 0;
  Fitness+ portal có parent `BODY` và overlay phủ toàn viewport.
- Browser mobile 390 px: nutrition có đúng hai cột, tám nutrient rows, không overflow;
  rating composer và comment list hiển thị dưới phần chế biến.
- Full Playwright E2E: skip vì không có tài khoản/payment fixture an toàn cho flow mua;
  browser QA dùng proxy GET-only, chặn toàn bộ mutation.

## STOP conditions

- Cần backfill/mutation staging-production để optional nutrient xuất hiện.
- Review đòi hỏi anonymous posting hoặc public email/avatar ngoài spec.
- Existing pricing/payment mutation contract phải đổi để fix presentation.

## Maintenance notes

- Không chạy migration index production trong plan này.
- Migration `20260821-recipe-review-indexes.js` mới chỉ được syntax/test contract local;
  cần chạy preflight rồi apply theo đúng target lock trước khi mở review write trên môi trường deploy.
- Optional nutrients chỉ hữu ích sau khi admin/import cung cấp dữ liệu có provenance.
