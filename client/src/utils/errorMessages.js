// Chuyển mọi lỗi (axios, Error thường, phản hồi của máy chủ) thành một câu tiếng Việt dễ hiểu cho khách hàng và HLV:
// nói điều gì đã xảy ra, không dùng từ kỹ thuật. Chi tiết kỹ thuật chỉ xem ở console hoặc log máy chủ.

export const GENERIC_ERROR_MESSAGE = "Có lỗi xảy ra. Vui lòng thử lại.";
export const OFFLINE_ERROR_MESSAGE = "Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.";
export const SLOW_ERROR_MESSAGE = "Kết nối quá chậm. Vui lòng thử lại.";

const STATUS_MESSAGES = {
  400: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại rồi thử lại.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy nội dung bạn cần.",
  409: "Thông tin này đã tồn tại hoặc vừa được thay đổi. Vui lòng tải lại rồi thử lại.",
  413: "Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn.",
  422: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại rồi thử lại.",
  429: "Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.",
};
const SERVER_FAILURE_MESSAGE = "Hệ thống đang bận. Bạn vui lòng thử lại sau ít phút.";

// Mã lỗi mà máy chủ có thể kèm thông báo tiếng Anh hoặc kỹ thuật: luôn dùng câu của giao diện.
const CODE_MESSAGES = {
  CSRF_TOKEN_MISSING: "Phiên làm việc đã hết hạn. Vui lòng tải lại trang rồi thử lại.",
  CSRF_TOKEN_INVALID: "Phiên làm việc đã hết hạn. Vui lòng tải lại trang rồi thử lại.",
  SESSION_INVALID: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
  AUTH_REQUIRED: "Bạn cần đăng nhập để tiếp tục.",
  RATE_LIMITED: STATUS_MESSAGES[429],
};

const VIETNAMESE_LETTER =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
// Từ kỹ thuật không được để người dùng nhìn thấy.
const TECHNICAL_WORDS =
  /\b(?:server|api|token|timeout|network|request|response|status code|axios|undefined|null|nan|error|exception|failed|json|syntax|cors|csrf|mongo|database)\b|\[object|\b[45]\d\d\b|lỗi\s+(?:server|hệ thống)|máy chủ/i;

// Thông báo dùng được khi có dấu tiếng Việt và không chứa từ kỹ thuật.
export const isFriendlyMessage = (message) =>
  typeof message === "string" &&
  message.trim().length > 0 &&
  VIETNAMESE_LETTER.test(message) &&
  !TECHNICAL_WORDS.test(message);

const isTimeout = (error) =>
  error?.code === "ECONNABORTED" || /timeout/i.test(String(error?.message || ""));

export const getUserErrorMessage = (error, fallback = GENERIC_ERROR_MESSAGE) => {
  const response = error?.response;

  if (!response) {
    // Không nhận được phản hồi: mất mạng hoặc quá chậm; lỗi tự viết ở giao diện bằng tiếng Việt vẫn dùng được.
    if (error?.request || error?.isAxiosError) {
      return isTimeout(error) ? SLOW_ERROR_MESSAGE : OFFLINE_ERROR_MESSAGE;
    }
    return isFriendlyMessage(error?.message) ? error.message : fallback;
  }

  const { code, message } = response.data || {};
  if (typeof code === "string" && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (isFriendlyMessage(message)) return message;

  const status = response.status;
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return SERVER_FAILURE_MESSAGE;
  return fallback;
};
