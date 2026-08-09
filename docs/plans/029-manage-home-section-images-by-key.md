# Plan 029: Quản lý ảnh Homepage theo stable key

> **Hướng dẫn thực thi**: Follow plan theo thứ tự, viết test contract trước khi đổi runtime, giữ
> backward compatibility và chạy từng verification gate trước khi chuyển bước. Nếu gặp STOP
> condition thì dừng và báo cáo, không tự mở rộng phạm vi.
>
> **Drift check (chạy đầu tiên)**: `Tools.jsx` đang có thay đổi chưa commit bổ sung Meal Scan;
> `home.json`, `docs/README.md` và `docs/plans/README.md` cũng đang dirty. Đọc lại diff ngay trước
> khi sửa, giữ toàn bộ thay đổi đó và không format/rewrite các file ngoài hunk cần thiết.

## Status

- **Priority**: P1
- **Effort**: M (~1 ngày)
- **Risk**: MEDIUM
- **Depends on**: 027, 028A
- **Category**: feature
- **Planned at**: 2026-08-06
- **State**: COMPLETE

## Why This Matters

Admin hiện upload nhiều ảnh Classes vào một mảng chung và chỉ có một ảnh Tools, nên ý nghĩa ảnh
phụ thuộc vào vị trí hoặc một field tổng quát. Điều này dễ làm ảnh Boxing bị gắn sang Cardio & HIIT,
không quản lý được các tool khác và buộc sửa form Admin mỗi khi homepage có item mới. Stable key và
catalog dùng chung loại bỏ ambiguity mà vẫn giữ dữ liệu cũ hoạt động.

## Current State

- `client/src/pages/admin/SiteSettings.jsx:246` render một `SettingSection` nhiều ảnh cho toàn bộ
  Classes; `:258` render một ảnh duy nhất cho Tools.
- `client/src/sections/class/Classes.jsx:22-42` hardcode ba class và lấy ảnh bằng index `0..2`.
- `client/src/sections/Tools.jsx:14-23` chỉ nhận một override cho TDEE; Exercise, Recipe, Meal Plan
  và Meal Scan dùng asset hardcode trong component.
- `client/src/pages/Home.jsx` truyền `settings.classesImages` và `settings.toolsImage` theo contract cũ.
- `server/src/models/SiteSetting.js:27-34` chỉ có `classesImages: [String]` và `toolsImage: String`.
- `server/src/controllers/siteSetting.controller.js:60-72` append Classes theo mảng và overwrite
  một field Tools; `:88-100` xóa theo field tổng quát.
- `server/src/routes/siteSetting.routes.js:31-32` có route upload chung cho Classes/Tools, đã được
  bảo vệ bởi Admin auth, role và CSRF ở `:24`.
- `server/src/middlewares/siteSettingUpload.js:4-20` đã kiểm tra MIME, extension và giới hạn file;
  middleware riêng cho Classes/Tools ở `:26-27` phải tiếp tục được dùng.
- Spec canonical: `docs/specs/home-section-media-management.md`.

## Impact Map

| Contract/symbol | Producer | Consumers cần đồng bộ | Compatibility |
|---|---|---|---|
| `HOME_CLASS_CATALOG` | client config mới | Classes, Admin SiteSettings | item mới xuất hiện ở cả hai |
| `HOME_TOOL_CATALOG` | client config mới | Tools, Admin SiteSettings | bao gồm Meal Scan đang dirty |
| `classesImagesByKey` | SiteSetting/API | Home, Classes, Admin | fallback `classesImages[index]` |
| `toolsImagesByKey` | SiteSetting/API | Home, Tools, Admin | TDEE fallback `toolsImage` |
| upload item route | Express/controller | siteSetting service/Admin | route legacy được giữ nguyên |
| remove `{ itemKey }` | controller | siteSetting service/Admin | request legacy không itemKey vẫn chạy |

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused client tests | `cd client && npx vitest run src/config/__tests__/homeSectionCatalog.test.js src/services/__tests__/siteSetting.service.test.js` | exit 0; keyed resolver/service contract pass |
| Focused server tests | `cd server && npx vitest run src/models/__tests__/siteSetting.schema.test.js src/controllers/__tests__/siteSettingMedia.test.js` | exit 0; schema/update/remove validation pass |
| Client lint | `npm run lint --prefix client` | exit 0; không có lint error mới |
| Client build | `npm run build --prefix client` | Vite compile exit 0; nếu postbuild phụ thuộc môi trường thì ghi riêng chính xác |
| Full unit regression | `npm run test:unit` | exit 0 |
| Governance | `npm run agents:validate` | exit 0 |
| Diff hygiene | `git diff --check` | không có whitespace error mới |

## Scope

**In scope**:

- `client/src/config/homeSectionCatalog.js`
- `client/src/config/__tests__/homeSectionCatalog.test.js`
- `client/src/components/admin/KeyedMediaSection.jsx`
- `client/src/components/admin/__tests__/KeyedMediaSection.test.jsx`
- `client/src/sections/Hero.jsx`
- `client/src/sections/About.jsx`
- `client/src/sections/Trainers.jsx`
- `client/src/sections/class/Classes.jsx`
- `client/src/sections/Tools.jsx`
- `client/src/pages/Home.jsx`
- `client/src/pages/admin/SiteSettings.jsx`
- `client/src/services/siteSetting.service.js`
- `client/src/services/__tests__/siteSetting.service.test.js`
- `server/src/models/SiteSetting.js`
- `server/src/models/__tests__/siteSetting.schema.test.js`
- `server/src/controllers/siteSetting.controller.js`
- `server/src/controllers/__tests__/siteSettingMedia.test.js`
- `server/src/routes/siteSetting.routes.js`
- `docs/specs/home-section-media-management.md`
- `docs/plans/029-manage-home-section-images-by-key.md`
- `docs/plans/README.md`

**Out of scope**:

- Không đổi nội dung/copy i18n, public routes, SEO, sitemap hoặc prerender entries.
- Không xóa `classesImages`/`toolsImage`, không migration/backfill và không xóa asset Cloudinary cũ.
- Không thay auth, role, CSRF, rate limit, upload size/type hoặc Cloudinary credentials.
- Không deploy, commit, push hay ghi dữ liệu local/staging/production.
- Không refactor animation/copy/layout homepage ngoài mức cần để render catalog động.

## Technical Decisions

1. Catalog client là nguồn canonical cho danh sách card homepage và slot Admin. Mỗi entry có
   stable `key`, nhãn Admin, translation keys/content index, default image và metadata render.
2. Ảnh custom lưu trong hai Mongoose `Map<String, String>` optional, default rỗng. Field legacy
   được giữ nguyên và chỉ dùng làm fallback đọc.
3. Resolver ưu tiên `imagesByKey[key]` → legacy value tương ứng → default asset. Không dùng array
   index làm contract mới; legacy index chỉ nằm trong adapter tương thích.
4. Route item mới nhận `:itemKey`, chỉ cho kebab-case an toàn (1-64 ký tự). Section vẫn được khóa
   bởi route cụ thể; Admin auth/role/CSRF và upload middleware hiện có không đổi.
5. Upload một item thay thế URL của đúng key. Remove có `itemKey` chỉ unset key đó; request legacy
   không có `itemKey` giữ behavior hiện tại.

## Steps

### Step 1: Khóa catalog, resolver và schema contract bằng test

- Tạo test đỏ chứng minh mapping theo key không đổi khi reorder, item mới tự có trong catalog
  consumer, legacy settings vẫn resolve được và invalid item key bị từ chối.
- Thêm test schema cho hai map default rỗng và serialize thành object trong JSON response.

**Verify**: chạy hai focused test commands; test mới phải fail vì implementation chưa tồn tại,
sau đó pass ở các bước tương ứng.

### Step 2: Thêm catalog canonical và keyed resolver ở client

- Khai báo đầy đủ ba Classes và năm Tools hiện có, gồm Meal Scan, bằng stable key.
- Chuyển Classes/Tools sang render từ catalog, nhưng giữ visual hierarchy, link, translation,
  animation và asset mặc định hiện tại.
- Home truyền cả keyed maps lẫn legacy values cho resolver.

**Verify**: focused client catalog tests pass; homepage vẫn có 3 class và 5 tool đúng route/copy.

### Step 3: Mở rộng SiteSetting/API tương thích ngược

- Thêm hai map optional vào schema mà không sửa/xóa field cũ.
- Thêm route upload single-image theo section/item key, tái dùng middleware hiện có.
- Validate key trước upload; ghi/xóa đúng map key; giữ legacy endpoints/request behavior.
- Giữ error response hữu dụng và `safeLog` cho lỗi upload.

**Verify**: focused server tests pass cho schema, valid/invalid key, replacement, isolated removal
và legacy compatibility.

### Step 4: Xây UI upload theo từng item trong Admin

- Tạo từng row/slot có nhãn, preview hiện tại, file picker và action upload/xóa riêng.
- Mutation state phải định danh theo `section:itemKey`, tránh một upload làm mọi slot quay loading.
- Có loading/error/empty/disabled, focus ring, accessible label và touch target phù hợp.
- Service layer tạo URL/payload keyed; component không gọi axios trực tiếp.

**Verify**: service tests pass; manual smoke Site Settings chứng minh chọn Boxing chỉ thay Boxing,
chọn Meal Scan chỉ thay Meal Scan và slot mới giả lập render tự động từ catalog.

### Step 5: Re-trace, QA và cleanup

- Tìm lại mọi consumer của field cũ/mới và route upload/remove.
- Chạy focused tests, full unit, lint, build, agent validation và diff hygiene.
- Kiểm tra responsive Admin desktop/mobile và homepage fallback không ảnh custom.
- Cập nhật plan state/evidence thực tế; không tuyên bố pass cho gate chưa chạy.

## Execution Tasks

- [x] **Task 1: Khóa catalog và resolver bằng test đỏ**
  - Acceptance: test mô tả unique key, keyed override, reorder, legacy/default fallback và thêm item mới.
  - Verify: `cd client && npx vitest run src/config/__tests__/homeSectionCatalog.test.js` ban đầu fail đúng lý do thiếu implementation, sau Task 2 phải pass.
  - Files: `client/src/config/homeSectionCatalog.js`, `client/src/config/__tests__/homeSectionCatalog.test.js`.

- [x] **Task 2: Chuyển Homepage Classes/Tools sang catalog canonical**
  - Acceptance: 3 Classes và 5 Tools hiện tại render từ catalog; ảnh ưu tiên keyed map, giữ fallback legacy/default và các route/copy/animation hiện có.
  - Verify: focused catalog test pass; `npm run lint --prefix client` không có error mới trong các file này.
  - Files: `client/src/config/homeSectionCatalog.js`, `client/src/sections/class/Classes.jsx`, `client/src/sections/Tools.jsx`, `client/src/pages/Home.jsx`.

- [x] **Task 3: Thêm schema maps tương thích ngược**
  - Acceptance: document mới/cũ có hai map default rỗng, JSON trả object keyed và legacy fields vẫn nguyên vẹn.
  - Verify: `cd server && npx vitest run src/models/__tests__/siteSetting.schema.test.js` pass.
  - Files: `server/src/models/SiteSetting.js`, `server/src/models/__tests__/siteSetting.schema.test.js`.

- [x] **Task 4: Thêm API upload/remove theo item key**
  - Acceptance: key kebab-case hợp lệ set/replace/remove độc lập; invalid key trả 400 trước upload; endpoints legacy, Admin auth, role, CSRF và upload middleware không đổi.
  - Verify: `cd server && npx vitest run src/controllers/__tests__/siteSettingMedia.test.js` pass.
  - Files: `server/src/controllers/siteSetting.controller.js`, `server/src/controllers/__tests__/siteSettingMedia.test.js`, `server/src/routes/siteSetting.routes.js`.

- [x] **Task 5: Xây từng upload slot trong Admin qua service layer**
  - Acceptance: mỗi class/tool có label, preview, picker, upload/remove và loading state riêng; item catalog mới tự có slot; component không gọi axios trực tiếp.
  - Verify: `cd client && npx vitest run src/services/__tests__/siteSetting.service.test.js` pass và manual smoke desktop/mobile đạt các state trong spec.
  - Files: `client/src/pages/admin/SiteSettings.jsx`, `client/src/components/admin/KeyedMediaSection.jsx`, `client/src/services/siteSetting.service.js`, các focused tests tương ứng.

- [x] **Task 6: Chạy regression, impact re-trace và bàn giao**
  - Acceptance: không còn consumer bỏ sót, debug/import thừa hoặc thay đổi ngoài scope; plan có evidence thật và state cuối chính xác.
  - Verify: `npm run test:unit`, `npm run lint --prefix client`, `npm run build --prefix client`, `npm run agents:validate`, `git diff --check`.
  - Files: `docs/specs/home-section-media-management.md`, `docs/plans/029-manage-home-section-images-by-key.md`, `docs/plans/README.md`.

## Test Plan

- `homeSectionCatalog.test.js`: unique stable keys, reordering, keyed override, legacy fallback,
  default fallback và catalog extension.
- `siteSetting.service.test.js`: encode item key đúng trong upload URL và gửi `itemKey` khi remove.
- `siteSetting.schema.test.js`: old document defaults, map serialization và không mất legacy field.
- `siteSettingMedia.test.js`: valid key set/replace, invalid key `400`, remove isolation, legacy path.
- Manual UI: loading/error/empty/disabled, preview modal, keyboard focus, desktop và mobile.

## Done Criteria

- [x] Classes và toàn bộ Tools hiện tại có slot riêng trong Admin.
- [x] Homepage và Admin cùng lấy item từ một catalog canonical.
- [x] Upload/remove chỉ tác động đúng stable key; reorder không đổi ảnh.
- [x] Item catalog mới tự xuất hiện trong Admin và fallback default trên homepage.
- [x] Documents legacy tiếp tục hoạt động; không cần migration hoặc data write.
- [x] Auth/role/CSRF và upload validation hiện tại vẫn nguyên vẹn.
- [x] Focused tests, full unit, lint, compile-only build, agents validation và diff check có evidence thật.
- [x] Không ghi đè thay đổi Meal Scan/Plan 027-028 đang có trong working tree.

## Verification Evidence — 2026-08-06

- Runtime chuẩn: Node `v22.23.1` từ cached project-compatible binary.
- Focused client: `3 files / 10 tests` pass cho catalog/resolver, service URL/payload và SSR
  upload slots (`3 Classes`, `5 Tools`).
- Focused server: `2 files / 7 tests` pass cho schema maps, invalid key, isolated set/remove,
  stale-remove conflict và legacy upload behavior.
- Full client: `60 files / 289 tests` pass.
- Full server single-worker: `114 files / 527 tests` pass trong `498,96s`; chỉ có warning
  `validateSync()` deprecation đã có sẵn của Mongoose.
- Full client lint exit `0` bằng Node 22.
- Node 22 compile-only: Vite transform `2.823 modules`, build pass trong `9,23s`; chunk-size
  warning hiện hữu, không có compile error.
- Governance/security: `22 skills / 0 warnings`, secret scan pass, data-boundary scan `0`
  violations và `git diff --check` pass.
- Browser smoke homepage desktop + mobile `390x844`: 3 Classes và 5 Tools render đúng link/copy,
  không overflow; React reserved-key warning phát hiện trong vòng đầu đã được sửa và không tái diễn.
- Authenticated Admin browser smoke không chạy vì in-app browser không có local admin session và route
  redirect `/login`; thay bằng SSR component tests. Không upload Cloudinary và không ghi dữ liệu local,
  staging hoặc production.
- Full release build `npm run build --prefix client` không hoàn tất sau hơn 3 phút tại postbuild
  prerender khi dynamic sources/backend không sẵn sàng. Compile Vite pass nhưng đây không phải release
  evidence; sitemap do prebuild tạo lại đã được khôi phục đúng HEAD.
- E2E skip vì không có authenticated local environment và task không cho phép tạo test data thật.

## Implementation Deviation

- Tách `KeyedMediaSection.jsx` khỏi `SiteSettings.jsx` thay vì nhúng toàn bộ row logic vào page như
  dự kiến ban đầu. Quyết định này giữ component mới dưới 300 dòng, cô lập object-URL lifecycle và
  trạng thái upload/remove theo item; không đổi API, schema hoặc behavior đã duyệt.

## Extension Tasks — Approved 2026-08-06

- [x] Mở rộng catalog cho 5 Hero Banner, 3 Hero Avatar, 5 About và 1 Trainer featured image.
- [x] Thêm bốn keyed maps optional và route upload single-image tương ứng; giữ toàn bộ legacy route/field.
- [x] Chuyển Hero/About/Trainers/Home sang keyed resolver và khóa Trainer override precedence.
- [x] Thay bốn `SettingSection` legacy bằng `KeyedMediaSection`; thêm chevron accordion cho cả 6 section.
- [x] Mở rộng tests, chạy focused QA, Node 22 client/server regression tương xứng, UI check và cleanup.

## Extension Verification Evidence — 2026-08-06

- Node chuẩn `v22.23.1`; focused client `3 files / 16 tests` và focused server
  `2 files / 11 tests` pass.
- Full client regression `60 files / 295 tests` pass; full client ESLint exit `0`.
- Vite production compile transform `2.824 modules` và build pass trong `8,91s`; chỉ còn warning
  chunk-size đã biết.
- Server syntax check pass cho model/controller/routes; full server regression single-worker không in
  summary trước timeout `601s`. Không ghi nhận test failure, chỉ có warning Mongoose
  `validateSync()` đã biết; focused SiteSetting suite là evidence backend chính của extension.
- Accordion SSR test khóa `aria-expanded` và trạng thái đóng; slot rỗng không render `img src=""`.
  Authenticated Admin browser smoke chưa chạy vì không có local admin session.
- Agent validation `22 skills / 0 warnings`, secret scan pass, repository data-boundary scan `0`
  violations và `git diff --check` không có whitespace error.
- Không upload Cloudinary thật, không migration, không ghi local/staging/production và không
  commit/push/deploy.

## STOP Conditions

- `Tools.jsx` hoặc file in-scope thay đổi thêm trong lúc implement khiến current-state contract lệch.
- Mongoose Map không serialize ổn định thành object cho client cũ/mới mà cần breaking API adapter.
- Hoàn thành yêu cầu đòi xóa/rename field legacy, migration/backfill hoặc Cloudinary cleanup.
- Cần thay auth/CSRF/upload validation hoặc chạm staging/production.
- Cùng một verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Khi thêm class/tool mới, thêm đúng một catalog entry với stable key mới và translation/default
  metadata; không tái sử dụng key cũ cho nội dung khác.
- Không đổi key sau khi đã có ảnh production. Nếu bắt buộc rename, phải có migration/backfill riêng.
- Legacy fields chỉ được xóa trong một plan migration khác sau khi đo được không còn consumer/data.
