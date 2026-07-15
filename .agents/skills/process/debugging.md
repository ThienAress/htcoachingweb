---
name: debugging
description: Workflow debug có hệ thống. Use khi gặp bug — đặc biệt production bugs, auth failures, CORS errors, Cloudinary upload issues, hoặc bất kỳ lỗi nào không rõ root cause.
---

# Debugging — HTCoachingWeb

> **"Không đoán mò. Reproduce trước, fix sau."** — Mỗi bug phải được reproduce được mới được fix.

---

## 🛑 KHI NÀO DÙNG / KHÔNG DÙNG

**Dùng khi:**
- Bug không rõ root cause
- Production errors cần trace
- Auth/CORS/Upload failures
- AI Chat system issues (SSE, tools, cards)

**KHÔNG dùng khi:**
- Lỗi syntax/typo rõ ràng → fix trực tiếp
- Build errors → xem Vite checklist bên dưới là đủ
- UI styling issues → không cần debug workflow

---

## 🛠️ MODES

### Mode 1: Quick Triage
Khi bug có error message rõ → đọc message → LOCALIZE → FIX. Dùng checklists bên dưới.

### Mode 2: Deep Investigation
Khi không biết lỗi ở đâu → dùng Binary Search Debugging hoặc 5 bước debug đầy đủ.

---

## 🚨 PROACTIVE TRIGGERS

- **Thấy `catch (e) {}` trống** → BÁO ĐỘNG: "Silent error swallowing detected"
- **Thấy `.findById()` không check null** → BÁO ĐỘNG: "Potential null reference"
- **Thấy SSE endpoint không có `res.flushHeaders()`** → BÁO ĐỘNG: "SSE stream blocked"

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

## Binary Search Debugging 🔍

> Kỹ thuật từ [root-cause-tracing](https://github.com/obra/superpowers) — dùng khi **không biết lỗi ở đâu** trong 1 luồng dài.

**Ý tưởng:** Thay vì kiểm tra từng bước từ đầu đến cuối, **chia đôi** luồng xử lý và kiểm tra giữa. Nếu giữa OK → lỗi ở nửa sau. Nếu giữa lỗi → lỗi ở nửa trước. Lặp lại.

### Cách áp dụng

```
Luồng: A → B → C → D → E → F → G → H (8 bước)

Bước 1: Kiểm tra tại D (giữa) → OK hay lỗi?
  → Nếu D OK: lỗi ở E-H → kiểm tra F (giữa E-H)
  → Nếu D lỗi: lỗi ở A-D → kiểm tra B (giữa A-D)
Bước 2: Lặp lại cho đến khi tìm đúng điểm lỗi
```

### Ví dụ thực tế: API trả sai data

```
Luồng: Client gọi API → Route → Controller → Service → Mongoose query → Response

1. Log tại Controller (giữa) → data có đúng tại đây không?
   → Đúng → lỗi ở response format (Controller → Client)
   → Sai → lỗi ở data layer (Service → Mongoose)
   
2. Nếu lỗi ở data layer: Log tại Service
   → Query đúng nhưng data sai → lỗi ở Model/Schema
   → Query sai → lỗi ở Service logic
```

### Khi nào dùng Binary Search?

| Dùng | Không dùng |
|------|------------|
| Luồng dài (5+ bước) | Bug rõ ràng từ error message |
| Không biết lỗi ở layer nào | Đã biết file/function lỗi |
| Intermittent bugs | Simple typo/syntax errors |

---

## 🤖 AI Chat System Debugging

Checklist debug riêng cho hệ thống HT Assistant:

### SSE Stream không nhận được
```
□ Headers có đúng: Content-Type: text/event-stream?
□ res.flushHeaders() có được gọi không?
□ Proxy/Nginx có buffer SSE không? (cần X-Accel-Buffering: no)
□ CORS cho phép origin hiện tại không?
```

### Tool không được gọi
```
□ Tool có registered trong toolRegistry.js không?
□ LLM description có rõ ràng "GỌI KHI..." không?
□ Parameters schema có đúng JSON Schema format không?
□ requiresAuth: true nhưng user chưa login?
→ Chạy: node .agents/scripts/validate-tools.js
```

### UI Card không render
```
□ cardType trong tool response có match CARD_COMPONENTS trong ChatBubble.jsx không?
□ Component có được import và register không?
□ Data shape từ tool có match props mà Card expect không?
```

### Knowledge Base không match
```
□ Embedding vectors đã được generate chưa? (KnowledgeEntry.embedding)
□ Cosine similarity threshold có quá cao? (mặc định 0.75)
□ Số lượng KB entries có đủ không?
```

### Structured Logs (aiLogger)
```
→ Kiểm tra server logs với format JSON:
  {"event":"chat_start",...}   — Bắt đầu phiên chat
  {"event":"tool_call",...}    — Tool được gọi (có durationMs)
  {"event":"kb_match",...}     — KB match (có similarity score)
  {"event":"chat_error",...}   — Lỗi trong flow
  {"event":"chat_end",...}     — Kết thúc (có tổng iterations, toolCalls, durationMs)
```

---

## Debug Decision Tree

```
Bug xảy ra
    │
    ├── Có error message rõ ràng? 
    │   → YES → Đọc message → LOCALIZE → FIX
    │   → NO  ↓
    │
    ├── Biết lỗi ở layer nào?
    │   → YES → Dùng Checklist theo loại lỗi (bên dưới)
    │   → NO  ↓
    │
    ├── Luồng xử lý dài (5+ bước)?
    │   → YES → Dùng Binary Search Debugging
    │   → NO  → Dùng 5 Bước Debug (REPRODUCE → FIX)
    │
    └── Đã thử 3 lần không fix được?
        → DỪNG → Báo cáo rõ ràng những gì đã thử
```

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
