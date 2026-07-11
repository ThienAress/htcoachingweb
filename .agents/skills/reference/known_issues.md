---
name: known-issues
description: Danh sách vấn đề đã biết trong project. Use khi làm việc với các file lớn (TrainerCoaching, Pricing, OnlineCoaching), server.js inline imports, hoặc bất kỳ thứ gì liên quan đến dead code và workaround có chủ đích.
---

# Known Issues — HTCoachingWeb

> Vấn đề đã biết trong project. AI đọc để hiểu context, nhưng ĐỪNG tự ý sửa trừ khi user yêu cầu.

---

## ⚠️ Danh Sách Vấn Đề

| # | Vấn đề | File | Chi tiết | Hành động |
|:-:|--------|------|---------|-----------|
| 1 | **Dead code file** | `pages/admin/TrainerManagement.old.jsx` (71KB) | File backup cũ, chưa xóa | ⚠️ ĐỪNG xóa. Mention nếu liên quan |
| 2 | **Inline imports** | `server.js` (dòng 152-178) | Một số import nằm giữa file thay vì đầu file | ⚠️ ĐỪNG move. Có chủ đích |
| 3 | **File quá lớn** | `TrainerCoaching.jsx` (50K), `Pricing.jsx` (42K), `OnlineCoaching.jsx` (39K) | Cần refactor nhưng chưa ưu tiên | ⚠️ Khi sửa trong file này, chỉ sửa phần yêu cầu |
| 4 | **Validation khổng lồ** | `middlewares/validation.js` (25K) | 1 file chứa ALL validations | ⚠️ Khi thêm validation mới → thêm vào cuối file theo pattern |
| 5 | **No tests** | `server/package.json` | `"test": "echo Error..."` | ⚠️ Chưa setup test — xem `skills/testing.md` |
| 6 | **Empty directory** | `client/src/data/` | Folder rỗng | ⚠️ Có thể dùng cho static data trong tương lai |
| 7 | **GA4 placeholder** | `client/index.html` dòng 6, 11 | `GA_MEASUREMENT_ID` chưa thay bằng mã thật | ⚠️ Đợi user cung cấp mã thật |

---

## Nguyên Tắc Xử Lý

1. **Đọc để hiểu context** — biết vấn đề tồn tại để tránh tạo thêm vấn đề mới
2. **KHÔNG tự ý sửa** — trừ khi user yêu cầu cụ thể "fix vấn đề X"
3. **Mention khi liên quan** — VD: "Tôi thấy `TrainerManagement.old.jsx` (71K) còn tồn tại. Bạn muốn xóa không?"
4. **Khi sửa file lớn** — chỉ sửa phần cần thiết, KHÔNG refactor cả file

---

## 🔍 By-Design Conventions (Cho `/audit` — KHÔNG report)

Khi chạy `/audit`, những pattern sau là **có chủ đích** — KHÔNG phải findings:

| Pattern | Lý do |
|---------|-------|
| Inline imports `server.js:152-178` | Import có chủ đích, không move |
| Mixed quote style (`""` và `''`) | Project convention, không enforce |
| File >300 dòng (3 files >39K) | Biết rồi, chưa ưu tiên refactor |
| `TrainerManagement.old.jsx` 71K | File backup cũ, chưa xóa |
| `validation.js` 25K 1-file-all | Pattern có chủ đích |
| `GA_MEASUREMENT_ID` placeholder | Đợi user cung cấp mã thật |
| `"test": "echo Error..."` | Chưa setup test — biết rồi |
| `htcoachingweb.onrender.com` hardcode trong Login | Google OAuth callback URL phải match Google Console — đây là intentional |
| CSP `'unsafe-inline'` cho scriptSrc/styleSrc | Cần cho GA4 inline script + Tailwind CSS |
| `crossOriginResourcePolicy: false` | Cho phép Cloudinary images load cross-origin |
| `console.error()` trong non-critical controllers | Chưa migrate sang `safeLog` — chỉ critical paths (auth, error handler) đã migrate. Dần migrate khi sửa file |

Ghi vào "Considered and rejected" trong audit report khi gặp — để không re-audit lần sau.

---

## 🛡️ Security Patterns Đã Establish

> Những patterns bảo mật đã implement — AI PHẢI duy trì, KHÔNG revert.

| Pattern | File | Chi tiết |
|---------|------|---------|
| **CSRF timing-safe** | `middlewares/csrf.js` | Dùng `crypto.timingSafeEqual()` thay `!==`. KHÔNG revert |
| **Contract IDOR** | `controllers/contract.controller.js` | 5 endpoints có ownership check (clientId/trainerId). KHÔNG bỏ |
| **F1 IDOR** | `controllers/f1Customer/shared.js` | `assertCustomerAccess()` check assignedTrainerId. KHÔNG bỏ |
| **Deposit IDOR** | `controllers/deposit.controller.js` | `findOne({ _id, userId })`. KHÔNG đổi sang `findById` |
| **Helmet CSP** | `server.js` dòng 108-155 | Production-only CSP. Xem bảng CSP Domains bên dưới |
| **Safe Logger** | `utils/safeLogger.js` | PII redaction cho production logs. Dùng cho auth, error handler |
| **Security.txt** | `client/public/.well-known/security.txt` | RFC 9116. KHÔNG xóa |
| **NPM audit script** | `package.json` (cả 2) | `security:audit` → `npm audit --audit-level=high`. Đã tích hợp vào `/ship` Bước 3 |
| **MongoDB Atlas Encryption** | N/A (Atlas managed) | Atlas mặc định bật Encryption at Rest (AES-256). KHÔNG cần encrypt PII ở tầng app trừ khi có compliance requirement |

---

## 🔒 CSP Domains Đã Whitelist (server.js dòng 108-155)

> Khi thêm service/domain mới vào project → PHẢI cập nhật CSP whitelist tương ứng.
> Nếu không, resource sẽ bị block trên production (CSP chỉ enable ở prod).

| Directive | Domains | Lý do |
|-----------|---------|-------|
| `scriptSrc` | `'self'`, `googletagmanager.com`, `google-analytics.com`, `'unsafe-inline'` | GA4 scripts + inline snippet |
| `styleSrc` | `'self'`, `fonts.googleapis.com`, `'unsafe-inline'` | Google Fonts CSS + Tailwind |
| `fontSrc` | `'self'`, `fonts.gstatic.com` | Google Fonts files |
| `imgSrc` | `'self'`, `data:`, `blob:`, `res.cloudinary.com`, `googletagmanager.com`, `lh3.googleusercontent.com`, `i.pravatar.cc`, `images.unsplash.com`, `img.vietqr.io`, `placehold.co` | Ảnh upload, avatar Google, default avatar, login bg, QR nạp tiền, placeholder |
| `mediaSrc` | `'self'`, `res.cloudinary.com`, `blob:` | Video/audio upload |
| `connectSrc` | `'self'`, `google-analytics.com`, `googletagmanager.com`, `...allowedOrigins` | API calls + GA4 |
| `frameSrc` | `'self'`, `www.youtube.com` | YouTube embed trong Coaching pages |
| `objectSrc` | `'none'` | Block Flash/applets |
| `baseUri` | `'self'` | Chống base tag injection |
| `formAction` | `'self'` | Chống form hijacking |

**Lưu ý quan trọng:**
- `frameSrc: ['none']` sẽ **BLOCK YouTube embeds** — đã fix sang `['self', 'www.youtube.com']`
- `'unsafe-inline'` trong `scriptSrc`/`styleSrc` là cần thiết cho GA4 + Tailwind — KHÔNG xóa
- `crossOriginResourcePolicy: false` cho phép Cloudinary images load cross-origin — KHÔNG bật lại

