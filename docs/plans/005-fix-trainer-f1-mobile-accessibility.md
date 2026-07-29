# Plan 005: Khôi phục accessibility gate cho Trainer và F1 mobile

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 004
- **Category**: bug | tests | accessibility
- **Planned at**: 2026-07-29
- **Status**: IMPLEMENTED / VERIFIED

## Why This Matters

Full E2E sau Plan 004 phát hiện critical `button-name` violation. Test mang tên F1 không được cấp
entitlement nên bị `F1Route` redirect sang `/trainer`; nó vừa bỏ sót màn F1 thật, vừa phát hiện nút
mở sidebar của Trainer mobile không có accessible name. Cần sửa cả production control và test
fixture để accessibility gate phản ánh đúng hai màn hình.

## Current State

- `client/src/layouts/TrainerLayout.jsx:78-89` render sidebar chưa có `id`.
- `client/src/layouts/TrainerLayout.jsx:178-183` render icon-only menu button không có
  `aria-label`, `aria-expanded` hoặc `aria-controls`.
- `e2e/accessibility.spec.js:4-12` chỉ inject `x-e2e-role`.
- `e2e/mock-api.cjs:110-129` chỉ trả F1 entitlement khi request có
  `x-e2e-trainer-access: true`.
- `F1Route` redirect trainer không entitlement về `/trainer` theo đúng behavior production.

## Scope

**In scope**:

- `client/src/layouts/TrainerLayout.jsx`
- `e2e/accessibility.spec.js`
- `docs/plans/005-fix-trainer-f1-mobile-accessibility.md`
- `docs/plans/README.md`

**Out of scope**:

- Thay đổi F1 entitlement hoặc route guard.
- Thay đổi layout/visual của Trainer sidebar.
- Refactor navigation groups.

## Steps

1. Gắn stable `id` cho Trainer sidebar; thêm `aria-label`, `aria-expanded`, `aria-controls` cho nút
   mở menu và đánh dấu menu icon decorative.
2. Cho helper E2E nhận extra headers; cấp `x-e2e-trainer-access: true` cho F1 accessibility case.
3. Audit cả `/trainer` mobile lẫn `/f1-customers` mobile trong cùng case để khóa hai regression.

## Verification

- `npx playwright test e2e/accessibility.spec.js --project=chromium` → tất cả pass.
- `npm run lint --prefix client` → exit 0.
- Full `npm run test:e2e` → 57/57 pass.
- `git diff --check` → exit 0.

## Done Criteria

- [x] Trainer mobile menu button có accessible name và state/target relationship.
- [x] F1 accessibility test ở đúng `/f1-customers`, không audit nhầm redirect target.
- [x] Trainer và F1 mobile đều không có critical axe violation.
- [x] Full E2E pass.

## Verification Results

- `npx playwright test e2e/accessibility.spec.js --project=chromium` → PASS, 5/5.
- `npm run test:e2e` → PASS, 57/57.
- Client lint và diff check được chạy lại trong cleanup gate → PASS.

## STOP Conditions

- Cần hạ entitlement guard hoặc bypass production auth.
- Axe phát hiện violation khác cần thay đổi business flow/layout ngoài bốn file in-scope.
- Cùng root cause fail ba vòng liên tiếp.
