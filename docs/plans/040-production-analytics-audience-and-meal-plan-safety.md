# Plan 040: Tách analytics production, lọc đối tượng và cá nhân hóa Meal Plan an toàn

> **Hướng dẫn thực thi**: Thực hiện theo vertical slice, chạy verification tương xứng sau mỗi slice và không tự chạy
> migration/backfill hoặc ghi dữ liệu production.
>
> **Drift check**: chạy `git status --short --branch` và các truy vấn `rg` trong Current State. Nếu contract/file đã đổi
> kể từ 2026-08-10, cập nhật spec/plan trước khi code.

## Status

- **Priority**: P0/P1
- **Effort**: XL (nhiều ngày, chia theo vertical slice)
- **Risk**: HIGH — analytics production, dữ liệu sức khỏe nhạy cảm, schema/data coverage và báo cáo Admin
- **Depends on**: 028A–028C, 033, 038, 039
- **Category**: bug + feature + data/schema + tests
- **Planned at**: 2026-08-10
- **Approval**: APPROVED — owner approved scope on 2026-08-10
- **Implementation**: IMPLEMENTED / LOCAL VERIFIED — production config, index migration và Food data rollout pending owner approval

## Quyết định đã chốt

1. GA4 chỉ chạy khi build production và runtime hostname đúng `htcoachingweb.io.vn`; staging/local no-op.
2. Staging backend không sync GA4 production; GSC không thuộc quyết định tắt tracking này.
3. Bộ lọc `Đối tượng` được thêm cạnh `Nhóm` trong “Tính năng cộng đồng & khách hàng”, áp dụng cả table/report/PDF.
4. Dị ứng/ngân sách đặt tại Meal Plan, không tại TDEE. Dị ứng lưu theo tài khoản và user có thể chỉnh tại Meal Plan.
5. Dị ứng là hard exclusion; ngân sách là ước tính/soft constraint; không có tuyên bố y tế hoặc giá tuyệt đối.
6. Giá v1 dùng snapshot thị trường online tại TP.HCM từ nguồn duyệt, không live scrape và không chia tỉnh.
7. Không thay đổi catalog, cột `Giá trị chính`, Exercise Library hoặc cơ chế kiểm duyệt đề xuất trong plan này.

## Why This Matters

GA4 hiện hardcode cùng Measurement ID cho mọi build và KPI cộng `activeUsers` theo ngày, làm traffic dễ bị trộn và đếm
trùng. Admin chưa lọc được tính năng theo đối tượng. Meal Plan chưa thu nhận constraint dị ứng/ngân sách, trong khi Food
chưa có provenance dị ứng/giá đủ để lọc fail-closed hoặc ước tính chi phí minh bạch.

## Current State

- `client/index.html` hardcode GA tag; `netlify.toml` chưa tách analytics theo deploy context.
- GA provider query `activeUsers/newUsers` theo `date`; read service cộng daily distinct users và suy returning bằng phép trừ.
- Service Access page chỉ giữ `selectedFeatureGroup`; table/report/PDF chỉ nhận group.
- Meal Plan chỉ có macro, số bữa và favorites; constraint chưa được validate trước quota.
- `User` chưa có preference Meal Plan nhạy cảm; `Food` chưa có allergen/price provenance.
- `SavedMealPlan` đã có ownership/version/privacy hardening; plan không đưa constraint vào saved-plan snapshot.

## Canonical specs và nguồn

- `docs/specs/seo-conversion-analytics.md`: production scope, unique-window KPI và legacy cutover.
- `docs/specs/service-access-policy.md`: audience filter cho table/report/PDF.
- `docs/specs/meal-plan-personalization-and-safety.md`: preference, allergy/budget và source contract.
- Google: [user metrics](https://support.google.com/analytics/answer/12253918?hl=en),
  [Data API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema),
  [internal traffic](https://support.google.com/analytics/answer/10104470?hl=en).

## Scope

**Analytics**: client bootstrap/page-view/tests, Netlify context, GA provider/read/sync/cache/tests và dashboard label.

**Community filter**: Service Access page/table/presentation/tests, client service/query, audience registry,
report/PDF/service/controller/validation/tests và E2E liên quan.

**Meal Plan**: owner-only meal-plan preferences, privacy/export/delete impact, MealPlan UI/generator/tests,
Food allergen metadata, price observations/aggregation/admin support, audit script và consumer regressions.

**Out of scope**: đổi công thức TDEE; chẩn đoán/điều trị; tự scrape retailer; chia giá theo tỉnh; lưu constraint trong
Saved Meal Plan; sửa catalog/cột báo cáo/cơ chế đề xuất; xóa analytics cũ; chạy migration/backfill production; đổi quota/payment.

## Steps

### Step 1: Chỉ khởi tạo và đọc GA4 production

Xóa tag hardcode; bootstrap từ `VITE_GA4_MEASUREMENT_ID` chỉ khi production build và hostname allowlist khớp. Thêm SPA
page-view tracker. Backend yêu cầu `APP_ENV=production` + `GA4_HOSTNAME`, filter exact `hostName`, ghi scope key cho cache
mới và bỏ qua legacy/mixed rows. Overview report không có `date`; returning lấy từ `newVsReturning`.

**Verify**: bootstrap/event tests; provider/read/sync tests gồm wrong host, legacy rows và multi-day user; build.

### Step 2: Thêm filter Đối tượng xuyên table, JSON report và PDF

Tạo audience registry key ổn định (`community`, `customer`, `trainer`), giữ label hiện có. Page lọc phép giao group +
audience. JSON/PDF nhận `audience`, validate allowlist và dùng cùng read model.

**Verify**: presentation unit, client query/service, report service/routes/PDF tests và E2E liên quan.

### Step 3: Lưu Meal Plan preferences owner-only

Thêm `User.mealPlanPreferences` dạng `select:false` với `allergyStatus`, taxonomy allergen chuẩn,
`otherAllergenText`, optional `budgetVndPerDay` và `reviewedAt`. Mục `Khác` tách nhiều tên bằng dấu phẩy hoặc khoảng
trắng khi toàn bộ từ khóa đã nhận diện, kể cả tên không dấu tiếng Việt như `ga bo ca`; dấu chấm bị từ chối và từ `thịt` quá chung chung phải được thay bằng loại cụ thể như gà, bò hoặc heo. Không có scope xác nhận dị ứng tất cả thịt. Mục đã ánh xạ
được lọc bằng metadata kiểm duyệt; mục chưa nhận diện dừng fail-closed trước quota. Tạo
`GET/PUT /api/user/me/meal-plan-preferences` qua auth, CSRF, validation allowlist; không trả field trong generic User
DTO/admin list, không log raw payload và trace export/delete lifecycle.

Guest giữ constraint trong phiên; tài khoản đăng nhập tự tải/lưu preference và có thể chỉnh tại Meal Plan.

**Verify**: model validation, owner-only route/controller/service tests, CSRF, DTO/privacy regressions.

### Step 4: Bổ sung Food allergen provenance và price observations TP.HCM

Thêm optional `Food.allergenProfile` mặc định `unreviewed`; thêm price observation theo source allowlist, vùng
`ho_chi_minh`, VND/100g, freshness và indexes. Aggregate trả low/typical/high/asOf/sourceCount/coverage. Viết audit script
dry-run; tạo preflight/apply index có production guard nhưng không chạy; không gọi retailer runtime và không tự backfill Food legacy.

**Verify**: schema/validation/admin routes, aggregation/index tests, Food DTO và các consumer regression.

### Step 5: Tích hợp “Điều kiện thực đơn” trước generation và quota

UI dùng câu hỏi `Bạn có dị ứng thực phẩm không?`, cho phép chọn/sửa trạng thái, allergen chuẩn, mục `Khác` và optional
budget VND/day; đồng thời tóm tắt trực tiếp 10 dấu hiệu thường gặp, cảnh báo cấp cứu 115 và nguồn y tế. Generator
hard-exclude contains/mayContain/unreviewed và specific-food metadata trước macro/preference/cost scoring; mục `Khác`
chưa nhận diện dừng tự động tạo. Kết quả chỉ
hiển thị khoảng giá tham khảo, nguồn và ngày cập nhật; validation bất khả thi chạy trước guest marker/server quota.

**Verify**: generator pure tests, MealPlan UI, guest/user quota, save/revise regression, accessibility/mobile và build.

### Step 6: Re-trace, QA và rollout có cổng

Chạy impact matrix, focused/full tests, lint/build, security scans, UI check, code review và cleanup. Rollout theo thứ tự:
code + feature chưa mở theo coverage → owner duyệt data import/backfill riêng → staging test (GA off) → production deploy
→ smoke/read-only verification.

## Done Criteria

- [x] GA4 no-op trên localhost/staging; production filter exact hostname và dùng range semantics đúng.
- [x] Filter `Đối tượng` kết hợp `Nhóm` nhất quán ở table/report/PDF.
- [x] Preference dị ứng/ngân sách lưu owner-only, chỉnh được tại Meal Plan và không lọt generic DTO/log/GA4.
- [x] Allergy hard exclusion fail-closed; giá TP.HCM luôn là range có source/as-of/coverage status.
- [x] Validation constraint thất bại không tiêu quota.
- [x] Không migration/backfill/production write ngoài approval riêng.
- [x] Specs, tests và verification evidence được cập nhật.

## Local verification — 2026-08-10

- Release build đúng npm lifecycle pass: sitemap lifecycle, Vite `2.851` modules, prerender `9/9` route và bundle budget.
- Client full unit: `71` files / `356` tests pass; client lint pass.
- Server full unit/integration: `129` files / `635` tests pass; chỉ còn warning deprecation `validateSync()` của Mongoose 10.
- Full Playwright E2E: `78/78` tests pass với mock API/Vite local được quản lý riêng và `1` worker để tránh state race.
- Browser QA pass ở desktop `1440x900` và mobile `390x844`; `ga bo ca` nhận đủ ba mục, `bo.ga.heo` bị chặn,
  còn `thit` yêu cầu nhập rõ loại và không còn dialog/nút xác nhận. Local có `0` GA script, không có `gtag`/`dataLayer` event.
- SEO static/rendered pass cho route liên quan; Meal Plan có title, description, canonical, JSON-LD và internal links.
- Secret scan, repository data-boundary, dependency audit client/server, agent validation và `git diff --check` pass.
- Không chạy migration/index apply, Food backfill hoặc bất kỳ thao tác ghi dữ liệu staging/production nào.

## STOP Conditions

- Cần xóa cache analytics hoặc ghi/backfill dữ liệu production.
- GA4 property/hostname canonical không xác định được từ config hiện có.
- Allergen/price coverage chỉ có thể đạt bằng suy luận tên Food không có nguồn.
- Source terms không cho phép lưu snapshot hoặc dữ liệu không đủ để bật feature an toàn.

## Maintenance Notes

- Measurement ID là config theo deploy context, không hardcode HTML.
- `unreviewed` luôn có nghĩa “chưa biết”, không phải “không có allergen”.
- Preference dị ứng là dữ liệu sức khỏe nhạy cảm; giữ `select:false`, owner-only và data minimization.
- Price estimate cần region/source/as-of; stale/insufficient phải giảm cấp về `unknown`.
