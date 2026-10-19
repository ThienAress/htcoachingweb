// Câu thông báo lỗi gửi tới người dùng (khách hàng, HLV): nói điều gì đã xảy ra và nên làm gì tiếp theo,
// không dùng từ kỹ thuật (server, token, API, mã lỗi HTTP). Chi tiết kỹ thuật chỉ ghi vào log bằng safeLog.

export const DEFAULT_ERROR_MESSAGE = "Hệ thống đang bận. Bạn vui lòng thử lại sau ít phút.";

const STATUS_MESSAGES = Object.freeze({
  400: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại rồi thử lại.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy nội dung bạn cần.",
  409: "Thông tin này đã tồn tại hoặc vừa được thay đổi. Vui lòng tải lại rồi thử lại.",
  413: "Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn.",
  422: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại rồi thử lại.",
  429: "Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.",
});

const STATUS_CODES = Object.freeze({
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
});

export const messageForStatus = (status) => STATUS_MESSAGES[status] || DEFAULT_ERROR_MESSAGE;

export const codeForStatus = (status) => STATUS_CODES[status] || "INTERNAL_ERROR";

// Chỉ nhận mã lỗi dạng ỔN_ĐỊNH (CHỮ_HOA_GẠCH_DƯỚI); bỏ mã số của driver (ví dụ 11000) hoặc chuỗi tự do.
export const isErrorCode = (value) => typeof value === "string" && /^[A-Z][A-Z0-9_]{2,63}$/.test(value);

// Chỉ lộ `error.message` khi nơi ném lỗi đã đánh dấu `expose: true` (câu tiếng Việt do mình viết);
// lỗi bất ngờ (TypeError, lỗi thư viện, lỗi driver) luôn quay về câu thay thế.
export const publicErrorMessage = (error, fallback) =>
  error?.expose === true && typeof error.message === "string" && error.message.length > 0
    ? error.message
    : fallback;

// Trạng thái hợp lệ cho phản hồi lỗi; giá trị lạ (3xx, NaN) quy về 500.
export const normalizeErrorStatus = (status) =>
  Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
