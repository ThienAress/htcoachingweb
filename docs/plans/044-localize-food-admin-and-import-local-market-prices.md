# Plan 044: Việt hóa quản trị Food và nạp giá thị trường vào local

> Follow-up 2026-08-11: policy hai nguồn trong bằng chứng lịch sử bên dưới đã được Plan 045 thay thế bằng một nguồn bán lẻ còn hiệu lực. Không sửa lại số liệu verification cũ của lần chạy Plan 044.

> **Hướng dẫn thực thi**: chỉ dùng trang sản phẩm công khai của retailer được allowlist. Chạy dry-run trước apply,
> khóa database `htcoaching_local` và không ghi staging/production. Không đủ hai nguồn tương đương thì để trống giá.
>
> **Drift check**: xác nhận `FoodManagement.jsx` vẫn dùng `sourceType`/`priceSourceKey`, price service vẫn yêu cầu
> hai `sourceKey` còn mới, và local hiện có đúng 20 Food test trước khi nghiên cứu/import.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — giá thay đổi theo thời gian và dữ liệu sai có thể làm chi phí Meal Plan gây hiểu nhầm
- **Depends on**: 042, 043
- **Category**: UI + data tooling + tests
- **Planned at**: 2026-08-11
- **Approval**: APPROVED — owner yêu cầu Việt hóa modal và tự tra/nạp giá vào local
- **Implementation**: COMPLETE / RESEARCH VERIFIED — đợt 1 local đã xác minh 9 Food; đợt 2 đã phân loại đủ 405 Food production

## Why This Matters

Admin Food đang trộn tiếng Việt với thuật ngữ tiếng Anh và lộ enum `legacy_unknown`, khiến form khó dùng. Local có
20 Food nhưng chưa có price observation nên Food DB/Meal Plan chỉ hiển thị `—`. Dữ liệu giá cần có URL, ngày quan sát,
khối lượng và ít nhất hai retailer khác nhau; không được dùng estimate vô nguồn hoặc quy đổi raw/cooked thiếu căn cứ.

## Current State

- `client/src/pages/admin/FoodManagement.jsx` chứa toàn bộ modal create/edit và copy provenance/price.
- `server/src/services/foodPrice.service.js` chỉ trả giá khi có ít nhất hai `sourceKey` trong 90 ngày.
- `server/src/models/FoodPriceObservation.js` allowlist Bách Hóa Xanh, WinMart và Co.op Online.
- Local `htcoaching_local` có 20 Food và 0 observation tại thời điểm lập plan.
- Food dạng cooked (`Cơm trắng`, `Cơm gạo lứt`) không được gán thẳng giá gạo sống nếu không có conversion/yield source.

## Scope

### In scope

- Việt hóa label, helper text, option và badge nguồn trong Admin Food; giữ enum/payload/API không đổi.
- Nghiên cứu trang sản phẩm công khai, chỉ lưu giá + pack weight có thể kiểm chứng.
- Manifest local có ngày quan sát, URL HTTPS allowlist và identity Food/source không trùng.
- Script dry-run/apply idempotent, URI hard-lock localhost và database `htcoaching_local`.
- Verify aggregate qua DB và local public Food API.
- Chụp snapshot chỉ gồm nhãn Food công khai hiện có trên production để kiểm soát
  đủ phạm vi 405 món tại thời điểm 2026-08-11.
- Phân loại mọi nhãn thành `priced` hoặc `deferred`; món `priced` phải có đúng
  hai retailer tương đương, món `deferred` phải có reason code kiểm chứng được.
- Cố định điểm giá Bách Hóa Xanh tại TP.HCM và terminal Co.op Online hiện hành;
  không trộn giá giữa vùng hoặc dùng search snippet làm observation cuối.

### Out of scope

- Không scrape runtime, không tự động cập nhật định kỳ và không thêm domain retailer.
- Không ghi staging/production, không sửa macro/provenance/allergen.
- Không suy diễn conversion raw → cooked, ml → gram hoặc count → gram khi nguồn không công bố khối lượng.
- Không hạ điều kiện hai nguồn chỉ để UI có số.
- Không tự ghi staging/production trong đợt nghiên cứu này; production API chỉ đọc.
- Không xem kết quả fuzzy là hợp lệ nếu khác giống, phần thịt, trạng thái sống/chín,
  dạng nguyên bản/chế biến hoặc không chứng minh được gram.

### Step 5: Mở rộng nghiên cứu theo catalog production

Lấy nhãn từ public API production, chạy tìm kiếm chỉ đọc tại Bách Hóa Xanh và
Co.op Online, rồi review candidate theo tên, dạng thực phẩm, gram, giá thường và
URL sản phẩm. Mỗi nhãn phải nằm đúng một trạng thái:

- `priced`: hai observation khác retailer, cùng bản chất Food và quy đổi gram an toàn.
- `deferred`: giữ `—` kèm một trong các lý do `INSUFFICIENT_RETAILERS`,
  `RAW_COOKED_MISMATCH`, `UNIT_CONVERSION_UNSAFE` hoặc `PRODUCT_FORM_MISMATCH`.

**Verify**: snapshot có đúng 405 nhãn duy nhất; hợp `priced + deferred` phủ toàn bộ
snapshot không trùng; manifest giá vẫn pass validator hai nguồn và URL allowlist.

## Steps

### Step 1: Việt hóa Admin Food không đổi payload

Thay copy hiển thị: provenance, provider, dataset version, license, attribution, external ID, source URL,
legacy/manual, snapshot và badge enum. Giữ nguyên `sourceType`, request keys và validation.

**Verify**: grep không còn copy tiếng Anh đã chốt; client focused/build/lint pass; modal desktop vẫn cuộn và label rõ.

### Step 2: Khóa manifest giá có provenance

Tra cứu Bách Hóa Xanh, WinMart và Co.op Online. Mỗi observation phải có exact Food label, retailer key, URL sản phẩm,
khối lượng gói, giá thường, khuyến mãi optional và ngày quan sát. Chỉ item có hai retailer tương đương mới đạt coverage.

**Verify**: test manifest chặn host sai, duplicate Food/source, số âm, URL/search page và label không có ở local.

### Step 3: Import local idempotent

Tạo script mặc định dry-run; `--apply` mới upsert theo `foodId + sourceKey + observedAt`, kết nối URI localhost cố định
và recheck connected database. Không update Food và không xóa observation khác.

**Verify**: dry-run count khớp manifest; apply transaction exit 0; rerun không tạo duplicate.

### Step 4: Verify UX và coverage

Đọc local API `/api/foods?all=true`, xác nhận Food đủ hai nguồn có `coverageStatus=sufficient`, giá/100g hiện trong
Food DB và chi phí từng bữa dùng đúng định lượng. Báo rõ label còn trống và lý do.

## Test Plan

- `cd server && npx vitest run src/scripts/__tests__/localFoodPriceImport.test.js`
- focused Admin/Meal Plan client tests
- `npm run test:unit:client`
- `npm run test:unit:server`
- `npm run lint --prefix client`
- `cd client && npx vite build`
- `npm run security:secrets`
- `npm run security:data-boundaries`
- `git diff --check`

## Done Criteria

- [x] Admin Food không còn English copy hoặc raw enum được nêu trong screenshot.
- [x] Mỗi observation local có retailer allowlist, product URL, weight, price và observed date.
- [x] Dry-run/apply/rerun chứng minh local-only và idempotent.
- [x] API/UI hiển thị giá chỉ cho Food đủ hai nguồn; item thiếu nguồn vẫn `—`.
- [x] Không staging/production write và không có giá/URL bịa.
- [x] Focused tests, client tests, lint, compile, security và diff gates có evidence thật; full server suite được ghi rõ timeout.

## Completion Evidence — 2026-08-11

- Local dry-run: `18 insert / 0 skip`; apply: `18 observations / 9 Food sufficient`; apply lần hai: `0 insert / 18 skip`.
- Local public API xác nhận 9 Food có `coverageStatus=sufficient` và `sourceCount=2`: `Bún`, `Bơ trái`,
  `Bơ đậu phộng`, `Chuối`, `Cá hồi`, `Hạt điều`, `Khoai tây`, `Đậu phụ`, `Ức gà`.
- Client unit: `74 files / 366 tests` pass; focused importer + Food API integration: `2 files / 17 tests` pass.
- Client lint pass; Vite compile pass; secret scan pass; repository data-boundary pass với `0 violations`;
  agent validation pass; `git diff --check` pass.
- Full server suite không trả kết quả trong timeout 5 phút nên không được ghi nhận pass. E2E admin UI không chạy vì
  browser kiểm thử tách biệt không có phiên đăng nhập; API, unit, lint và compile là bằng chứng thay thế trong phạm vi task.
- Không có mutation staging/production. 11 Food còn lại giữ `—` vì chưa đủ hai nguồn tương đương hoặc cần quy đổi
  không an toàn giữa sống/chín, ml/g hay số lượng/g.

## STOP Conditions

- Retailer page không chứng minh đồng thời sản phẩm, giá và khối lượng.
- Hai retailer bán dạng sản phẩm khác bản chất so với Food canonical.
- Cần quy đổi raw/cooked, ml/gram hoặc count/gram mà không có nguồn trên trang sản phẩm.
- Target không phải localhost `htcoaching_local` hoặc local Food label drift.
- Import muốn overwrite/delete observation không nằm trong manifest Plan 044.

## Maintenance Notes

- Giá hết hạn sau 90 ngày; lần cập nhật sau tạo observed date mới, không sửa lịch sử cũ.
- Nếu muốn tự động hóa phải có job/provider riêng, rate limit, ToS review và monitoring; không tái dùng script one-shot như scraper.

## Production Catalog Research Evidence — 2026-08-11

- Public API production trả đúng 405 nhãn Food duy nhất; không có mutation production/staging.
- Quét chỉ đọc Bách Hóa Xanh tại một cửa hàng TP.HCM cố định và Co.op Online tại
  một terminal cố định hoàn thành 405/405, không có network error.
- Máy tìm 72 cặp candidate; review thủ công chỉ duyệt 29 cặp mới. Kết hợp 9 cặp
  đã kiểm chứng ở đợt 1 thành 38 Food / 76 observation; 367 Food giữ trống.
- Mọi Food để trống có một reason code và copy tiếng Việt; mọi Food có giá có
  đúng hai source key, gram dương, giá dương và URL sản phẩm allowlist.
- Artifact local bị Git ignore:
  `.local-data/food-price-approved-observations-2026-08-11.csv`,
  `.local-data/food-price-coverage-2026-08-11.csv` và
  `.local-data/food-price-reviewed-2026-08-11.json`.
- Focused Vitest: 3 files / 15 tests pass; `node --check` pass cho 6 file mới;
  secret scan pass; repository data-boundary pass với 0 violations; agent
  validation pass; `git diff --check` pass. Server ESLint không có config
  canonical nên lệnh ESLint 10 trực tiếp không chạy và không được ghi nhận pass.
