import crypto from "crypto";
import DepositRequest from "../models/DepositRequest.js";
import Wallet from "../models/Wallet.js";
import { safeLog } from "../utils/safeLogger.js";
import { validateDepositAmount } from "../constants/depositPolicy.js";
import {
  addSettlementSummary,
  getDepositSettlementSummaryMap,
} from "../services/depositSettlementRead.service.js";

const getBankTransferConfig = () => {
  const config = {
    bankName: String(process.env.BANK_NAME || "").trim(),
    bankCode: String(process.env.BANK_CODE || "").trim(),
    accountNumber: String(process.env.BANK_ACCOUNT || "").trim(),
    accountHolder: String(process.env.BANK_HOLDER || "").trim(),
  };
  if (Object.values(config).some((value) => !value)) {
    const error = new Error("Bank transfer configuration is unavailable");
    error.status = 503;
    error.code = "BANK_TRANSFER_CONFIG_UNAVAILABLE";
    throw error;
  }
  return config;
};

// ===== Sinh mã nạp tiền ngẫu nhiên (entropy cao, khó đoán) =====
function generateDepositCode() {
  // Tạo chuỗi 8 ký tự hex ngẫu nhiên, chia thành 2 nhóm 4 ký tự
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `HTC-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

// ===== POST /api/deposits — Tạo yêu cầu nạp tiền =====
export const createDeposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    const amountValidation = validateDepositAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({
        success: false,
        code: amountValidation.code,
        message: amountValidation.message,
      });
    }

    const now = new Date();
    await DepositRequest.updateMany(
      {
        userId,
        status: "pending",
        expiresAt: { $lte: now },
      },
      {
        $set: {
          status: "expired",
          isOpen: false,
        },
      },
    );

    const existingOpen = await DepositRequest.findOne({
      userId,
      isOpen: true,
    });

    if (existingOpen?.status === "pending") {
      return res.status(200).json({
        success: true,
        message: "Bạn đang có mã nạp tiền chưa hết hạn",
        data: {
          depositRequestId: existingOpen._id,
          amount: existingOpen.amount,
          depositCode: existingOpen.depositCode,
          qrPayload: existingOpen.qrPayload,
          expiresAt: existingOpen.expiresAt,
          status: existingOpen.status,
        },
      });
    }
    if (existingOpen) {
      return res.status(409).json({
        success: false,
        code: "OPEN_DEPOSIT_EXISTS",
        message:
          "Bạn đang có giao dịch chờ admin duyệt. Vui lòng đợi giao dịch hiện tại được xử lý trước khi tạo yêu cầu mới.",
      });
    }

    // Đảm bảo user đã có wallet (tự tạo nếu chưa có)
    const bankTransfer = getBankTransferConfig();

    await Wallet.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, balance: 0, currency: "VND", version: 0 } },
      { upsert: true, returnDocument: 'after' }
    );

    // Sinh mã nạp tiền unique
    const depositCode = generateDepositCode();

    // Thời hạn QR: 15 phút
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Tạo QR payload (chuỗi JSON chứa thông tin chuyển khoản)
    // Frontend sẽ dùng thông tin này để render mã QR
    const qrPayload = JSON.stringify({
      ...bankTransfer,
      amount,
      content: depositCode,
    });

    const deposit = await DepositRequest.create({
      userId,
      amount,
      depositCode,
      qrPayload,
      status: "pending",
      isOpen: true,
      expiresAt,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo yêu cầu nạp tiền thành công",
      data: {
        depositRequestId: deposit._id,
        amount: deposit.amount,
        depositCode: deposit.depositCode,
        qrPayload: deposit.qrPayload,
        expiresAt: deposit.expiresAt,
        status: deposit.status,
      },
    });
  } catch (err) {
    if (err.code === "BANK_TRANSFER_CONFIG_UNAVAILABLE") {
      safeLog.error("financial.deposit_config_unavailable", err);
      return res.status(503).json({
        success: false,
        code: err.code,
        message: "Cấu hình chuyển khoản chưa sẵn sàng",
      });
    }
    // Bắt lỗi Duplicate Key (Partial Unique Index chặn spam)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Bạn đang có mã nạp tiền chưa xử lý xong. Vui lòng chờ.",
      });
    }
    safeLog.error("financial.deposit_create_failed", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tạo yêu cầu nạp tiền",
    });
  }
};

// ===== GET /api/deposits/:id — Xem trạng thái yêu cầu nạp =====
export const getDepositById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deposit = await DepositRequest.findOne({ _id: id, userId });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu nạp tiền",
      });
    }

    const summaryMap = await getDepositSettlementSummaryMap([deposit._id]);
    const data = addSettlementSummary(
      {
        _id: deposit._id,
        depositRequestId: deposit._id,
        amount: deposit.amount,
        depositCode: deposit.depositCode,
        qrPayload: deposit.qrPayload,
        expiresAt: deposit.expiresAt,
        status: deposit.status,
        paidAt: deposit.paidAt,
        reversedAt: deposit.reversedAt,
        reverseReason: deposit.reverseReason,
        createdAt: deposit.createdAt,
      },
      summaryMap,
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    safeLog.error("financial.deposit_detail_failed", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};

// ===== GET /api/deposits — Lịch sử nạp tiền của user =====
export const getMyDeposits = async (req, res) => {
  try {
    const userId = req.user.id;

    const deposits = await DepositRequest.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select(
        "amount depositCode qrPayload status expiresAt paidAt reversedAt reverseReason createdAt",
      );

    const summaryMap = await getDepositSettlementSummaryMap(
      deposits.map((deposit) => deposit._id),
    );

    return res.status(200).json({
      success: true,
      data: deposits.map((deposit) => addSettlementSummary(deposit, summaryMap)),
    });
  } catch (err) {
    safeLog.error("financial.deposit_history_failed", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};

// ===== GET /api/me/wallet — Xem số dư ví =====
export const getMyWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    // Tự tạo wallet nếu chưa có
    let wallet = await Wallet.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, balance: 0, currency: "VND", version: 0 } },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(200).json({
      success: true,
      data: {
        balance: wallet.balance,
        currency: wallet.currency,
      },
    });
  } catch (err) {
    safeLog.error("financial.wallet_read_failed", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};

// ===== POST /api/deposits/:id/confirm — User xác nhận đã thanh toán =====
export const confirmDeposit = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deposit = await DepositRequest.findOne({ _id: id, userId }).lean();
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu nạp tiền",
      });
    }
    const summaryMap = await getDepositSettlementSummaryMap([deposit._id]);
    const summary = summaryMap.get(String(deposit._id)) || {
      settledTransactionCount: 0,
      settledAmountTotal: 0,
      lastSettlementAt: null,
    };
    return res.status(200).json({
      success: true,
      message: "Hệ thống đang tự động kiểm tra giao dịch ngân hàng",
      data: {
        depositRequestId: deposit._id,
        status: deposit.status,
        ...summary,
      },
    });
  } catch (err) {
    safeLog.error("financial.deposit_confirm_failed", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};
