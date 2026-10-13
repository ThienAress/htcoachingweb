---
paths:
  - "server/**"
---

# Backend conventions — HTCOACHINGWEB

- Layering: `routes/<module>.routes.js` khai báo endpoint + middleware chain → `controllers/<module>.controller.js`
  xử lý HTTP → `services/<module>.service.js` chứa business logic → `models/<Model>.js` chứa schema.
  Module mới tạo đủ các lớp cần thiết theo pattern này.
- Đọc model thật trước khi dùng field; không đoán schema. Thay đổi schema dùng skill `schema-change`.
- Validation dùng express-validator trong `server/src/middlewares/validation.js`, áp trong routes; giữ tách theo
  module, thêm mới vào cuối file theo pattern sẵn có.
- Mỗi loại upload có middleware riêng (`avatarUpload.js`, `coachingUpload.js`...); không gộp nhiều entity,
  luôn validate type và size.
- Response nhất quán: `res.status(...).json({ success: true, data })` hoặc `{ success: false, message }`.
  Không `res.send("OK")` hay `{ error }` lẻ.
- Error handling có cấu trúc; log bằng `safeLog` (`server/src/utils/safeLogger.js`) với metadata allowlist.
- Không hardcode production URL hay credential; dùng `process.env`.
- Query luôn có giới hạn (`.limit()`, pagination bound); xử lý `null` từ `findById`/`findOne`.
- Dịch vụ có quota, dùng thử, paywall hoặc entitlement: dùng skill `service-access-policy`.
- HT Assistant (`server/src/services/ai/`): dùng skill `ai-chat-system`; tool mới dùng `new-tool`.
