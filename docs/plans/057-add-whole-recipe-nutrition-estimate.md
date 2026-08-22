# Plan 057: Hiển thị nutrition ước tính cho toàn bộ công thức

> **Hướng dẫn thực thi**: Thêm nutrition read-model cho recipe detail mà không làm
> thay đổi dữ liệu Recipe hiện có hoặc chạy migration. Chỉ tính nguyên liệu có khối
> lượng/quy đổi hợp lệ và Food source đã biết; mọi phần thiếu dữ liệu phải được đánh
> dấu rõ trên UI.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — nutrition correctness và public UI contract
- **Depends on**: 025 Food provenance, current Recipe detail API
- **Category**: product / data / tests
- **Planned at**: 2026-08-20
- **Status**: DONE / LOCAL VERIFIED

## Why This Matters

Recipe hiện chỉ lưu ingredient name + measure text, nên không thể coi mọi con số nutrition
là chính xác. Người dùng cần xem tổng dinh dưỡng của toàn bộ công thức, đồng thời hiểu rõ
nguyên liệu nào đã được tính, nguyên liệu nào chỉ là ước tính và nguyên liệu nào chưa đủ
dữ liệu. Read-model server-side giữ Food DB là nguồn canonical, tránh bịa macro ở client.

## Current State

- `server/src/models/Recipe.js` lưu ingredient `{ name, measure }`, không có servings hoặc nutrition.
- `server/src/models/Food.js` lưu calories/protein/carb/fat theo `per_100g` cùng provenance.
- `server/src/controllers/recipe.controller.js` trả recipe detail public.
- `client/src/pages/RecipeExplorer/RecipeDetail.jsx` có card Ingredients và source note nhưng chưa có toggle.
- `client/src/queries/recipe.queries.js` đã lấy recipe detail qua TanStack Query.

## Scope

**In scope**:

- Server recipe nutrition estimator cho gram, kg, tsp/tbsp với quy đổi có kiểm soát và pure-fat ingredients.
- Response `nutrition` trong recipe detail; unresolved ingredients không được cộng thành zero.
- UI toggle `Nguyên liệu / Dinh dưỡng`, nutrition table cho toàn bộ công thức và warning bên dưới.
- Vietnamese/English copy, focused service/controller/component tests.

**Out of scope**:

- Chia theo khẩu phần hoặc thêm servings/yield vào Recipe.
- Migration/backfill Recipe hoặc Food production.
- Tự nhập nutrition từ client, AI-generated canonical values hoặc arbitrary absorption percentage cho dầu chiên.
- Fibre, sugar, saturates, sodium/salt trước khi Food schema có nguồn cho các field đó.

## Steps

### Step 1: Server read-model và test

Tạo `recipeNutrition.service.js`, resolve ingredient measure thành gram range, lookup Food
provenance và trả totals/items/status. Gắn read-model vào `getRecipeBySlug`; không mở route mới
và không đổi Recipe schema.

**Verify**: service test cover explicit grams, pure-fat oil, unresolved measure và whole-recipe sum;
controller integration test cover `nutrition` response.

### Step 2: Recipe detail nutrition toggle

Tạo `RecipeNutritionPanel.jsx`; thêm tablist accessible trong RecipeDetail. Bảng chỉ render
nutrients có dữ liệu, hiển thị phạm vi estimate và warning rõ rằng đây là tổng toàn bộ công thức.

**Verify**: copy contract test cover whole-recipe warning and optional nutrient labels; scoped ESLint/build
cover the accessible toggle, calculated rows, unresolved warning and empty nutrition state.

### Step 3: Copy, contract và gates

Cập nhật locale recipe, test contract và docs/spec nếu response shape cần ghi rõ. Chạy focused
tests, client build, server tests liên quan, UI regression audit và `git diff --check`.

## Nutrition Contract

```js
nutrition: {
  scope: "whole_recipe",
  status: "calculated" | "estimated" | "partial" | "unavailable",
  total: { calories, protein, carb, fat },
  items: [{ name, measure, grams, status, sourceType, nutrition }],
  unresolvedCount,
}
```

Each nutrient range has `{ min, estimate, max }`. A missing ingredient is represented as
`status: "unresolved"` and is not silently added as zero.

## Done Criteria

- [x] Recipe detail API trả nutrition whole-recipe mà không cần migration.
- [x] Gram/Food source calculations pass independent literal tests.
- [x] UI toggle hoạt động keyboard/a11y cơ bản; warning nằm ngay dưới bảng.
- [x] Không có code client tự bịa nutrition hoặc chia servings.
- [x] Client build và focused server/client tests pass.
- [x] Không còn conflict marker, debug log hoặc file ngoài scope bị sửa ngoài dependency map.

Full server suite đã pass 386 suites / 915 tests trong Plan 058; focused recipe service,
controller và Food integration tests tiếp tục là evidence trực tiếp cho nutrition contract.

## STOP Conditions

- Food DB thiếu provenance hoặc không thể map ingredient an toàn → trả unresolved, không đoán.
- Cần thêm required Recipe field, migration/backfill hoặc absorption percentage chưa có nguồn → dừng và hỏi user.
- API response hiện tại bị consumer khác phụ thuộc shape incompatible → dừng, mở impact review.
