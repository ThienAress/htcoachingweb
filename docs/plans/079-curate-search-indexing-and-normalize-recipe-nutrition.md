# Plan 079: Curate Search indexing và chuẩn hóa đơn vị dinh dưỡng công thức

> **Hướng dẫn thực thi**: Thực hiện từng behavior slice, chạy verification của
> slice trước khi chuyển bước. Phần implementation đã hoàn tất ở local. Owner đã
> cho phép rollout ngày 2026-09-02; mọi promotion phải đi theo exact SHA qua
> `staging -> live acceptance -> production`, không direct production và không
> chạy migration production nếu chưa có approval riêng.
>
> **Drift check**: Dừng nếu sitemap không còn lấy dynamic content từ
> `client/scripts/generate-sitemap.js`, Recipe public detail không còn đi qua
> `toPublicRecipeNutrition`, hoặc Exercise detail path không còn được tạo bởi
> `getExerciseDetailPath`.

## Status

- **Priority**: P0
- **Complexity**: COMPLEX
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: 038, 059, 061, 071A, 072, 073
- **Category**: bug | seo | data-compatibility | tests | operations
- **Planned at**: 2026-09-02
- **Lifecycle**: DONE
- **Verification**: LOCAL FULL
- **Rollout**: PENDING
- **Owner**: root
- **Updated at**: 2026-09-03

## Why This Matters

Production đang công bố toàn bộ 1.374 Exercise trong sitemap trong khi Recipe chỉ
được giới hạn hình thức; sitemap chưa đại diện cho một cohort đã được duyệt. Google
đã biết nhiều URL nhưng chưa ưu tiên crawl/index. Đồng thời Recipe nutrition cho
phép `mg` và public/Admin đang hiển thị raw unit, trái với quyết định sản phẩm mới
`2000 mg = 2 g`. Kết quả cần đạt là một cohort detail page nhỏ, rõ ràng, fail-closed
và crawlable; mọi URL ngoài cohort không được index, còn dữ liệu `mg` được chuẩn hóa
đúng phép tính mà không phá document cũ.

## Current State

- `client/scripts/generate-sitemap.js:170-191` đưa mọi Exercise vào sitemap và
  prerender; Recipe chọn tối đa 30 nhưng prerender toàn bộ catalog.
- `client/scripts/recipe-seo-selection.js:17-33` chỉ yêu cầu ảnh, ba nguyên liệu,
  hai bước và còn cộng điểm cho `source=ai`; không kiểm tra nutrition/provenance.
- `server/src/controllers/recipe.controller.js:262-277` bỏ `nutrition` khỏi
  `view=prerender`, trong khi cache dùng list item làm Recipe detail khi prerender.
- `client/src/pages/ExercisesPage/exerciseDetailPath.js:11-12` tạo internal URL
  không có trailing slash dù canonical/sitemap chuẩn hóa có slash.
- `client/src/hooks/useExercisesLogic.js:22-27` chỉ tải 500/1.374 Exercise;
  `ExerciseLibrary.jsx` dùng button `Xem thêm`, không tạo chuỗi link crawlable.
- `server/src/services/recipeNutrition.service.js:31-61` giữ nguyên `mg` và value;
  public serializer và Admin list cũng trả raw legacy unit.
- `client/src/pages/RecipeExplorer/RecipeNutritionPanel.jsx:12-18` chỉ hiển thị
  một chữ số thập phân nên `5 mg = 0.005 g` sẽ bị làm thành `0 g` nếu chỉ đổi label.
- Recipe nutrition có scope `whole_recipe` và chưa có `recipeYield`; vì vậy không
  được đưa calories vào Recipe JSON-LD như dữ liệu mỗi khẩu phần.
- Snapshot live read-only ngày 2026-09-02: 747 Recipe, 1.374 Exercise; user xác nhận
  nutrition và exercise instructions đã được backfill. Live data vẫn phải qua
  quality gate và manual rendered review trước khi pin cohort.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Server focused | `npm run test:unit:server -- --run <focused recipe files>` | exit 0 |
| Client focused | `npm run test:unit:client -- --run <focused SEO/nutrition files>` | exit 0 |
| Sitemap/prerender | `npm run test:unit:client -- --run scripts/__tests__/dynamic-routes.test.js scripts/__tests__/recipe-seo-selection.test.js scripts/__tests__/exercise-seo-selection.test.js scripts/__tests__/prerender-content.test.js scripts/__tests__/seo-prerender.test.js` | exit 0 |
| Client lint | `npm run lint --prefix client` | exit 0 |
| Client build | `npm run build --prefix client` | exit 0; strict dynamic build only when production API contract is available |
| Agent docs | `npm run agents:validate` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- Recipe nutrition canonicalization/serialization, Admin/public presentation,
  guarded migration and focused tests.
- Explicit 20-URL detail cohort (10 Recipe + 10 Exercise), deterministic quality
  validation, sitemap/prerender selection and runtime robots state.
- Exercise canonical links, cohort-first hub ordering và crawlable cohort links;
  không mở faceted pagination trong pilot.
- Prerender cache bảo đảm hub HTML chứa cohort links và Recipe HTML chứa nutrition.
- Existing Recipe nutrition spec/rules và SEO rollout evidence.

**Out of scope**:

- Tự chạy nutrition migration production hoặc mutation production ngoài release
  đã được duyệt; staging chỉ được sync bằng script guarded vào exact database
  `htcoaching_staging` sau khi dry-run/preflight khớp kế hoạch.
- Thêm `recipeYield`, servings hoặc nutrition per-serving; không bịa JSON-LD.
- Tạo hàng loạt nội dung mới, thay ảnh/video hoặc rewrite 747/1.374 records.
- Direct production trước staging acceptance, bypass required checks hoặc thao tác
  Google Search Console trước khi production ổn định.
- Refactor các file lớn ngoài đúng symbol liên quan.

## Steps

### Step 1: Chuẩn hóa `mg` thành `g` xuyên ingestion và read compatibility

Trong `recipeNutrition.service.js`, thêm canonicalizer nhận legacy `mg` nhưng trả
`g` với `value / 1000`, không làm tròn; giữ `mcg` nguyên trạng. Dùng serializer
chung cho public detail, prerender projection, Admin responses và import preview.
Admin UI không cho tạo `mg` mới, form tự convert legacy row, input/display giữ đủ
precision để `5 mg` hiển thị `0,005 g`. Viết migration guarded, dry-run mặc định,
idempotent và chỉ cập nhật additional item có unit `mg`.

**Behavior**: `920 mg` được lưu/trả/hiển thị thành `0,92 g`; `0,92 g` không bị chia
lần hai; document legacy vẫn đọc và upload thumbnail an toàn trước migration.

**Blast radius**: Recipe service/controller, Admin editor, public panel, importer,
migration, tests và nutrition docs; model enum tiếp tục nhận `mg` trong compatibility
window.

**Depends on**: none.

**Verify**: focused server/client nutrition tests và migration idempotence pass.

### Step 2: Chọn và pin cohort 20 detail URL bằng quality gate fail-closed

Tạo pure selectors cho Exercise và Recipe. Hard gate kiểm tra identity/canonical,
ảnh HTTPS, content depth, instruction completeness, rubric Exercise, source Recipe
và sáu core nutrition. Chạy selector trên public production GET, manual review HTML
của candidates, sau đó pin đúng 10 ID Exercise và 10 slug Recipe trong config
repo-owned. Production build fail nếu pinned item mất, trùng hoặc không còn đạt gate.

**Behavior**: cùng một catalog luôn tạo đúng cohort đã duyệt; thay đổi `updatedAt`
không làm URL tự nhảy vào/ra cohort.

**Blast radius**: config cohort, selectors, dynamic route projection, sitemap và
selector tests.

**Depends on**: Step 1 vì Recipe gate đọc public nutrition canonical.

**Verify**: selector tests cover pass/fail boundaries, duplicate pin, missing pin,
stable ordering và strict minimum 10+10.

### Step 3: Đồng bộ sitemap, robots runtime và prerender theo cohort

Sitemap chỉ đưa cohort Exercise/Recipe đã pin; prerender chỉ render các detail đó.
Recipe/Exercise detail ngoài cohort hoặc đang loading/error dùng `noindex` và không
phát JSON-LD/canonical indexable. Thêm chế độ `noindex,follow` riêng cho public
quarantine mà không đổi `noindex,nofollow` của trang auth/admin. Cache prerender trả
đúng selected list cho hai hub, đúng public nutrition shape cho Recipe detail và
không để API transient tạo trang lỗi `index,follow`.

**Behavior**: mọi detail URL trong sitemap trả một self-canonical `index,follow`;
detail ngoài cohort có `noindex,follow`; raw hub HTML chứa link tới đủ cohort.

**Blast radius**: sitemap/prerender modules, `SEO`, hai detail page và tests.

**Depends on**: Step 2.

**Verify**: sitemap/prerender unit tests, rendered snapshot assertions và scoped
route tests pass.

### Step 4: Làm cohort Exercise discoverable và canonical nhất quán

Ưu tiên 10 Exercise đã pin trong 24 card đầu để raw HTML hub luôn có đủ crawlable
`<Link>` tới cohort, rồi chuẩn hóa mọi detail/internal/JSON-LD path có trailing slash.
Giữ `Xem thêm` cho UX catalog hiện tại; không tải toàn bộ 1.374 rich document hoặc
mở query/path pagination trong pilot vì sẽ tăng payload/route scope trước khi các URL
ngoài cohort được phép index.

**Behavior**: Google đọc root prerender thấy đủ 10 cohort links canonical; người dùng
vẫn có search/filter/load-more hiện tại mà không phát sinh faceted SEO URLs.

**Blast radius**: Exercise library/path helpers và tests; không đổi API hoặc fetch
toàn catalog.

**Depends on**: Step 2.

**Verify**: service pagination, library navigation, canonical path và Exercise page
render tests pass.

### Step 5: Chạy release gates và lập rollout/GSC handoff

Chạy focused tests, lint, build/prerender, `seo-check static` rồi rendered check trên
hub + 20 details. Lập danh sách canonical URL cần URL Inspection, release order
backend compatibility → frontend cohort → migration preflight/apply riêng. Không
submit GSC hoặc chạy migration trong task local này.

**Behavior**: có evidence tái chạy được, exact 20 URLs, rollback point và blockers
được ghi rõ; không tuyên bố live PASS nếu chưa deploy.

**Blast radius**: docs plan/state/evidence; không production mutation.

**Depends on**: Steps 1–4.

**Verify**: `git diff --check`, focused QA, SEO static/rendered report và independent
diff review.

## Rollout Authorization And Order

Owner đã yêu cầu deploy production ngày 2026-09-02. Quyền này bao gồm commit/push,
PR/merge theo protected branches và deploy application, nhưng không bao gồm chạy
nutrition migration production. Rollout phải giữ các gate sau:

1. Khóa working-tree fingerprint, chạy full QA/ship và chỉ tiếp tục khi kết luận
   `GO FOR STAGING` không còn BLOCK/HIGH.
2. Push release branch, PR vào `staging`, chờ required checks. Khóa Netlify staging
   trước merge; sau merge chỉ cho Render backend deploy exact 40-character SHA trước.
   Xác minh backend mới đã live trước mọi write cohort để endpoint review của fixture
   staging đã fail-closed; không sync dữ liệu khi backend cũ còn phục vụ.
3. Chạy staging sync dry-run/preflight trên exact database `htcoaching_staging`,
   ghi lại `planDigest` SHA-256 từ output. Apply phải nhận đúng digest đó qua
   `--expected-plan-digest=<64hex>` (hoặc biến môi trường một lần
   `STAGING_SEARCH_INDEX_COHORT_EXPECTED_PLAN_DIGEST`); nếu source/target đổi giữa
   hai lần chạy, script fail trước mutation. Sau apply, xác minh preflight là
   `unchanged=10`, đủ 10/10 Exercise public API trả 200, GET review vẫn đọc được và
   PUT review vào fixture staging bị từ chối. Staging Recipe preflight ngày
   2026-09-03 cho thấy `0/10` nutrition hoàn chỉnh, nên chạy thêm
   `preflight:search-recipe-nutrition:staging`, review exact digest rồi apply bằng
   `sync:search-recipe-nutrition:staging`. Script này chỉ `$set nutrition` cho đúng
   10 record có ownership marker Plan 058A, transactionally fail khi target drift và
   post-verify `completeRecipes=10`. Không chạy lại Plan 058A cũ vì sanitizer của nó
   cố ý không copy nutrition. Chỉ sau hai sync và read-only API verify 10/10 mới bật/
   retry Netlify staging và xác minh frontend cùng exact SHA.

   Các lệnh apply phải chạy trong PowerShell bằng đúng guard và digest lấy từ
   preflight tương ứng; không thay placeholder bằng digest của sync còn lại:

   ```powershell
   $env:MIGRATION_TARGET_DATABASE = "htcoaching_staging"
   doppler run --project htcoaching-server --config stg -- npm.cmd run preflight:search-index-cohort:staging --prefix server
   $env:CONFIRM_STAGING_SEARCH_INDEX_COHORT_SYNC = "yes"
   doppler run --project htcoaching-server --config stg -- npm.cmd run sync:search-index-cohort:staging --prefix server -- --expected-plan-digest=<exercise-64hex-from-preflight>
   Remove-Item Env:CONFIRM_STAGING_SEARCH_INDEX_COHORT_SYNC

   doppler run --project htcoaching-server --config stg -- npm.cmd run preflight:search-recipe-nutrition:staging --prefix server
   $env:CONFIRM_STAGING_SEARCH_RECIPE_NUTRITION_SYNC = "yes"
   doppler run --project htcoaching-server --config stg -- npm.cmd run sync:search-recipe-nutrition:staging --prefix server -- --expected-plan-digest=<recipe-64hex-from-preflight>
   Remove-Item Env:CONFIRM_STAGING_SEARCH_RECIPE_NUTRITION_SYNC
   Remove-Item Env:MIGRATION_TARGET_DATABASE
   ```
4. Chạy live staging acceptance, cleanup trong `finally` và chỉ PASS khi residue
   bằng `0`; lưu immutable release-candidate evidence cùng rollback deploy IDs.
5. Chạy production promotion gate với cùng SHA và recovery manifest hiện tại. Deploy
   backend trước, xác minh API, rồi publish frontend cùng SHA.
6. Quan sát production chỉ bằng GET/HEAD tối thiểu 30 phút. Chỉ thao tác GSC sau khi
   production giữ trạng thái ổn định và post-deploy gate pass.

Mọi Git SHA/plan digest mismatch, stale backup, required check fail, staging residue
khác `0`, hoặc provider không cho kiểm soát thứ tự backend/frontend là STOP condition.

## Test Plan

- Nutrition: `2000mg→2g`, `920mg→0.92g`, `5mg→0.005g`, canonical `g` idempotence,
  invalid/negative reject, `mcg` unchanged, legacy public/Admin read và import commit.
- Staging nutrition sync: exact 10 source/target slugs, Plan 058A ownership, dry-run
  zero writes, order-stable SHA-256 digest, stale-target CAS, nutrition-only update,
  transaction cleanup và post-verify 10/10 eligible.
- Migration: dry-run zero writes, apply exact matched items, second apply zero updates,
  target/confirmation guard và unrelated nutrition preservation.
- Recipe gate: missing nutrition/source/image/content fail; AI source không tự được
  ưu tiên; pinned missing/duplicate fails strict build; create/update/delete/upload
  và nutrition import không thể làm pinned Recipe mất eligibility.
- Exercise gate: short/duplicate description, missing step/rubric/image fail; valid
  content deterministic; cohort cap đúng 10; description pinned không đổi trực tiếp
  và staging fixture không nhận review mutation trong cửa sổ rollback.
- SEO: sitemap chỉ chứa pinned canonical URLs; prerender manifest không còn toàn bộ
  747/1.374 details; noncohort robots `noindex,follow`; loading/error không index.
- Discovery: pinned Exercise được ưu tiên trong 24 card đầu, detail href có trailing
  slash, raw prerender mỗi hub chứa đủ link tới cohort tương ứng.
- Structured data: Recipe JSON-LD tiếp tục không khai nutrition `whole_recipe` khi
  chưa có `recipeYield`.

## Done Criteria

- [x] Production-source audit chọn và pin đúng 10 Recipe + 10 Exercise đã review.
- [x] Sitemap/prerender chỉ quảng bá cohort detail; noncohort bị quarantine.
- [x] Raw hub HTML có crawlable canonical links đến toàn bộ cohort tương ứng.
- [x] `mg` được canonicalize chính xác sang `g` trên write/read/UI; `mcg` không đổi.
- [x] Migration dry-run/apply có guard, idempotent và chưa được chạy production.
- [x] Pinned Recipe/Exercise mutation fail-closed; rollback staging kiểm review
  residue và fixture staging chỉ chặn review write, không chặn public review read.
- [x] Có guarded staging-only nutrition sync sau khi read-only API preflight xác nhận
  staging chưa sẵn sàng; production source chỉ GET và production DB không là target.
- [x] Focused server/client tests, lint, build và SEO gates pass hoặc blocker ghi rõ.
- [x] Không có production write, Git write operation, secret/debug log hoặc thay đổi
  ngoài dependency map do plan này tạo ra.
- [x] `docs/plans/README.md`, machine state và traceability phản ánh kết quả thật.
- [ ] Staging deploy, live acceptance và cleanup residue `0` pass cho exact release SHA.
- [ ] Production promotion và read-only observation tối thiểu 30 phút pass cho cùng SHA.

## Verification Evidence

- Client focused regression: 17 files / 72 tests pass; server nutrition focused:
  5 files / 17 tests pass.
- Full client: 145 files / 660 tests pass. Full server: 219 files / 1.234 tests pass.
- Client lint exit 0 với 0 error; còn 1 React Hook Form warning có sẵn ngoài scope.
- Strict production-mode client build exit 0: sitemap 58 URL, prerender 58/58,
  bundle budget pass và Search verifier xác nhận đúng 10 Recipe + 10 Exercise.
- Static CI build exit 0 ở chế độ non-production và không xuất detail artifact động.
- Secret scan, data-boundary scan và dependency audit client/server đều exit 0;
  không có violation hoặc advisory được miễn trừ.
- Independent artifact review và independent SEO re-review: PASS; live Netlify
  file-shadowing smoke và GSC monitoring chỉ thực hiện sau rollout.
- `agents:validate` exit 0 trên release base mới nhất của `origin/staging`: inventory,
  plan state và requirement traceability (3 manifests / 15 requirements / 36 acceptance
  criteria) đều pass, 0 warning.
- Full E2E local: 107/107 tests pass, exit 0 bằng `npm.cmd run test:e2e`. Hai lần
  chạy trong sandbox trước đó hoàn tất assertions nhưng treo ở Playwright WebServer
  teardown vì Windows `taskkill /T /F` bị từ chối quyền; probe DEBUG tái hiện tại
  một test, và cùng suite thoát sạch khi chạy ngoài sandbox có quyền teardown.
- Live production checks: PENDING cho rollout; chưa chạy migration production hoặc
  thao tác Google Search Console.

## STOP Conditions

- Public API không trả đủ pagination ổn định hoặc pinned candidate không thể xác minh.
- Nutrition production không đúng contract `whole_recipe` hoặc conversion cần đoán unit.
- Cần tự ghi staging/production, submit GSC hoặc deploy để tiếp tục.
- Cần thêm servings/recipeYield hay đổi Mongoose schema ngoài phạm vi đã duyệt.
- Verification cùng một contract fail ba vòng sau các sửa có căn cứ.
- File in-scope bị task khác sửa chồng trong lúc implementation.

## Maintenance Notes

- Cohort là editorial allowlist có chủ đích; chỉ mở rộng sau GSC evidence, không thay
  bằng top-N tự biến động mỗi build.
- Giữ `mg` trong stored enum đến khi migration production báo zero legacy item; bỏ
  enum là một schema-change riêng.
- Nutrition structured data chỉ được thêm sau khi có servings/per-serving canonical.
- Production rollout phải deploy backend serializer/projection trước frontend strict
  build, sau đó mới chạy migration bằng approval riêng và backup đã xác minh.
