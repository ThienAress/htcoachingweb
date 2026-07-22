import crypto from "crypto";
import DepositRequest from "../models/DepositRequest.js";
import Wallet from "../models/Wallet.js";
import { safeLog } from "../utils/safeLogger.js";

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

    if (!Number.isSafeInteger(amount)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_DEPOSIT_AMOUNT",
        message: "Số tiền nạp phải là số nguyên VND",
      });
    }
    if (amount < 5000) {
      return res.status(400).json({
        success: false,
        message: "Số tiền nạp tối thiểu là 5.000đ",
      });
    }

    if (amount > 100000000) {
      return res.status(400).json({
        success: false,
        message: "Số tiền nạp tối đa là 100.000.000đ",
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
        message: "Cáº¥u hÃ¬nh chuyá»ƒn khoáº£n chÆ°a sáºµn sÃ ng",
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

    return res.status(200).json({
      success: true,
      data: {
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

    return res.status(200).json({
      success: true,
      data: deposits,
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

    const deposit = await DepositRequest.findOneAndUpdate(
      {
        _id: id,
        userId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: "needs_review",
          isOpen: true,
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (deposit) {
      return res.status(200).json({
        success: true,
        message: "Đã ghi nhận thanh toán. Vui lòng chờ admin xác nhận.",
        data: {
          depositRequestId: deposit._id,
          status: deposit.status,
        },
      });
    }

    const existing = await DepositRequest.findOne({ _id: id, userId });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu nạp tiền",
      });
    }

    if (existing.status === "pending" && existing.expiresAt <= new Date()) {
      await DepositRequest.updateOne(
        { _id: existing._id, status: "pending" },
        { $set: { status: "expired", isOpen: false } },
      );
      return res.status(409).json({
        success: false,
        code: "DEPOSIT_EXPIRED",
        message: "Mã nạp tiền đã hết hạn",
      });
    }

    if (existing.status !== "pending") {
      return res.status(400).json({
        success: false,
        message:
          "Không thể xác nhận yêu cầu ở trạng thái \"" +
          existing.status +
          "\"",
      });
    }
    return res.status(409).json({
      success: false,
      code: "DEPOSIT_STATE_CONFLICT",
      message: "Trạng thái deposit vừa thay đổi, vui lòng tải lại",
    });
  } catch (err) {
    safeLog.error("financial.deposit_confirm_failed", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};
