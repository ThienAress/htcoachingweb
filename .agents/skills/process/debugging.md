---
name: debugging
description: Workflow debug có hệ thống. Use khi gặp bug — đặc biệt production bugs, auth failures, CORS errors, Cloudinary upload issues, hoặc bất kỳ lỗi nào không rõ root cause.
---

# Debugging — HTCoachingWeb

> **"Không đoán mò. Reproduce trước, fix sau."** — Mỗi bug phải được reproduce được mới được fix.

---

## 5 Bước Debug

```
REPRODUCE → LOCALIZE → REDUCE → FIX → GUARD
```

### Bước 1: REPRODUCE
Xác nhận bug tái hiện được một cách nhất quán:
- Ghi lại **chính xác** các bước để trigger bug
- Xác định: môi trường nào? (local/staging/production)
- Xác định: luôn xảy ra hay intermittent?
- Nếu không reproduce được → **DỪNG**, báo cáo với user trước khi tiếp tục

### Bước 2: LOCALIZE
Thu hẹp vị trí lỗi:
- Đọc error message và stack trace từ **trên xuống dưới**
- Xác định layer bị lỗi: FE component → service → API → controller → DB?
- Kiểm tra network tab (request/response format có đúng không?)
- Kiểm tra console errors ở cả browser và server terminal

### Bước 3: REDUCE
Cô lập vấn đề nhỏ nhất có thể:
- Loại bỏ từng yếu tố cho đến khi tìm được nguyên nhân tối thiểu
- Đặt câu hỏi: "Nếu bỏ X đi thì bug có còn không?"
- Không fix nhiều thứ một lúc — fix từng nguyên nhân một

### Bước 4: FIX
Implement fix tối thiểu:
- Chỉ thay đổi code trực tiếp liên quan đến root cause
- Không refactor hoặc "cải thiện" code bên cạnh khi đang fix bug
- Verify fix giải quyết đúng bug đã reproduce ở Bước 1

### Bước 5: GUARD
Ngăn bug tái hiện:
- Thêm comment nếu fix không self-evident
- Nếu bug nghiêm trọng → ghi vào `skills/known_issues.md`
- Nếu project đã có test → thêm test case cover scenario này

---

## Quy Tắc Retry

> Từ GEMINI.md: Nếu AI mắc lỗi → **tự đọc error → phân tích → sửa → retry (tối đa 3 lần)**. Sau 3 lần → DỪNG, báo cáo rõ ràng những gì đã thử và tại sao không thành công.

---

## Checklist Theo Loại Lỗi Thường Gặp

### 🔐 Auth / JWT Errors
```
□ Token có trong httpOnly cookie không? (Network tab → Request Headers → Cookie)
□ CSRF token có được gửi kèm không? (Headers → x-csrf-token)
□ Token có bị expired không? (Decode JWT tại jwt.io)
□ Role trong token có match với route guard không?
□ CORS origin có include đúng domain không? (server.js → corsOptions)
```

### 🌐 CORS Errors
```
□ Request origin có nằm trong allowedOrigins[] của server không?
□ Credential mode: axios có withCredentials: true không?
□ Preflight (OPTIONS) request có được handle không?
□ Environment variable FRONTEND_URL có đúng không?
```

### ☁️ Cloudinary Upload Fails
```
□ Multer middleware có được gắn đúng vào route không?
□ File size có vượt limit của multer không?
□ CLOUDINARY_* env vars có đúng không? (cloud_name, api_key, api_secret)
□ Upload preset có tồn tại trên Cloudinary dashboard không?
□ Field name trong FormData có match với multer config không?
```

### 🗄️ Mongoose Validation Errors
```
□ Đọc kỹ error.errors object — field nào fail, tại sao?
□ Schema có required fields nào không được gửi lên không?
□ Kiểu dữ liệu có match (String vs ObjectId, Number vs String)?
□ Unique constraint bị vi phạm? (duplicate key error code 11000)
□ Enum values có nằm trong danh sách cho phép không?
```

### 📦 Build Errors (Vite)
```
□ Import path có đúng (case-sensitive trên Linux/Netlify)?
□ Circular imports? (thường gây "Cannot access X before initialization")
□ Lazy import syntax đúng: lazy(() => import("./pages/X")) ?
□ Missing dependency trong package.json?
□ Environment variable có prefix VITE_ không? (nếu dùng ở FE)
```

### 🔄 API Response Không Đúng Format
```
□ Controller có return đúng structure không? { success, data/message }
□ Có middleware nào intercept và transform response không?
□ axios instance (utils/api.js) có interceptor nào ảnh hưởng không?
□ Pagination params có được parse đúng (parseInt) không?
```

---

## Ghi Chú Debug Hữu Ích

```js
// Tạm thời log request đến server (xóa sau khi debug xong)
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.path}`, req.body);
  next();
});

// Kiểm tra JWT payload (server-side)
import jwt from 'jsonwebtoken';
const decoded = jwt.decode(token); // không verify, chỉ decode
console.log('[DEBUG] Token payload:', decoded);
```

> ⚠️ Xóa toàn bộ debug logs trước khi deliver — xem `skills/cleanup-delivery`.
