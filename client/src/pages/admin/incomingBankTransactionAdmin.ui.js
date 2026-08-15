export const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";

export const reasonLabels = {
  ACCOUNT_MISMATCH: "Sai tài khoản nhận",
  OUTGOING_TRANSACTION: "Không phải tiền vào",
  PRE_CUTOVER_TRANSACTION: "Giao dịch trước thời điểm bật tự động",
  PRE_CUTOVER_DEPOSIT: "Yêu cầu nạp tạo trước thời điểm bật tự động",
  CODE_NOT_FOUND: "Không tìm thấy mã nạp",
  DEPOSIT_NOT_FOUND: "Mã nạp không tồn tại",
  DEPOSIT_NOT_SETTLEABLE: "Yêu cầu nạp không thể tự xử lý",
  AMOUNT_MISMATCH: "Sai số tiền",
  CODE_MISMATCH_OR_AMBIGUOUS: "Mã nạp sai hoặc không xác định",
  OUTSIDE_AUTO_SETTLEMENT_WINDOW: "Ngoài thời gian tự động đối soát",
  POSSIBLE_CROSS_CHANNEL_DUPLICATE: "Có khả năng trùng giao dịch",
  POSSIBLE_LEGACY_MANUAL_CREDIT: "Có thể đã được admin cộng thủ công",
  ADMIN_IGNORED: "Admin đã bỏ qua",
};

export const statusLabels = {
  received: "Mới nhận",
  needs_review: "Cần xử lý",
  settled: "Đã cộng ví",
  ignored: "Đã bỏ qua",
  reversed: "Đã hoàn tác",
};

export const incomingStatusFilters = [
  "needs_review",
  "received",
  "settled",
  "ignored",
  "reversed",
  "all",
];
