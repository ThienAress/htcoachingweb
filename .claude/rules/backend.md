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
- Thông báo lỗi gửi ra ngoài: mọi lỗi trả `{ success: false, code, message }`. `code` ổn định dạng `CHỮ_HOA_GẠCH_DƯỚI`; `message` là tiếng Việt
  thân thiện (chuyện gì đã xảy ra, nên làm gì), không có server, API, token, mã HTTP, tên trường database hay chi tiết thư viện.
  Dùng `sendApiError(res, error, event)` (`server/src/utils/sendApiError.js`): 5xx ghi chi tiết bằng `safeLog` và chỉ trả câu mặc định
  ở `server/src/utils/errorMessages.js`; 4xx chỉ trả `error.message` khi lỗi đánh dấu `expose: true`. Controller tự dựng phản hồi (vì cần thêm field như `data`, `details`) dùng
  `publicErrorMessage(error, câuThayThế)` (`utils/errorMessages.js`) và chỉ lấy `error.code` khi `isErrorCode`; lỗi nghiệp vụ do mình ném thì gắn `expose: true`. Không trả `error.message` thô, không dùng
  "Lỗi server"/"Lỗi hệ thống". Cổng `server/src/__tests__/errorMessages.contract.test.js` chặn thêm mới; file cũ nằm trong `errorMessageDebt.json`.
- Không hardcode production URL hay credential; dùng `process.env`.
- Query luôn có giới hạn (`.limit()`, pagination bound); xử lý `null` từ `findById`/`findOne`.
- Dịch vụ có quota, dùng thử, paywall hoặc entitlement: dùng skill `service-access-policy`.
- HT Assistant (`server/src/services/ai/`): dùng skill `ai-chat-system`; tool mới dùng `new-tool`.
