---
name: schema-change
trigger: /schema-change
description: Workflow thay đổi Mongoose schema an toàn. Use khi thêm/sửa/xóa field trong bất kỳ Model nào. Đảm bảo không bỏ sót controllers, services, routes, và validation bị ảnh hưởng.
---

# /schema-change — Thay Đổi Mongoose Schema An Toàn

> **Tại sao cần workflow này?** htcoachingweb có 26 models và 17 controllers. Thay đổi 1 field trong schema mà không trace hết các nơi dùng → API trả sai data, validation fail, hoặc data bị corrupt.

---

## Input cần thiết

Trước khi bắt đầu, xác nhận:
- **Model bị thay đổi:** (VD: `User`, `Subscription`, `Food`)
- **Loại thay đổi:** Thêm field / Sửa field / Xóa field / Thêm index
- **Chi tiết thay đổi:** (VD: Thêm `generationCount: { type: Number, default: 0 }`)
- **Lý do:** (VD: "Track số lần user dùng meal generator")

---

## Bước 1: Phân Tích Impact 🔍

Trước khi chạm vào bất kỳ file nào, tìm TẤT CẢ nơi dùng Model này:

```bash
# Tìm tất cả nơi import Model
grep -r "require.*ModelName\|import.*ModelName" server/src/ --include="*.js"

# Tìm tất cả nơi query Model
grep -r "ModelName\." server/src/ --include="*.js"
```

Liệt kê kết quả:
- [ ] Controllers bị ảnh hưởng: [danh sách]
- [ ] Services bị ảnh hưởng: [danh sách]
- [ ] Routes bị ảnh hưởng: [danh sách]
- [ ] Frontend services bị ảnh hưởng: [danh sách nếu có]

**Verify:** Đã có danh sách đầy đủ trước khi tiếp tục.

---

## Bước 2: Cập Nhật Schema 📋

```js
// server/src/models/ModelName.js
const modelNameSchema = new mongoose.Schema({
  // ... existing fields ...
  newField: {
    type: Number,      // hoặc String, Boolean, ObjectId, Date...
    default: 0,        // nếu cần
    required: false,   // hoặc true nếu bắt buộc
    // index: true     // nếu cần index
  },
});
```

**Quy tắc:**
- Field mới: Nên có `default` để không break documents cũ
- Xóa field: Cân nhắc `select: false` thay vì xóa hẳn (an toàn hơn)
- Thay đổi type: Cực kỳ nguy hiểm — luôn hỏi user trước

**Verify:** Schema cú pháp đúng, field mới có default nếu là optional.

---

## Bước 3: Cập Nhật Validation 🛡️

```js
// server/src/middlewares/validation.js
// Tìm validator của Model này và cập nhật:
body('newField')
  .optional()
  .isInt({ min: 0 })
  .withMessage('newField must be a non-negative integer'),
```

**Verify:** Validation mới được thêm đúng chỗ, theo pattern hiện có trong file.

---

## Bước 4: Cập Nhật Controllers 🎮

Với mỗi controller trong danh sách từ Bước 1:

- [ ] **Create endpoint:** Có xử lý field mới không? (nếu cần)
- [ ] **Update endpoint:** Có cho phép update field mới không? (nếu cần)
- [ ] **Read endpoint:** Response có include field mới không? (nếu cần)
- [ ] **Projection:** Nếu dùng `select()`, có cần thêm field mới không?

**Verify:** Mỗi controller affected đã được review.

---

## Bước 5: Cập Nhật Services (nếu có) ⚙️

Với mỗi service trong danh sách:
- [ ] Business logic có cần adjust theo field mới không?
- [ ] Cron jobs có query field này không?

---

## Bước 6: Cập Nhật Frontend Service Layer 🖥️

Nếu field mới cần hiển thị hoặc gửi từ frontend:

```js
// client/src/services/{module}.service.js
// Cập nhật request body hoặc response handling
```

**Verify:** Frontend service đồng bộ với schema mới.

---

## Bước 7: Kiểm Tra Data Hiện Có ⚠️

**Câu hỏi bắt buộc phải hỏi user:**

> "Schema thay đổi này ảnh hưởng đến **documents hiện có** trong database như thế nào?
> - Nếu thêm required field không có default → documents cũ sẽ fail validation
> - Nếu xóa field → data cũ vẫn còn trong DB (MongoDB không tự xóa)
> - Nếu rename field → cần migration script
>
> Bạn có cần migration script không?"

---

## Output Format

```
🗄️ SCHEMA CHANGE CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Model: [ModelName]
Change: [Mô tả thay đổi]

[1/7] Impact Analysis   ✅ Tìm thấy: 2 controllers, 1 service
[2/7] Schema Update     ✅ Field mới có default value
[3/7] Validation        ✅ Added to validation.js
[4/7] Controllers       ✅ user.controller.js updated
[5/7] Services          ⏭️ SKIP (no service affected)
[6/7] Frontend Service  ✅ user.service.js updated
[7/7] Data Migration    ⚠️ CẦN XEM XÉT — hỏi user

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT: ⚠️ PENDING — Cần user confirm về migration trước khi deploy
```
