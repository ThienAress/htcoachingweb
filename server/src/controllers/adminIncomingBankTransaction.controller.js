import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import {
  approveIncomingBankTransaction as approveIncoming,
  ignoreIncomingBankTransaction as ignoreIncoming,
  reverseIncomingBankTransaction as reverseIncoming,
} from "../services/adminIncomingBankTransaction.service.js";
import { WalletLedgerError } from "../services/walletLedger.service.js";
import { safeLog } from "../utils/safeLogger.js";

const LIST_STATUSES = new Set([
  "all",
  "received",
  "needs_review",
  "ignored",
  "settled",
  "reversed",
]);

const normalizeReason = (value) => {
  const reason = String(value || "").trim();
  if (reason.length < 8 || reason.length > 500) {
    const error = new Error("Lý do phải từ 8 đến 500 ký tự");
    error.status = 400;
    error.code = "FINANCIAL_REASON_INVALID";
    throw error;
  }
  return reason;
};

const actorFromRequest = (req) => ({
  id: req.user.id,
  role: req.user.role,
  ipAddress: req.ip,
  userAgent: req.get("User-Agent"),
});

const sendError = (res, error, event) => {
  const status =
    error instanceof WalletLedgerError ? error.status : error.status || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code:
      error instanceof WalletLedgerError
        ? error.code
        : error.code || "FINANCIAL_OPERATION_FAILED",
    message: status >= 500 ? "Lỗi hệ thống khi xử lý giao dịch" : error.message,
  });
};

export const getIncomingBankTransactions = async (req, res) => {
  try {
    const status = String(req.query.status || "needs_review");
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25));
    if (!LIST_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        code: "INCOMING_STATUS_INVALID",
        message: "Trạng thái giao dịch không hợp lệ",
      });
    }
    const filter = status === "all" ? {} : { status };
    const [items, total] = await Promise.all([
      IncomingBankTransaction.find(filter)
        .select(
          "gateway maskedAccountNumber transferType amount transactionAt depositCode depositRequestId userId status reviewReason reviewedBy reviewedAt reviewNote walletTransactionId reversalTransactionId createdAt",
        )
        .sort({ transactionAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "name email")
        .populate("depositRequestId", "amount depositCode status userId")
        .populate("reviewedBy", "name email")
        .lean(),
      IncomingBankTransaction.countDocuments(filter),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    safeLog.error("financial.incoming_list_failed", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

export const approveIncomingBankTransaction = async (req, res) => {
  try {
    const result = await approveIncoming({
      incomingId: req.params.id,
      depositRequestId: req.body?.depositRequestId,
      reason: normalizeReason(req.body?.reason),
      actor: actorFromRequest(req),
    });
    return res.status(200).json({
      success: true,
      skipped: result.skipped,
      message: result.skipped
        ? "Giao dịch này đã được cộng trước đó"
        : `Đã cộng ${result.amount.toLocaleString("vi-VN")}đ theo số tiền thực nhận`,
      data: { balanceAfter: result.balanceAfter },
    });
  } catch (error) {
    return sendError(res, error, "financial.incoming_approve_failed");
  }
};

export const ignoreIncomingBankTransaction = async (req, res) => {
  try {
    const result = await ignoreIncoming({
      incomingId: req.params.id,
      reason: normalizeReason(req.body?.reason),
      actor: actorFromRequest(req),
    });
    return res.status(200).json({
      success: true,
      skipped: result.skipped,
      message: result.skipped
        ? "Giao dịch này đã được bỏ qua trước đó"
        : "Đã đánh dấu giao dịch không cộng ví",
    });
  } catch (error) {
    return sendError(res, error, "financial.incoming_ignore_failed");
  }
};

export const reverseIncomingBankTransaction = async (req, res) => {
  try {
    const result = await reverseIncoming({
      incomingId: req.params.id,
      reason: normalizeReason(req.body?.reason),
      actor: actorFromRequest(req),
    });
    return res.status(200).json({
      success: true,
      skipped: result.skipped,
      message: result.skipped
        ? "Giao dịch này đã được hoàn tác trước đó"
        : "Đã hoàn tác giao dịch ngân hàng",
      data: { balanceAfter: result.balanceAfter },
    });
  } catch (error) {
    return sendError(res, error, "financial.incoming_reverse_failed");
  }
};
