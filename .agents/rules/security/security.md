---
name: security-rules
description: Quy tắc bảo mật bắt buộc — Auth flow, CSRF, JWT, rate limiting, file nhạy cảm. KHÔNG ĐƯỢC vi phạm dưới bất kỳ hình thức nào.
---

# Security Rules — HTCoachingWeb

> Quy tắc bảo mật bắt buộc. KHÔNG ĐƯỢC vi phạm dưới bất kỳ hình thức nào.

---

## Auth Flow — KHÔNG ĐƯỢC PHÁ

```
[Login] → Google OAuth / Admin login
    ↓
[Server] → Set httpOnly cookies: accessToken + refreshToken
    ↓
[Client] → api.js interceptor tự gắn CSRF token (từ cookie)
    ↓
[Request] → Cookie (JWT) + Header (X-CSRF-Token)
    ↓
[Server] → auth.middleware.js verify JWT + CSRF
    ↓
[401] → api.js interceptor tự call /auth/refresh → retry request
    ↓
[Refresh fail] → redirect /login
```

### Luồng chi tiết

1. **Login**: User login bằng Google OAuth → server gọi Passport → verify → tạo JWT
2. **Token storage**: `accessToken` + `refreshToken` = **httpOnly cookies** — frontend KHÔNG đọc được
3. **CSRF**: Server tạo `csrfToken` cookie (NOT httpOnly) → client đọc qua `js-cookie` → gắn vào header `X-CSRF-Token`
4. **Request**: Mỗi request mutating (POST/PUT/DELETE) gửi: cookies (JWT) + header (CSRF)
5. **Interceptor**: `utils/api.js` tự handle: gắn CSRF, auto-refresh khi 401, redirect khi refresh fail

---

## Rules Bắt Buộc

| Rule | Chi tiết |
|------|---------|
| **CSRF** | Mọi request mutating PHẢI có `X-CSRF-Token` header. Đã handle trong `utils/api.js` — **KHÔNG SỬA** file này trừ khi có lý do rõ ràng |
| **JWT cookies** | `accessToken` và `refreshToken` là **httpOnly** — frontend KHÔNG đọc/xóa được. Chỉ server quản lý |
| **Environment** | `.env` files KHÔNG được commit. KHÔNG in nội dung `.env` ra chat. KHÔNG hardcode credentials |
| **Rate Limiting** | Production có rate limit (`rateLimit.js`). KHÔNG xóa hoặc tăng limit quá mức |
| **Role check** | Backend PHẢI check role bằng middleware trước khi xử lý. KHÔNG trust role từ frontend |
| **Validation** | Server PHẢI validate mọi input không tin cậy. Form user-facing validate thêm ở client bằng Zod để có UX tốt, nhưng client validation không thay thế server validation |
| **Upload** | PHẢI validate file type, size trong upload middleware. KHÔNG cho upload file tùy ý |

---

## Dữ Liệu Nhạy Cảm & Quyền Truy Cập

Xem dữ liệu sức khỏe, đánh giá cơ thể, ảnh/video, hội thoại AI, thông tin định danh,
token, cookie và dữ liệu tài chính là dữ liệu nhạy cảm.

| Rule | Chi tiết |
|------|---------|
| **Least privilege** | Query chỉ lấy field cần dùng; không trả raw document nếu response contract không cần toàn bộ fields |
| **Ownership/IDOR** | Endpoint user-accessible lấy object theo ID phải ràng buộc ownership/assignment ở backend. Không dựa vào việc frontend đã ẩn link |
| **Logging** | Không log raw request body, cookie, token, health payload, ảnh chữ ký hoặc nội dung hội thoại. Dùng `safeLog` với metadata allowlist |
| **Projection** | DTO/response phải loại internal notes, audit metadata, secret/provider fields và dữ liệu của user khác |
| **Retention** | Không tự thêm retention, export, delete hoặc anonymization semantics. Thay đổi privacy lifecycle cần spec và impact check riêng |
| **Media** | Media nhạy cảm không mặc định public; dùng delivery đã được authorization hoặc signed/expiring URL theo pattern hiện có |

Admin role không tự động loại bỏ yêu cầu audit/least privilege. Với read/write dữ liệu
sức khỏe hoặc tài chính, kiểm tra permission, mục đích endpoint và audit requirements
trong domain hiện tại.

---

## Query, External Input & Integration Safety

- Không spread trực tiếp `req.body` vào Mongoose create/update. Dùng allowlist fields và
  validation contract để ngăn mass assignment, operator injection và prototype keys.
- Object ID, enum, sort, filter, pagination và regex input phải được validate/bound trước
  khi đưa vào query. Không cho client truyền tùy ý Mongo operators.
- Code fetch URL do user/provider cung cấp phải chống SSRF: allowlist protocol/domain,
  chặn loopback/private/link-local targets và đặt timeout/size limit.
- Webhook/callback phải verify signature theo raw payload khi provider yêu cầu, chống
  replay và giữ handler idempotent trước khi mutation.
- Redirect URL phải lấy từ allowlist/canonical config; không redirect thẳng tới URL từ
  query/body chưa kiểm tra.
- Khi thêm external domain, kiểm tra đồng thời CORS, Helmet CSP, privacy impact và cách
  credential được truyền; không nới wildcard chỉ để request chạy được.

---

## Files Nhạy Cảm — KHÔNG SỬA Trừ Khi Được Yêu Cầu

| File | Lý do |
|------|-------|
| `client/src/utils/api.js` | Chứa toàn bộ logic CSRF + JWT refresh interceptor |
| `client/src/context/AuthContext.jsx` | Auth state management |
| `server/src/middlewares/auth.middleware.js` | JWT verify + role check |
| `server/src/middlewares/csrf.js` | CSRF token generation + validation |
| `server/src/middlewares/rateLimit.js` | Rate limiting config |
| `server/src/config/passport.js` | Google OAuth config |

---

## Lệnh CẤM

| ❌ Tuyệt đối KHÔNG | Lý do |
|-------------------|-------|
| `DROP TABLE`, `db.dropDatabase()` | Phá hủy dữ liệu |
| `rm -rf`, xóa thư mục quan trọng | Phá hủy project |
| In API keys, JWT secrets ra chat | Lộ credentials |
| Disable CSRF protection | Mở lỗ hổng bảo mật |
| Disable rate limiting trong production | Mở cho DDoS |
| Hardcode production URLs trong code | Dùng env variables |
| Sửa `utils/api.js` interceptor logic | Phá auth flow |
