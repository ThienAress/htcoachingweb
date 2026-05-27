import mongoose from "mongoose";
import DepositRequest from "../models/DepositRequest.js";
import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import AuditLog from "../models/AuditLog.js";

// ===== GET /api/admin/deposits — Danh sách tất cả yêu cầu nạp tiền =====
export const getAllDeposits = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;

    const deposits = await DepositRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "name email phone")
      .populate("approvedBy", "name email");

    return res.status(200).json({
      success: true,
      data: deposits,
    });
  } catch (err) {
    console.error("getAllDeposits error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== POST /api/admin/deposits/:id/approve — Duyệt nạp tiền =====
export const approveDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const adminRole = req.user.role;

    // 1. Lấy deposit request
    const deposit = await DepositRequest.findById(id).session(session);
    if (!deposit) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu nạp tiền" });
    }

    // Nếu đã success -> bỏ qua (idempotent)
    if (deposit.status === "success") {
      await session.abortTransaction();
      return res.status(200).json({ success: true, message: "Yêu cầu này đã được duyệt trước đó", skipped: true });
    }

    // Chỉ duyệt được pending, needs_review, expired
    if (!["pending", "needs_review", "expired"].includes(deposit.status)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Không thể duyệt yêu cầu ở trạng thái "${deposit.status}"` });
    }

    // 2. Lấy wallet (Optimistic Locking)
    const wallet = await Wallet.findOne({ userId: deposit.userId }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy ví của người dùng" });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + deposit.amount;
    const currentVersion = wallet.version;
    const idempotencyKey = `deposit:${deposit._id}`;

    // 3. Kiểm tra idempotency (chống cộng trùng)
    const existed = await WalletTransaction.findOne({ idempotencyKey }).session(session);
    if (existed) {
      await session.abortTransaction();
      return res.status(200).json({ success: true, message: "Giao dịch này đã được xử lý", skipped: true });
    }

    // 4. Tạo wallet transaction
    await WalletTransaction.create(
      [
        {
          userId: deposit.userId,
          walletId: wallet._id,
          type: "deposit",
          amount: deposit.amount,
          balanceBefore,
          balanceAfter,
          status: "success",
          referenceType: "deposit_request",
          referenceId: deposit._id,
          idempotencyKey,
        },
      ],
      { session }
    );

    // 5. Cập nhật wallet (Optimistic Locking)
    const updateResult = await Wallet.updateOne(
      { _id: wallet._id, version: currentVersion },
      { $set: { balance: balanceAfter, version: currentVersion + 1 } },
      { session }
    );

    if (updateResult.modifiedCount === 0) {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: "Có giao dịch đồng thời. Vui lòng thử lại." });
    }

    // 6. Cập nhật deposit request
    deposit.status = "success";
    deposit.paidAt = new Date();
    deposit.approvedBy = adminId;
    await deposit.save({ session });

    // 7. Ghi audit log
    await AuditLog.create(
      [
        {
          actorId: adminId,
          actorRole: adminRole,
          action: "approve_deposit",
          targetType: "deposit_request",
          targetId: deposit._id,
          metadata: {
            amount: deposit.amount,
            depositCode: deposit.depositCode,
            balanceBefore,
            balanceAfter,
            userId: deposit.userId,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `Đã duyệt nạp ${deposit.amount.toLocaleString("vi-VN")}đ thành công`,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("approveDeposit error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi duyệt nạp tiền" });
  } finally {
    session.endSession();
  }
};

// ===== POST /api/admin/deposits/:id/reject — Từ chối nạp tiền =====
export const rejectDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const adminRole = req.user.role;
    const { reason } = req.body;

    const deposit = await DepositRequest.findById(id);
    if (!deposit) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu nạp tiền" });
    }

    if (deposit.status === "success") {
      return res.status(400).json({ success: false, message: "Không thể từ chối yêu cầu đã duyệt thành công" });
    }

    if (deposit.status === "rejected") {
      return res.status(200).json({ success: true, message: "Yêu cầu này đã bị từ chối trước đó" });
    }

    deposit.status = "rejected";
    deposit.rejectReason = reason || "Không đủ điều kiện";
    await deposit.save();

    // Ghi audit log
    await AuditLog.create({
      actorId: adminId,
      actorRole: adminRole,
      action: "reject_deposit",
      targetType: "deposit_request",
      targetId: deposit._id,
      metadata: {
        amount: deposit.amount,
        depositCode: deposit.depositCode,
        reason: deposit.rejectReason,
        userId: deposit.userId,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    return res.status(200).json({
      success: true,
      message: "Đã từ chối yêu cầu nạp tiền",
    });
  } catch (err) {
    console.error("rejectDeposit error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// ===== DELETE /api/admin/deposits/:id — Xóa yêu cầu nạp tiền =====
export const deleteDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const adminRole = req.user.role;

    const deposit = await DepositRequest.findById(id);
    if (!deposit) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu nạp tiền" });
    }

    // Không cho xóa nếu đã duyệt thành công (đã cộng tiền vào ví)
    if (deposit.status === "success") {
      return res.status(400).json({ success: false, message: "Không thể xóa yêu cầu đã duyệt thành công" });
    }

    await DepositRequest.findByIdAndDelete(id);

    // Ghi audit log
    await AuditLog.create({
      actorId: adminId,
      actorRole: adminRole,
      action: "delete_deposit",
      targetType: "deposit_request",
      targetId: deposit._id,
      metadata: {
        amount: deposit.amount,
        depositCode: deposit.depositCode,
        status: deposit.status,
        userId: deposit.userId,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    });

    return res.status(200).json({
      success: true,
      message: "Đã xóa yêu cầu nạp tiền",
    });
  } catch (err) {
    console.error("deleteDeposit error:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};
