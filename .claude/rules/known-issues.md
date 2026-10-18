---
paths:
  - "server/src/middlewares/securityHeaders.js"
  - "server/src/middlewares/validation.js"
  - "server/server.js"
  - "client/src/pages/admin/KnowledgeBase.jsx"
  - "client/src/pages/admin/CustomerStoryManagement.jsx"
  - "client/src/pages/trainer/TrainerCoaching.jsx"
  - "client/src/pages/customer/OnlineCoaching.jsx"
  - "client/src/sections/Pricing.jsx"
---

# Known issues và pattern có chủ đích

Đây là hành vi by-design. Không "sửa" khi user không yêu cầu, và không báo thành finding khi review/audit
(ghi vào mục "Considered and rejected").

| Pattern | Lý do |
|---|---|
| CSP có `'unsafe-inline'` ở `scriptSrc`/`styleSrc` (`securityHeaders.js`) | Cần cho GA4 inline snippet và Tailwind |
| `crossOriginResourcePolicy: cross-origin` | Cho ảnh Cloudinary load cross-origin |
| `frameSrc` có `https://www.youtube.com` | YouTube embed trong trang coaching; không đổi về `'none'` |
| CSP chỉ bật ở production, mặc định report-only trừ khi `CSP_ENFORCE=true` | Rollout CSP có kiểm soát |
| `server/src/middlewares/validation.js` chứa validation của mọi module | Pattern có chủ đích; thêm validation mới vào cuối file theo pattern sẵn có, không gộp module |
| Inline imports trong `server/server.js` | Giữ nguyên nếu không thuộc task |
| File UI rất lớn (`KnowledgeBase.jsx`, `CustomerStoryManagement.jsx`, `TrainerCoaching.jsx`, `OnlineCoaching.jsx`, `sections/Pricing.jsx`) | Đã biết, chưa ưu tiên tách; chỉ sửa đúng đoạn cần |
| Quote style `""` và `''` lẫn lộn | Không enforce; giữ style của file đang sửa |
| Netlify preview đỏ với `Rendered ... does not match the approved cohort` khi các check GitHub khác xanh | Backend Render ngủ lúc prerender, không phải lỗi code. Ping `/api/health` tới khi trả dưới 2 giây rồi Retry deploy; chỉ điều tra code khi vẫn đỏ sau khi backend đã tỉnh |

Thêm domain/service ngoài mới thì cập nhật directive CSP tương ứng trong `buildCspDirectives`; nếu không,
resource bị chặn trên production. Danh sách domain canonical là chính code, không chép ra tài liệu.
