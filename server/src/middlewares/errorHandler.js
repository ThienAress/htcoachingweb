import { safeLog } from "../utils/safeLogger.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  codeForStatus,
  isErrorCode,
  messageForStatus,
  normalizeErrorStatus,
} from "../utils/errorMessages.js";

// Mọi lỗi trả về dạng { success: false, code, message, requestId }. `message` luôn là câu tiếng Việt
// thân thiện; chi tiết kỹ thuật chỉ nằm trong log (safeLog), không gửi ra ngoài.
export const errorHandler = (err, req, res, next) => {
  incrementMetric("server.errors");
  safeLog.error("global.error", err, { requestId: req.id });

  const send = (status, code, message) =>
    res.status(status).json({ success: false, code, message, requestId: req.id });

  // Lỗi upload file (Multer)
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return send(400, "FILE_TOO_LARGE", "Ảnh quá lớn. Vui lòng chọn ảnh có dung lượng nhỏ hơn.");
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return send(400, "TOO_MANY_FILES", "Quá nhiều file. Vui lòng chọn ít file hơn.");
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return send(400, "FILE_INVALID", "File không hợp lệ. Vui lòng chọn lại file khác.");
    }
    return send(400, "UPLOAD_FAILED", "Không tải được file lên. Vui lòng thử lại.");
  }

  // Lỗi file không đúng định dạng (từ fileFilter)
  if (err.message?.includes("Chỉ chấp nhận")) {
    return send(400, "FILE_TYPE_NOT_ALLOWED", err.message);
  }

  // Lỗi mongoose validation: không gửi tên trường hay thông báo của thư viện
  if (err.name === "ValidationError") {
    return send(400, "VALIDATION_FAILED", "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại các thông tin đã nhập.");
  }

  // Lỗi duplicate key (unique): không lộ tên trường trong database
  if (err.code === 11000) {
    return send(409, "DUPLICATE_VALUE", "Thông tin này đã tồn tại. Vui lòng kiểm tra lại.");
  }

  // Lỗi JWT
  if (err.name === "JsonWebTokenError") {
    return send(401, "SESSION_INVALID", "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
  }

  // Lỗi 4xx do code chủ động đánh dấu `expose` (thông báo đã được kiểm soát,
  // không chứa nội dung thô của dịch vụ ngoài) thì trả nguyên message.
  const status = normalizeErrorStatus(err.status);
  const exposeMessage = err.expose === true && status < 500 && typeof err.message === "string" && err.message;

  return send(
    status,
    exposeMessage && isErrorCode(err.code) ? err.code : codeForStatus(status),
    exposeMessage ? err.message : messageForStatus(status),
  );
};
