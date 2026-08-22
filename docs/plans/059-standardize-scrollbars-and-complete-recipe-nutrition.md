# Plan 059: Chuẩn hóa scrollbar và hoàn thiện quy đổi nutrition công thức

> **Hướng dẫn thực thi**: giữ thay đổi ở read-model/UI, không migration hoặc ghi dữ
> liệu local/staging/production. Dùng test-first cho mọi quy đổi đơn vị mới.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — UI toàn app và độ tin cậy nutrition public
- **Depends on**: 057, 058, 058A
- **Category**: bug / product / UI / tests / agent governance
- **Planned at**: 2026-08-21
- **Status**: DONE / FOCUSED VERIFIED — FULL SERVER SUITE BLOCKED BY LONG-RUNNING EXISTING TEST WORKERS

## Why This Matters

Scrollbar chỉ được style ở một vài class nên checkout portal và nhiều vùng `overflow`
khác rơi về giao diện trình duyệt thô, thậm chí trông như hai scrollbar khi body chưa
được lock. Nutrition recipe mới chỉ hiểu g/kg và dầu theo thìa; nguyên liệu theo ml,
đơn vị đếm hoặc mô tả định tính bị loại khỏi tổng và làm các nutrient hợp lệ thành 0.

## Scope

**In scope**:

- Scrollbar tokens dùng chung cho page, modal, drawer, table và horizontal overflow;
  tương thích Chromium/WebKit + Firefox, giữ keyboard/touch scrolling.
- Rule canonical và `ui-quality` routing note cho mọi UI có overflow.
- Parser fraction, volume, spoon, count, length và qualitative amount theo ingredient.
- Reference fallback có provenance cho toàn bộ nguyên liệu của công thức lẩu rau củ
  đang phản hồi; Food DB có nguồn hợp lệ vẫn được ưu tiên.
- Nutrition UI chỉ còn bảng kết quả và một warning chung.

**Out of scope**:

- Thay đổi Recipe/Food schema, backfill hoặc mutation database ở bất kỳ môi trường nào.
- Chia nutrition theo serving, vi chất ngoài contract hiện tại hoặc cam kết độ chính xác
  như cân thực phẩm thực tế.
- Refactor layout/component không liên quan chỉ vì cùng có `overflow`.

## Steps

### Step 1: Contract và test đỏ

Cập nhật spec; thêm server worked example cho 11 nguyên liệu của lẩu rau củ và client
test đảm bảo diagnostic nội bộ không còn render.

**Verify**: focused Vitest fail đúng vì parser/reference/UI contract chưa được implement.

### Step 2: Shared scrollbar system

Thêm global tokens và native selectors cho scrollbar ngang/dọc; đồng bộ các class
legacy `custom-scrollbar`/`chat-scrollbar`, bảo đảm checkout drawer dùng dark scheme và
body bị lock khi portal mở. Cập nhật canonical tech rule và UI skill reference.

**Verify**: source inventory không còn scrollbar style lệch token; browser desktop/mobile
cho body, Fitness+ drawer, modal dark và surface light đại diện.

### Step 3: Ingredient-aware nutrition conversion

Tách measurement parser/reference catalog khỏi service. Resolve exact mass trước,
sau đó volume/spoon/count/qualitative range; lookup Food DB có provenance trước và dùng
reference fallback khi DB không có dữ liệu tin cậy. Optional nutrient chỉ publish khi có
giá trị tính được, không suy thiếu thành 0.

**Verify**: worked example không unresolved, có calories/protein/carb/fat/saturates/
sugars/fibre/salt và mọi estimate lớn hơn hoặc bằng 0 theo literal expectations.

### Step 4: Simplify public nutrition UI và QA

Bỏ status badge, coverage note, unresolved list; giữ table và một warning. Chạy focused
tests, lint/build, UI regression, agent validation, security scans và browser QA.

## Done criteria

- [x] Scrollbar của checkout giống visual system trang chính và không còn double scroll.
- [x] Mọi native overflow trong app nhận shared scrollbar mặc định.
- [x] Rule/skill bắt buộc xem scrollbar là một phần của UI quality.
- [x] Công thức lẩu rau củ tính đủ 11 ingredient, gồm đường, chất béo bão hòa và chất xơ.
- [x] Nutrition UI không phơi status/coverage/unresolved; chỉ có một warning sai số.
- [x] Focused/full gates pass hoặc blocker môi trường được ghi rõ.

## STOP conditions

- Cần mutation dữ liệu local/staging/production để hoàn thành read-model.
- Reference không có provenance hoặc yêu cầu biến unknown thành exact value.
- Global scrollbar làm mất khả năng keyboard/touch scroll hoặc tạo regression high mới.
