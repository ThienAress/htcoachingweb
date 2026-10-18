import { safeLog } from "./safeLogger.js";
import {
  codeForStatus,
  isErrorCode,
  messageForStatus,
  normalizeErrorStatus,
} from "./errorMessages.js";

// Trả lỗi theo hợp đồng { success: false, code, message }:
// - lỗi 5xx: chi tiết vào log (safeLog), người dùng chỉ thấy câu thân thiện;
// - lỗi 4xx: chỉ trả `error.message` khi nơi ném lỗi đánh dấu `expose: true` hoặc controller xác nhận
//   toàn bộ thông báo 4xx của nó là tiếng Việt đã kiểm soát (`exposeClientMessage`).
export const sendApiError = (res, error, event, options = {}) => {
  const status = normalizeErrorStatus(options.status ?? error?.status ?? error?.statusCode);
  if (status >= 500) safeLog.error(event, error);

  const canExpose =
    status < 500 &&
    typeof error?.message === "string" &&
    error.message.length > 0 &&
    (error.expose === true || options.exposeClientMessage === true);

  const code = isErrorCode(error?.code)
    ? error.code
    : isErrorCode(options.code)
      ? options.code
      : codeForStatus(status);
  const message = canExpose ? error.message : options.fallbackMessage || messageForStatus(status);

  return res.status(status).json({ success: false, code, message });
};
