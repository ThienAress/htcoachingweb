import crypto from "crypto";
import DepositRequest from "../models/DepositRequest.js";
import Wallet from "../models/Wallet.js";

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

    // Validate số tiền
    if (!amount || amount < 5000) {
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

    // Kiểm tra user đã có giao dịch đang chờ duyệt (needs_review) chưa
    const existingNeedsReview = await DepositRequest.findOne({
      userId,
      status: "needs_review",
    });

    if (existingNeedsReview) {
      return res.status(400).json({
        success: false,
        message: "Bạn đang có giao dịch chờ admin duyệt. Vui lòng đợi giao dịch hiện tại được xử lý trước khi tạo yêu cầu mới.",
      });
    }

    // Kiểm tra user đã có QR pending chưa
    // (Partial Unique Index ở DB cũng chặn, nhưng check trước cho UX tốt hơn)
    const existingPending = await DepositRequest.findOne({
      userId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (existingPending) {
      // Trả lại QR cũ thay vì tạo mới
      return res.status(200).json({
        success: true,
        message: "Bạn đang có mã nạp tiền chưa hết hạn",
        data: {
          depositRequestId: existingPending._id,
          amount: existingPending.amount,
          depositCode: existingPending.depositCode,
          qrPayload: existingPending.qrPayload,
          expiresAt: existingPending.expiresAt,
          status: existingPending.status,
        },
      });
    }

    // Đảm bảo user đã có wallet (tự tạo nếu chưa có)
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
      bankName: process.env.BANK_NAME || "TPBank",
      bankCode: process.env.BANK_CODE || "TPB",
      accountNumber: process.env.BANK_ACCOUNT || "10001167831",
      accountHolder: process.env.BANK_HOLDER || "VO HOANG THIEN",
      amount,
      content: depositCode,
    });

    const deposit = await DepositRequest.create({
      userId,
      amount,
      depositCode,
      qrPayload,
      status: "pending",
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
    // Bắt lỗi Duplicate Key (Partial Unique Index chặn spam)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Bạn đang có mã nạp tiền chưa xử lý xong. Vui lòng chờ.",
      });
    }
    console.error("createDeposit error:", err);
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
        createdAt: deposit.createdAt,
      },
    });
  } catch (err) {
    console.error("getDepositById error:", err);
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
      .select("amount depositCode qrPayload status expiresAt paidAt createdAt");

    return res.status(200).json({
      success: true,
      data: deposits,
    });
  } catch (err) {
    console.error("getMyDeposits error:", err);
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
    console.error("getMyWallet error:", err);
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

    const deposit = await DepositRequest.findOne({ _id: id, userId });

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu nạp tiền",
      });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Không thể xác nhận yêu cầu ở trạng thái "${deposit.status}"`,
      });
    }

    deposit.status = "needs_review";
    await deposit.save();

    return res.status(200).json({
      success: true,
      message: "Đã ghi nhận thanh toán. Vui lòng chờ admin xác nhận.",
      data: {
        depositRequestId: deposit._id,
        status: deposit.status,
      },
    });
  } catch (err) {
    console.error("confirmDeposit error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};
