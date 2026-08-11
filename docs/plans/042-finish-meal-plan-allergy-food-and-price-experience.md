# Plan 042: Hoàn thiện dị ứng, Food DB và giá ước tính trong Meal Plan

> Follow-up 2026-08-11: phần tổng chi phí theo bữa/ngày và yêu cầu hai nguồn giá đã được thay thế bởi Plan 045 theo quyết định sản phẩm mới; dữ liệu giá `/100g` vẫn giữ.

> **Hướng dẫn thực thi**: hoàn thành từng vertical slice theo RED → GREEN. Không đổi quota, không chạy
> price backfill production và không deploy nếu chưa có yêu cầu riêng.
>
> **Drift check**: chạy `git status --short --branch`, xác nhận `MealPlan.jsx` vẫn dùng
> `filterFoodsForMealPlan`, `FoodNutritionTable` vẫn nhận `marketPrice`, và Food API vẫn trả `{ success, data }`.

## Status

- **Priority**: P0/P1
- **Effort**: L
- **Risk**: HIGH — allergy filtering, quota-before-generation, price presentation và Saved Meal Plan
- **Depends on**: 040, 041
- **Category**: bug + feature + tests
- **Planned at**: 2026-08-11
- **Approval**: APPROVED — owner yêu cầu xử lý sáu bước sau khi hoàn tất curation Food production
- **Implementation**: COMPLETE — 2026-08-11

## Why This Matters

Meal Plan production đang chặn toàn bộ catalog khi user nhập dị ứng `bò, gà` vì Food legacy thiếu metadata reviewed.
Category enrichment đọc nhầm `food.name` trong khi API canonical dùng `label`, làm category/priority sai và góp phần khiến
generator/custom builder không có lựa chọn phù hợp. UI đồng thời chứa cảnh báo/link/ngân sách owner không muốn giữ và
chưa trình bày giá theo 100g cùng tổng chi phí theo định lượng thực tế.

## Debug evidence và hypotheses

**Bug contract A**: nhập `bò, gà` phải loại các Food bò/gà nhưng vẫn giữ carb/fat/protein khác; hiện tại trả catalog rỗng
và báo “Chưa đủ thực phẩm đã kiểm duyệt”.

- H1 (supported): `filterFoodsForMealPlan()` loại mọi Food không có `allergenProfile.reviewStatus=reviewed`.
- H2 (supported): production Food legacy phần lớn thiếu profile; public API/catalog vẫn có 405 Food usable.
- H3 (supported): `enrichFoodDatabase()` gọi `inferCategory(food.name)` dù response dùng `label`, nên mọi category thành `other`.
- H4 (rejected): Food API không tải; bảng dinh dưỡng cùng phiên vẫn hiển thị dữ liệu.
- H5 (rejected): trial slicing làm rỗng modal; logic slice vẫn phải trả tối đa 10 item nếu input có dữ liệu.

## UI brief

- **Audience**: người Việt tự tạo Meal Plan và cần quét nhanh thực phẩm, macro, giá.
- **Mode**: Product — Operate/Read.
- **Giữ**: nền tối, accent cam, bảng phẳng dễ quét; không thêm nested cards hoặc gradient text.
- **Layout A (chọn, cập nhật theo owner)**: thêm cột `Giá / 100g` trong Food DB; Meal Table có cột
  `Tổng tiền / bữa` ngay sau `Calo` và tổng ngày gọn trong footer bảng.
- **Layout B (loại)**: nhét badge giá vào ô tên Food; khó so sánh theo cột và gây nhiễu trên mobile.

## Scope

### In scope

1. Bỏ cảnh báo cấp cứu, hai link chết, toàn bộ `Nguồn & giới hạn tham khảo` và input ngân sách.
2. Recognized allergy `bò, gà` loại theo mapping tên canonical nhưng không fail-closed toàn catalog legacy.
3. Bỏ icon trùng ở tab Nutrition và khối `Chi phí tham khảo · TP.HCM` cũ.
4. Khôi phục Food DB trong Custom Meal Builder và giữ loading/empty/error dễ hiểu.
5. Thêm cột giá sau Calo, để `—` khi chưa có giá; copy: “Giá chỉ là ước tính và có thể thay đổi theo nơi bán.”
   cùng “Giá trị dinh dưỡng tham khảo từ Viện Dinh dưỡng Quốc gia.”
6. Chi phí từng bữa và tổng ngày dùng `typicalVndPer100g × amount/100`; ví dụ 20.000đ/100g × 150g = 30.000đ.
   Nếu thiếu giá, hiển thị tổng phần đã có và số món còn thiếu ngay trong cột, không tự bịa số.

### Out of scope

- Không xóa thêm Food production.
- Không sửa TDEE, quota, auth/CSRF hoặc Saved Meal Plan schema.
- Không runtime scrape retailer và không tuyên bố giá cố định/chính xác.
- Không tự ghi price observation production trước data rollout được duyệt/deploy riêng.

## Steps

### Step 1: Tạo regression guards cho API shape, allergy và custom Food DB

Thêm test `enrichFoodDatabase([{ label: "Ức gà" }])`, test `bò, gà` giữ Food không liên quan và vẫn đủ ba macro group,
đồng thời giữ unknown text tiếp tục chặn generation.

**Verify RED**: focused Vitest phải fail trên code hiện tại vì `label` bị bỏ qua và Food legacy bị loại toàn bộ.

### Step 2: Đơn giản hóa điều kiện Meal Plan và sửa filtering/category

Sửa category dùng `label || name`; mapping allergen explicit theo label đã normalize. Metadata reviewed vẫn có ưu tiên cao hơn,
nhưng Food legacy raw-name được xét theo mapping deterministic. Bỏ budget khỏi UI/generator nhưng gửi `null` cho API cũ để
giữ backward compatibility.

**Verify**: focused constraints/category/conditions tests pass; quota vẫn chỉ ghi sau validation + coverage.

### Step 3: Khôi phục Custom Builder và dọn UI cũ

Custom Builder dùng constrained catalog đã sửa; bổ sung trạng thái loading/empty có nguyên nhân. Tab Nutrition chỉ còn một icon.
Xóa component/copy cost cũ và các source/warning owner yêu cầu bỏ.

**Verify**: component tests cho copy bị loại, custom modal có Food từ canonical `label`, accessibility button labels.

### Step 4: Thêm giá per-100g và chi phí từng bữa theo gram

Food table render `marketPrice.typicalVndPer100g` hoặc `—`. Cost helper trả tổng phần đã định giá, coverage count và
missing count; Meal Table trình bày chi phí từng bữa cùng footer tổng ngày. Generator ưu tiên Food có giá khi các ràng
buộc dinh dưỡng ngang nhau.

**Verify**: worked example 20.000đ/100g × 150g = 30.000đ; multiple meals cộng đủ; partial coverage không giả tổng đầy đủ.

### Step 5: Giá tham khảo và QA

Giữ source allowlist Bách Hóa Xanh/WinMart/Co.op Online hiện có. Nghiên cứu/import giá là data rollout tách biệt có URL,
pack gram và observed date; item chưa xác minh để trống. Chạy client tests, server focused tests, build/lint, secret scan,
UI desktop/mobile và impact re-trace.

## Test Plan

- `cd client && npx vitest run src/utils/__tests__/foodCategory.test.js src/utils/__tests__/mealPlanConstraints.test.js`
- `cd client && npx vitest run src/pages/MealPlan/__tests__`
- `cd server && npx vitest run src/routes/__tests__/food.routes.integration.test.js`
- `npm run lint --prefix client`
- `npm run build --prefix client`
- `npm run security:secrets`
- `git diff --check`

## Done Criteria

- [x] Sáu yêu cầu owner đều có regression guard hoặc verification cụ thể.
- [x] `bò, gà` không còn làm rỗng toàn Food DB và Food chứa bò/gà không xuất hiện trong kết quả.
- [x] Custom Builder nhận Food API canonical và có loading/error/empty/disabled states.
- [x] Không còn warning 115, link chết, nguồn/giới hạn, budget input hoặc khối cost cũ.
- [x] Food table có một icon tab, cột giá sau calo và hai câu ghi chú đã chốt.
- [x] 150g Food giá 20.000đ/100g đóng góp đúng 30.000đ vào chi phí bữa và tổng ngày.
- [x] Giá thiếu hiển thị `—`/partial, không suy diễn.
- [x] Build/test/secret/diff gates được báo cáo bằng kết quả thật.

## Validation Evidence

- Focused Meal Plan: `54/54` pass.
- Client unit: `363/363` pass.
- Server unit/integration: `640/640` pass.
- Client lint: pass.
- Release build: pass; sitemap/prerender/bundle budget hoàn tất, dynamic source timeout được fallback theo policy hiện có.
- Secret scan và repository data boundary: pass.
- Browser: kiểm tra desktop mặc định và mobile `390×844`; cột giá cuộn ngang có chủ đích, copy và trạng thái disabled hiển thị đúng.
- E2E authenticated generation: skip vì local browser không có auth/TDEE fixture; regression utility/component và full suites thay thế cho lượt này.
- Follow-up 2026-08-11: thay section chi phí lớn bằng cột `Tổng tiền / bữa` và footer `Tổng ngày`; focused `18/18`,
  client `364/364`, lint và Vite compile-only pass. Local có `0` price observation nên UI đúng contract hiển thị `—`.

## STOP Conditions

- Fix allergy chỉ khả thi bằng cách bỏ validation unresolved text hoặc giảm auth/quota guard.
- Cần ghi price production nhưng chưa có hai URL retailer hợp lệ và owner chưa duyệt data rollout.
- API/category contract khác code đã đọc hoặc cần schema migration ngoài phạm vi.
- Cùng focused regression fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Food API canonical dùng `label`; mọi adapter mới phải hỗ trợ `label` trước, `name` chỉ là legacy fallback.
- Price UI không được coi `insufficient` là giá đầy đủ. Khi có một nguồn, vẫn để trống aggregate công khai theo policy hiện tại.
- Mapping allergen legacy phải explicit/deterministic và có test; không fuzzy-match text sức khỏe.
