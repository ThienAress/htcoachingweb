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
| **Validation** | Input PHẢI validate ở cả client (Zod) VÀ server (express-validator). KHÔNG bỏ 1 trong 2 |
| **Upload** | PHẢI validate file type, size trong upload middleware. KHÔNG cho upload file tùy ý |

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
