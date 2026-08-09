---
name: debugging
description: Debug có hệ thống theo Quick Triage hoặc Deep Investigation. Dùng khi gặp production bug, auth/CORS/upload failure, AI Chat issue, lỗi intermittent hoặc lỗi chưa rõ root cause; không áp workflow sâu cho typo, syntax error hay UI styling đơn giản.
---

# Debugging — HTCoachingWeb

> **"Không đoán mò. Tạo feedback loop trước, fix sau."**

---

## 🛑 KHI NÀO DÙNG / KHÔNG DÙNG

**Dùng khi:**
- Bug không rõ root cause
- Production errors cần trace
- Auth/CORS/Upload failures
- AI Chat system issues (SSE, tools, cards)

**KHÔNG dùng khi:**
- Lỗi syntax/typo rõ ràng → fix trực tiếp
- Build error rõ nguyên nhân → xem Vite checklist bên dưới là đủ
- UI styling đơn giản → không cần debug workflow

---

## 🛠️ MODES

### Mode 1: Quick Triage

Khi error message và vị trí lỗi rõ: đọc message → chạy kiểm tra hẹp nhất sẵn có → LOCALIZE → FIX → chạy lại kiểm tra. Dùng checklist bên dưới; không lập bảng hypotheses hoặc post-mortem nếu bug đơn giản, rủi ro thấp.

### Mode 2: Deep Investigation

Khi chưa biết lỗi ở đâu, bug intermittent/cross-layer/production-only, hoặc Quick Triage không giải thích được nguyên nhân: đọc và làm theo toàn bộ [Deep Investigation](references/deep-investigation.md). Không sửa code trước khi đã chạy một feedback command có khả năng RED.

---

## 🚨 PROACTIVE TRIGGERS

- **Thấy `catch (e) {}` trống** → BÁO ĐỘNG: "Silent error swallowing detected"
- **Thấy `.findById()` không check null** → BÁO ĐỘNG: "Potential null reference"
- **Thấy SSE endpoint không có `res.flushHeaders()`** → BÁO ĐỘNG: "SSE stream blocked"

---

## Deep Investigation Contract

Chỉ áp contract này cho Mode 2:

1. Chạy một command có thể fail khi bug còn tồn tại và pass sau fix.
2. Reproduce rồi reduce về fixture/flow nhỏ nhất.
3. Lập 3–5 hypotheses có thứ hạng và có thể bác bỏ.
4. Thử từng probe, mỗi lần chỉ đổi một biến và ghi prediction trước khi chạy.
5. Fix tối thiểu, thêm regression test ở đúng public seam, chạy lại command RED → GREEN.
6. Xóa instrumentation có tag và ghi post-mortem tương xứng mức độ sự cố.

Chi tiết bắt buộc, mẫu evidence và Binary Search Debugging nằm trong [Deep Investigation](references/deep-investigation.md).

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
→ Chạy: node .agents/scripts/validate-tools.mjs
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
    ├── Có error message và vị trí lỗi rõ ràng?
    │   → YES → Quick Triage → LOCALIZE → FIX → chạy lại kiểm tra
    │   → NO  ↓
    │
    ├── Biết lỗi ở layer nào?
    │   → YES → Dùng Checklist theo loại lỗi (bên dưới)
    │   → NO  ↓
    │
    ├── Luồng xử lý dài (5+ bước)?
    │   → YES → Deep Investigation + Binary Search
    │   → NO  → Deep Investigation (REPRODUCE → GUARD)
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
□ Token có bị expired không? (decode local; chỉ inspect allowlist claim như `exp`, `iat`, `role`)
□ Role trong token có match với route guard không?
□ CORS origin có include đúng domain không? (server.js → corsOptions)
```

> Không paste JWT, cookie hoặc credential vào `jwt.io` hay bất kỳ dịch vụ bên thứ ba nào. Khi cần inspect, decode hoàn toàn trên máy local bằng dependency hiện có hoặc debugger; không log raw token hay toàn bộ payload.

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
// Chỉ dùng trên local; không thêm debug logging vào staging/production.
// Log metadata allowlist, không log giá trị req.body, cookie hoặc authorization header.
// Dùng safeLog từ server/src/utils/safeLogger.js với relative import phù hợp.
if (process.env.NODE_ENV === "development") {
  safeLog.info("request.debug", {
    method: req.method,
    path: req.path,
    requestId: req.id,
  });

  // Decode JWT hoàn toàn local và chỉ inspect claim allowlist.
  // Không log raw token hoặc toàn bộ decoded payload.
  const decoded = jwt.decode(token);
  const jwtDebug = decoded
    ? { exp: decoded.exp, iat: decoded.iat, role: decoded.role }
    : { decodeFailed: true };
  safeLog.info("jwt.debug", jwtDebug);
}
```

> ⚠️ Các snippet trên chỉ được dùng ở local. Không bật hoặc thêm debug logging trên staging/production. Dù `safeLog` có redaction, vẫn không truyền token, cookie, authorization header, password, secret hoặc PII vào logger. Xóa toàn bộ debug logs trước khi deliver — xem `../cleanup-delivery/SKILL.md`.
