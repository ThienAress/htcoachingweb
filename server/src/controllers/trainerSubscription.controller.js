import mongoose from "mongoose";
import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import AuditLog from "../models/AuditLog.js";

// ===== Bảng giá gói HLV (nguồn sự thật — server quyết định giá, không tin client) =====
const TRAINER_PLANS = {
  "Tiêu chuẩn": { month: 5000, year: 50000, maxClients: 5 },
  "Chuyên nghiệp": { month: 7000, year: 70000, maxClients: 20 },
  "Cao cấp": { month: 10000, year: 100000, maxClients: 50 },
};

// Helper: lấy maxClients theo planTitle
export const getMaxClientsByPlan = (planTitle) => {
  return TRAINER_PLANS[planTitle]?.maxClients || 0;
};

// ===== POST /api/trainer-subscriptions/purchase — Mua gói HLV =====
export const purchaseTrainerPlan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { planTitle, billingCycle } = req.body;

    // 1. Validate input
    if (!planTitle || !billingCycle) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin gói hoặc chu kỳ thanh toán",
      });
    }

    const planPricing = TRAINER_PLANS[planTitle];
    if (!planPricing) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Gói không tồn tại",
      });
    }

    if (!["month", "year"].includes(billingCycle)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chu kỳ thanh toán không hợp lệ",
      });
    }

    const amount = planPricing[billingCycle];

    // 2. Lấy wallet
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy ví. Vui lòng nạp tiền trước.",
      });
    }

    // 3. Kiểm tra số dư
    if (wallet.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Số dư ví không đủ",
        data: {
          balance: wallet.balance,
          required: amount,
          shortage: amount - wallet.balance,
        },
      });
    }

    // 4. Tính ngày bắt đầu & kết thúc
    const startDate = new Date();
    const endDate = new Date();
    if (billingCycle === "month") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // 5. Tạo subscription
    const [subscription] = await TrainerSubscription.create(
      [
        {
          userId,
          planTitle,
          billingCycle,
          amount,
          startDate,
          endDate,
          status: "active",
        },
      ],
      { session }
    );

    // 6. Tạo idempotencyKey
    const idempotencyKey = `trainer_sub:${subscription._id}`;

    // 7. Kiểm tra idempotency
    const existed = await WalletTransaction.findOne({ idempotencyKey }).session(session);
    if (existed) {
      await session.abortTransaction();
      return res.status(200).json({
        success: true,
        message: "Giao dịch này đã được xử lý",
        skipped: true,
      });
    }

    // 8. Trừ ví (Optimistic Locking)
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;
    const currentVersion = wallet.version;

    await WalletTransaction.create(
      [
        {
          userId,
          walletId: wallet._id,
          type: "purchase",
          amount: -amount,
          balanceBefore,
          balanceAfter,
          status: "success",
          referenceType: "order",
          referenceId: subscription._id,
          idempotencyKey,
          metadata: {
            planTitle,
            billingCycle,
            subscriptionId: subscription._id,
          },
        },
      ],
      { session }
    );

    const updateResult = await Wallet.updateOne(
      { _id: wallet._id, version: currentVersion },
      { $set: { balance: balanceAfter, version: currentVersion + 1 } },
      { session }
    );

    if (updateResult.modifiedCount === 0) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: "Có giao dịch đồng thời. Vui lòng thử lại.",
      });
    }

    // 9. Ghi audit log
    await AuditLog.create(
      [
        {
          actorId: userId,
          actorRole: req.user.role || "user",
          action: "purchase_trainer_plan",
          targetType: "trainer_subscription",
          targetId: subscription._id,
          metadata: {
            planTitle,
            billingCycle,
            amount,
            balanceBefore,
            balanceAfter,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: `Đã mua gói "${planTitle}" thành công!`,
      data: {
        subscriptionId: subscription._id,
        planTitle,
        billingCycle,
        amount,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        newBalance: balanceAfter,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("purchaseTrainerPlan error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi mua gói",
    });
  } finally {
    session.endSession();
  }
};

// ===== GET /api/trainer-subscriptions/my — Xem gói hiện tại =====
export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await TrainerSubscription.findOne({
      userId,
      status: "active",
      endDate: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: subscription || null,
    });
  } catch (err) {
    console.error("getMySubscription error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};

// ===== GET /api/trainer-subscriptions/all — Admin: Lấy tất cả HLV có gói =====
export const getAllSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const skip = (page - 1) * limit;

    // Tìm tất cả subscription active, populate user
    const query = {
      status: "active",
      endDate: { $gt: new Date() },
    };

    let subscriptions = await TrainerSubscription.find(query)
      .populate("userId", "name email avatar")
      .sort({ createdAt: -1 })
      .lean();

    // Filter theo search (tên hoặc email)
    if (search) {
      const s = search.toLowerCase();
      subscriptions = subscriptions.filter(
        (sub) =>
          sub.userId?.name?.toLowerCase().includes(s) ||
          sub.userId?.email?.toLowerCase().includes(s)
      );
    }

    const total = subscriptions.length;
    const paginated = subscriptions.slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
      },
    });
  } catch (err) {
    console.error("getAllSubscribers error:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
    });
  }
};

// ===== DELETE /api/trainer-subscriptions/:id — Admin: Xóa gói HLV =====
export const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await TrainerSubscription.findByIdAndDelete(id);
    if (!sub) {
      return res.status(404).json({ success: false, message: "Không tìm thấy gói" });
    }
    return res.status(200).json({ success: true, message: "Đã xóa gói thành công" });
  } catch (err) {
    console.error("deleteSubscription error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};
