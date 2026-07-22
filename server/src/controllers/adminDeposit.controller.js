import mongoose from "mongoose";
import DepositRequest from "../models/DepositRequest.js";
import WalletTransaction from "../models/WalletTransaction.js";
import AuditLog from "../models/AuditLog.js";
import {
  applyWalletEntry,
  WalletLedgerError,
} from "../services/walletLedger.service.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";

const MUTABLE_DEPOSIT_STATUSES = ["pending", "needs_review", "expired"];
const DELETABLE_DEPOSIT_STATUSES = ["expired", "rejected"];

const httpError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

const normalizeReason = (value, { required = false } = {}) => {
  const reason = String(value || "").trim();
  if (required && reason.length < 8) {
    throw httpError(
      400,
      "FINANCIAL_REASON_REQUIRED",
      "Lý do phải có ít nhất 8 ký tự",
    );
  }
  if (reason.length > 500) {
    throw httpError(
      400,
      "FINANCIAL_REASON_TOO_LONG",
      "Lý do không được vượt quá 500 ký tự",
    );
  }
  return reason;
};

const auditContext = (req) => ({
  actorId: req.user.id,
  actorRole: req.user.role,
  ipAddress: req.ip,
  userAgent: req.get("User-Agent"),
});

const sendMutationError = (res, error, event) => {
  safeLog.error(event, error);
  const status =
    error instanceof WalletLedgerError
      ? error.status
      : error.status || (error.code === 11000 ? 409 : 500);
  return res.status(status).json({
    success: false,
    code:
      error instanceof WalletLedgerError
        ? error.code
        : error.code || "FINANCIAL_OPERATION_FAILED",
    message:
      status >= 500
        ? "Lỗi hệ thống khi xử lý giao dịch"
        : error.message,
  });
};

// GET /api/admin/deposits
export const getAllDeposits = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;

    const deposits = await DepositRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("userId", "name email phone")
      .populate("approvedBy", "name email")
      .populate("reversedBy", "name email")
      .lean();

    return res.status(200).json({ success: true, data: deposits });
  } catch (error) {
    safeLog.error("financial.deposit_list_failed", error);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
  }
};

// POST /api/admin/deposits/:id/approve
export const approveDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  let outcome;

  try {
    await session.withTransaction(async () => {
      const deposit = await DepositRequest.findById(req.params.id).session(
        session,
      );
      if (!deposit) {
        throw httpError(
          404,
          "DEPOSIT_NOT_FOUND",
          "Không tìm thấy yêu cầu nạp tiền",
        );
      }

      if (deposit.status === "success") {
        const ledgerEntry = await WalletTransaction.findOne({
          idempotencyKey: `deposit:${deposit._id}`,
        })
          .session(session)
          .lean();
        if (!ledgerEntry) {
          throw httpError(
            409,
            "DEPOSIT_LEDGER_MISSING",
            "Deposit đã duyệt nhưng thiếu ledger entry; cần đối soát",
          );
        }
        incrementMetric("financial.idempotency_hits");
        outcome = {
          skipped: true,
          balanceAfter: ledgerEntry.balanceAfter,
          amount: deposit.amount,
        };
        return;
      }
      if (!MUTABLE_DEPOSIT_STATUSES.includes(deposit.status)) {
        throw httpError(
          409,
          "INVALID_DEPOSIT_TRANSITION",
          `Không thể duyệt yêu cầu ở trạng thái "${deposit.status}"`,
        );
      }

      const ledger = await applyWalletEntry({
        session,
        userId: deposit.userId,
        amount: deposit.amount,
        type: "deposit",
        referenceType: "deposit_request",
        referenceId: deposit._id,
        idempotencyKey: `deposit:${deposit._id}`,
      });
      if (ledger.skipped) {
        throw httpError(
          409,
          "DEPOSIT_STATE_LEDGER_MISMATCH",
          "Ledger đã tồn tại nhưng deposit chưa ở trạng thái success",
        );
      }

      const transitioned = await DepositRequest.updateOne(
        { _id: deposit._id, status: deposit.status },
        {
          $set: {
            status: "success",
            isOpen: false,
            paidAt: new Date(),
            approvedBy: req.user.id,
            rejectReason: null,
          },
        },
        { session, runValidators: true },
      );
      if (transitioned.modifiedCount !== 1) {
        incrementMetric("financial.conflicts");
        throw httpError(
          409,
          "DEPOSIT_STATE_CONFLICT",
          "Trạng thái deposit đã thay đổi bởi yêu cầu khác",
        );
      }

      await AuditLog.create(
        [
          {
            ...auditContext(req),
            action: "approve_deposit",
            targetType: "deposit_request",
            targetId: deposit._id,
            metadata: {
              amount: deposit.amount,
              depositCode: deposit.depositCode,
              balanceBefore: ledger.balanceBefore,
              balanceAfter: ledger.balanceAfter,
              userId: deposit.userId,
            },
          },
        ],
        { session },
      );

      outcome = {
        skipped: false,
        balanceAfter: ledger.balanceAfter,
        amount: deposit.amount,
      };
    });

    return res.status(200).json({
      success: true,
      skipped: outcome.skipped,
      message: outcome.skipped
        ? "Yêu cầu này đã được duyệt trước đó"
        : `Đã duyệt nạp ${outcome.amount.toLocaleString("vi-VN")}đ thành công`,
      data: { balanceAfter: outcome.balanceAfter },
    });
  } catch (error) {
    return sendMutationError(res, error, "financial.deposit_approve_failed");
  } finally {
    await session.endSession();
  }
};

// POST /api/admin/deposits/:id/reject
export const rejectDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  let skipped = false;

  try {
    const reason =
      normalizeReason(req.body?.reason) || "Không đủ điều kiện";
    await session.withTransaction(async () => {
      const deposit = await DepositRequest.findById(req.params.id).session(
        session,
      );
      if (!deposit) {
        throw httpError(
          404,
          "DEPOSIT_NOT_FOUND",
          "Không tìm thấy yêu cầu nạp tiền",
        );
      }
      if (deposit.status === "rejected") {
        skipped = true;
        return;
      }
      if (!MUTABLE_DEPOSIT_STATUSES.includes(deposit.status)) {
        throw httpError(
          409,
          "INVALID_DEPOSIT_TRANSITION",
          `Không thể từ chối yêu cầu ở trạng thái "${deposit.status}"`,
        );
      }

      const transitioned = await DepositRequest.updateOne(
        { _id: deposit._id, status: deposit.status },
        {
          $set: {
            status: "rejected",
            isOpen: false,
            rejectReason: reason,
          },
        },
        { session, runValidators: true },
      );
      if (transitioned.modifiedCount !== 1) {
        incrementMetric("financial.conflicts");
        throw httpError(
          409,
          "DEPOSIT_STATE_CONFLICT",
          "Trạng thái deposit đã thay đổi bởi yêu cầu khác",
        );
      }

      await AuditLog.create(
        [
          {
            ...auditContext(req),
            action: "reject_deposit",
            targetType: "deposit_request",
            targetId: deposit._id,
            metadata: {
              amount: deposit.amount,
              depositCode: deposit.depositCode,
              reason,
              userId: deposit.userId,
            },
          },
        ],
        { session },
      );
    });

    return res.status(200).json({
      success: true,
      skipped,
      message: skipped
        ? "Yêu cầu này đã bị từ chối trước đó"
        : "Đã từ chối yêu cầu nạp tiền",
    });
  } catch (error) {
    return sendMutationError(res, error, "financial.deposit_reject_failed");
  } finally {
    await session.endSession();
  }
};

// POST /api/admin/deposits/:id/reverse
export const reverseDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  let outcome;

  try {
    const reason = normalizeReason(req.body?.reason, { required: true });
    await session.withTransaction(async () => {
      const deposit = await DepositRequest.findById(req.params.id).session(
        session,
      );
      if (!deposit) {
        throw httpError(
          404,
          "DEPOSIT_NOT_FOUND",
          "Không tìm thấy yêu cầu nạp tiền",
        );
      }
      if (deposit.status === "reversed") {
        const reversal = await WalletTransaction.findOne({
          idempotencyKey: `deposit-reversal:${deposit._id}`,
        })
          .session(session)
          .lean();
        if (!reversal) {
          throw httpError(
            409,
            "DEPOSIT_REVERSAL_LEDGER_MISSING",
            "Deposit đã reversed nhưng thiếu reversal entry; cần đối soát",
          );
        }
        incrementMetric("financial.idempotency_hits");
        outcome = {
          skipped: true,
          balanceAfter: reversal.balanceAfter,
          amount: deposit.amount,
        };
        return;
      }
      if (deposit.status !== "success") {
        throw httpError(
          409,
          "INVALID_DEPOSIT_TRANSITION",
          "Chỉ deposit đã duyệt mới có thể hoàn tác",
        );
      }

      const original = await WalletTransaction.findOne({
        idempotencyKey: `deposit:${deposit._id}`,
        type: "deposit",
        amount: deposit.amount,
      }).session(session);
      if (!original) {
        throw httpError(
          409,
          "DEPOSIT_LEDGER_MISSING",
          "Không tìm thấy ledger entry gốc; cần đối soát trước khi hoàn tác",
        );
      }

      const ledger = await applyWalletEntry({
        session,
        userId: deposit.userId,
        amount: -deposit.amount,
        type: "reversal",
        referenceType: "deposit_request",
        referenceId: deposit._id,
        idempotencyKey: `deposit-reversal:${deposit._id}`,
        reversalOf: original._id,
        metadata: {
          reason,
          reversedBy: req.user.id,
        },
      });
      if (ledger.skipped) {
        throw httpError(
          409,
          "DEPOSIT_STATE_LEDGER_MISMATCH",
          "Reversal ledger đã tồn tại nhưng deposit chưa ở trạng thái reversed",
        );
      }

      const transitioned = await DepositRequest.updateOne(
        { _id: deposit._id, status: "success" },
        {
          $set: {
            status: "reversed",
            isOpen: false,
            reversedAt: new Date(),
            reversedBy: req.user.id,
            reverseReason: reason,
          },
        },
        { session, runValidators: true },
      );
      if (transitioned.modifiedCount !== 1) {
        incrementMetric("financial.conflicts");
        throw httpError(
          409,
          "DEPOSIT_STATE_CONFLICT",
          "Trạng thái deposit đã thay đổi bởi yêu cầu khác",
        );
      }

      await AuditLog.create(
        [
          {
            ...auditContext(req),
            action: "reverse_deposit",
            targetType: "deposit_request",
            targetId: deposit._id,
            metadata: {
              amount: deposit.amount,
              depositCode: deposit.depositCode,
              reason,
              balanceBefore: ledger.balanceBefore,
              balanceAfter: ledger.balanceAfter,
              originalTransactionId: original._id,
              reversalTransactionId: ledger.transaction._id,
              userId: deposit.userId,
            },
          },
        ],
        { session },
      );

      outcome = {
        skipped: false,
        balanceAfter: ledger.balanceAfter,
        amount: deposit.amount,
      };
    });

    if (!outcome.skipped) incrementMetric("financial.reversals");
    return res.status(200).json({
      success: true,
      skipped: outcome.skipped,
      message: outcome.skipped
        ? "Deposit này đã được hoàn tác trước đó"
        : `Đã hoàn tác ${outcome.amount.toLocaleString("vi-VN")}đ`,
      data: { balanceAfter: outcome.balanceAfter },
    });
  } catch (error) {
    if (error.code === 11000) {
      const deposit = await DepositRequest.findById(req.params.id).lean();
      if (deposit?.status === "reversed") {
        return res.status(200).json({
          success: true,
          skipped: true,
          message: "Deposit này đã được hoàn tác trước đó",
        });
      }
    }
    return sendMutationError(res, error, "financial.deposit_reverse_failed");
  } finally {
    await session.endSession();
  }
};

// DELETE /api/admin/deposits/:id
export const deleteDeposit = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const deposit = await DepositRequest.findById(req.params.id).session(
        session,
      );
      if (!deposit) {
        throw httpError(
          404,
          "DEPOSIT_NOT_FOUND",
          "Không tìm thấy yêu cầu nạp tiền",
        );
      }
      if (!DELETABLE_DEPOSIT_STATUSES.includes(deposit.status)) {
        const message =
          deposit.status === "success"
            ? "Deposit đã duyệt phải dùng Hoàn tác, không được xóa"
            : "Chỉ được xóa deposit expired hoặc rejected";
        throw httpError(409, "DEPOSIT_DELETE_BLOCKED", message);
      }

      await AuditLog.create(
        [
          {
            ...auditContext(req),
            action: "delete_deposit",
            targetType: "deposit_request",
            targetId: deposit._id,
            metadata: {
              amount: deposit.amount,
              depositCode: deposit.depositCode,
              status: deposit.status,
              userId: deposit.userId,
            },
          },
        ],
        { session },
      );
      const deleted = await DepositRequest.deleteOne(
        { _id: deposit._id, status: deposit.status },
        { session },
      );
      if (deleted.deletedCount !== 1) {
        incrementMetric("financial.conflicts");
        throw httpError(
          409,
          "DEPOSIT_STATE_CONFLICT",
          "Deposit đã thay đổi bởi yêu cầu khác",
        );
      }
    });

    return res.status(200).json({
      success: true,
      message: "Đã xóa yêu cầu nạp tiền chưa phát sinh ledger",
    });
  } catch (error) {
    return sendMutationError(res, error, "financial.deposit_delete_failed");
  } finally {
    await session.endSession();
  }
};
