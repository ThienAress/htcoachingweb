# Plan 041: Tinh gọn danh mục Food production cho Meal Plan eat-clean

> **Hướng dẫn thực thi**: chạy preflight trước, khóa danh sách bằng label và `_id`, kiểm tra tham chiếu,
> sao lưu đúng các document sẽ xóa, rồi mới apply trong transaction. Không xóa theo regex/prefix tại thời điểm apply.
>
> **Drift check**: chạy `git status --short --branch`, gọi `GET /api/foods?all=true` và xác nhận tổng Food,
> manifest cùng số bản ghi khớp trước khi mutation. Nếu label thiếu/thừa hoặc target database không khớp thì STOP.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: HIGH — xóa dữ liệu production và có Saved Meal Plan tham chiếu Food
- **Depends on**: 040
- **Category**: migration + data
- **Planned at**: 2026-08-11
- **Approval**: APPROVED — owner yêu cầu hard-delete bốn nhóm khỏi production ngày 2026-08-11
- **Implementation**: IMPLEMENTED / FOCUSED VERIFIED — PRODUCTION CURATED MANUALLY AND API VERIFIED

## Why This Matters

Production đang dùng toàn bộ 548 bản ghi Food từ catalog tra cứu cho generator. Vì Food chưa có category/eligibility
server-authoritative, fallback theo macro có thể chọn nước mắm, mỡ lợn, bột hoặc nước ngọt làm thực phẩm chính.
Owner chốt Meal Plan theo định hướng eat-clean và yêu cầu xóa hẳn bốn nhóm không phù hợp thay vì giữ `reference_only`.

## Current State

- `server/src/models/Food.js` lưu macro/provenance/allergen nhưng chưa có category hoặc eligibility.
- `client/src/hooks/useMealGenerator.js` phân nhóm bằng macro và fallback sang toàn catalog khi category không khớp.
- `server/src/models/SavedMealPlan.js` giữ `foodId` cùng label/macro snapshot; đọc plan cũ không cần populate Food.
- `server/src/services/savedMealPlanSnapshot.service.js` yêu cầu Food còn tồn tại khi tạo/revise snapshot mới.
- `server/src/models/FoodPriceObservation.js` tham chiếu `Food`; controller xóa đơn lẻ hiện có cascade price observation.
- Production public API trả 548 Food tại thời điểm lập plan.
- `Quả bơ vỏ tím` và `Quả bơ vỏ xanh` khác macro; cả hai phải được giữ riêng, không merge.

## Scope

**In scope**:

- Manifest label chính xác cho bốn nhóm owner đã duyệt: tên hiếm/khó hiểu; nội tạng/động vật ít phù hợp;
  rượu-nước ngọt-kẹo-mứt-snack; và phần bột/gia vị/nguyên liệu thô owner chọn xóa.
- Preflight đọc-only, kiểm tra Food/price/SavedMealPlan references.
- Backup manifest và document bị xóa vào `.private/` (đã git-ignore), kèm checksum.
- Apply production có target guard, approval evidence, confirmation flag và transaction.
- Xóa `FoodPriceObservation` tương ứng; giữ nguyên Saved Meal Plan snapshot lịch sử.
- Cập nhật spec để ghi nhận catalog eat-clean đã được owner chốt.

**Out of scope**:

- Không merge các biến thể có macro khác nhau.
- Không sửa bước 1–6 của yêu cầu Meal Plan trong plan này.
- Không sửa nội dung Saved Meal Plan cũ và không tự thay Food đã xóa bằng Food khác.
- Không thêm endpoint hoặc backdoor migration tạm vào production.

## Steps

### Step 1: Khóa manifest và preflight an toàn

Tạo migration export manifest theo nhóm, chỉ resolve label thành `_id` trong preflight. Báo exact matches,
missing labels, price observations và Saved Meal Plan references. Apply bị chặn nếu manifest không khớp 100%.

**Verify**: unit test manifest không trùng, giữ hai loại bơ và chặn target/confirmation sai.

### Step 2: Backup và hard-delete theo ID trong transaction

Trước transaction, ghi EJSON backup Food + FoodPriceObservation vào `.private/` bằng tên file mới không ghi đè,
tính SHA-256 và ghi evidence. Trong transaction xóa prices trước, Food sau; xác nhận deleted count đúng preflight.

**Verify**: integration test bằng MongoDB in-memory cho preflight, cascade delete, rollback khi count lệch và
Saved Meal Plan snapshot vẫn đọc được.

### Step 3: Production preflight và apply có cổng

Chạy preflight trên đúng production config. Chỉ apply khi database name, backup ID, approval ID và confirmation
khớp; sau apply gọi public Food API xác nhận không còn label trong manifest và tổng Food giảm đúng deleted count.

**Verify**: preflight/apply exit 0, manifest remaining count bằng 0, API/Meal Plan smoke không lỗi.

## Test Plan

- `cd server && npx vitest run src/migrations/__tests__/mealPlanFoodCatalogCuration.test.js`
- `npm run test:unit:server`
- `npm run security:secrets`
- `git diff --check`

## Done Criteria

- [ ] Không label nào trong manifest còn ở production.
- [ ] `Quả bơ vỏ tím` và `Quả bơ vỏ xanh` vẫn tồn tại riêng với macro nguyên bản.
- [ ] Không còn FoodPriceObservation mồ côi cho Food đã xóa.
- [ ] Saved Meal Plan snapshot cũ vẫn đọc được; revise với Food đã xóa trả contract hiện có.
- [ ] Có backup file, checksum và production approval evidence trước apply.
- [ ] Không có secret hoặc production export được Git theo dõi.
- [ ] Bước 1–6 chưa bị thay đổi trong plan này.

## STOP Conditions

- Manifest resolve thiếu/thừa label, có label trùng hoặc tổng Food production drift sau preflight.
- Không có production admin session hoặc MONGO_URI production được guard đúng.
- Không tạo/xác minh được backup trước mutation.
- Connected database khác `MIGRATION_TARGET_DATABASE`.
- Transaction hoặc deleted count không khớp preflight.

## Maintenance Notes

- Hard-delete chỉ giải quyết catalog hiện tại; về lâu dài generator vẫn nên có allowlist/category
  server-authoritative để lần import sau không tái đưa nguyên liệu/gia vị vào Meal Plan.
- Khi import Food mới phải review eligibility trước khi production generator sử dụng.

## Production result — 2026-08-11

- Owner thực hiện xóa qua Admin Food UI; Codex xóa bản ghi `Bia` đầu tiên rồi dừng theo yêu cầu bàn giao.
- Public API xác nhận `143` label trong manifest đều không còn; tổng catalog giảm từ `548` xuống `405`.
- `17` mục nhóm nguyên liệu được owner quyết định giữ vẫn còn đủ: dầu nấu ăn, bơ thực vật, bột ca cao,
  gừng/nghệ bột, hạt tiêu, mật ong và muối.
- `Quả bơ vỏ tím` và `Quả bơ vỏ xanh` vẫn tồn tại riêng với macro nguyên bản.
- Backup public của manifest ban đầu được giữ trong `.private/` và không được Git theo dõi.
