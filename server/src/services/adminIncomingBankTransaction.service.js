import AuditLog from "../models/AuditLog.js";
import DepositRequest from "../models/DepositRequest.js";
import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { incrementMetric } from "../observability/metrics.js";
import { applyWalletEntry } from "./walletLedger.service.js";
import {
  assertObjectId,
  assertIncomingCreditLedger,
  auditRecord,
  financialError,
  markDepositReversedWhenNoCreditsRemain,
  runFinancialMutation,
} from "./adminIncomingBankTransaction.helpers.js";

const MUTABLE_REVIEW_STATUSES = new Set(["received", "needs_review"]);
export const approveIncomingBankTransaction = async ({
  incomingId,
  depositRequestId,
  reason,
  actor,
}) => {
  assertObjectId(
    incomingId,
    "INCOMING_BANK_TRANSACTION_ID_INVALID",
    "Giao dịch ngân hàng không hợp lệ",
  );
  assertObjectId(
    depositRequestId,
    "DEPOSIT_ID_INVALID",
    "Yêu cầu nạp tiền không hợp lệ",
  );
  return runFinancialMutation(async (session) => {
    const incoming = await IncomingBankTransaction.findById(incomingId).session(
      session,
    );
    if (!incoming) {
      throw financialError(
        404,
        "INCOMING_BANK_TRANSACTION_NOT_FOUND",
        "Không tìm thấy giao dịch ngân hàng",
      );
    }
    if (incoming.status === "settled") {
      const existing = await WalletTransaction.findOne({
        idempotencyKey: `bank-credit:sepay:${incoming._id}`,
      })
        .session(session)
        .lean();
      if (!existing) {
        throw financialError(
          409,
          "INCOMING_LEDGER_MISSING",
          "Giao dịch đã cộng nhưng thiếu ledger; cần đối soát",
        );
      }
      assertIncomingCreditLedger({ incoming, ledger: existing });
      incrementMetric("financial.idempotency_hits");
      return {
        skipped: true,
        amount: incoming.amount,
        balanceAfter: existing.balanceAfter,
      };
    }
    if (!MUTABLE_REVIEW_STATUSES.has(incoming.status)) {
      throw financialError(
        409,
        "INVALID_INCOMING_TRANSITION",
        `Không thể duyệt giao dịch ở trạng thái "${incoming.status}"`,
      );
    }

    const deposit = await DepositRequest.findById(depositRequestId).session(
      session,
    );
    if (!deposit) {
      throw financialError(
        404,
        "DEPOSIT_NOT_FOUND",
        "Không tìm thấy yêu cầu nạp tiền",
      );
    }
    const ledger = await applyWalletEntry({
      session,
      userId: deposit.userId,
      amount: incoming.amount,
      type: "deposit",
      referenceType: "incoming_bank_transaction",
      referenceId: incoming._id,
      idempotencyKey: `bank-credit:sepay:${incoming._id}`,
      metadata: { depositRequestId: deposit._id, reviewedBy: actor.id },
    });

    incoming.status = "settled";
    incoming.reviewReason = null;
    incoming.depositRequestId = deposit._id;
    incoming.userId = deposit.userId;
    incoming.walletTransactionId = ledger.transaction._id;
    incoming.reviewedBy = actor.id;
    incoming.reviewedAt = new Date();
    incoming.reviewNote = reason;
    await incoming.save({ session });

    deposit.status = "success";
    deposit.isOpen = false;
    deposit.rejectReason = null;
    deposit.reversedAt = null;
    deposit.reversedBy = null;
    deposit.reverseReason = null;
    deposit.approvedBy = actor.id;
    if (!deposit.paidAt || incoming.transactionAt < deposit.paidAt) {
      deposit.paidAt = incoming.transactionAt;
    }
    await deposit.save({ session });

    await AuditLog.create(
      [
        auditRecord({
          actor,
          action: "approve_incoming_bank_transaction",
          incoming,
          metadata: {
            amount: incoming.amount,
            depositRequestId: deposit._id,
            userId: deposit.userId,
            balanceBefore: ledger.balanceBefore,
            balanceAfter: ledger.balanceAfter,
            reason,
          },
        }),
      ],
      { session },
    );
    return {
      skipped: false,
      amount: incoming.amount,
      balanceAfter: ledger.balanceAfter,
    };
  });
};

export const ignoreIncomingBankTransaction = async ({
  incomingId,
  reason,
  actor,
}) => {
  assertObjectId(
    incomingId,
    "INCOMING_BANK_TRANSACTION_ID_INVALID",
    "Giao dịch ngân hàng không hợp lệ",
  );
  return runFinancialMutation(async (session) => {
    const incoming = await IncomingBankTransaction.findById(incomingId).session(
      session,
    );
    if (!incoming) {
      throw financialError(
        404,
        "INCOMING_BANK_TRANSACTION_NOT_FOUND",
        "Không tìm thấy giao dịch ngân hàng",
      );
    }
    if (incoming.status === "ignored") return { skipped: true };
    if (!MUTABLE_REVIEW_STATUSES.has(incoming.status)) {
      throw financialError(
        409,
        "INVALID_INCOMING_TRANSITION",
        `Không thể bỏ qua giao dịch ở trạng thái "${incoming.status}"`,
      );
    }

    incoming.status = "ignored";
    incoming.reviewReason = "ADMIN_IGNORED";
    incoming.reviewedBy = actor.id;
    incoming.reviewedAt = new Date();
    incoming.reviewNote = reason;
    await incoming.save({ session });
    await AuditLog.create(
      [
        auditRecord({
          actor,
          action: "ignore_incoming_bank_transaction",
          incoming,
          metadata: { amount: incoming.amount, reason },
        }),
      ],
      { session },
    );
    return { skipped: false };
  });
};

export const reverseIncomingBankTransaction = async ({
  incomingId,
  reason,
  actor,
}) => {
  assertObjectId(
    incomingId,
    "INCOMING_BANK_TRANSACTION_ID_INVALID",
    "Giao dịch ngân hàng không hợp lệ",
  );
  return runFinancialMutation(async (session) => {
    const incoming = await IncomingBankTransaction.findById(incomingId).session(
      session,
    );
    if (!incoming) {
      throw financialError(
        404,
        "INCOMING_BANK_TRANSACTION_NOT_FOUND",
        "Không tìm thấy giao dịch ngân hàng",
      );
    }
    if (incoming.status === "reversed") {
      const existing = await WalletTransaction.findOne({
        idempotencyKey: `bank-reversal:sepay:${incoming._id}`,
      })
        .session(session)
        .lean();
      if (!existing) {
        throw financialError(
          409,
          "INCOMING_REVERSAL_LEDGER_MISSING",
          "Giao dịch đã hoàn tác nhưng thiếu ledger; cần đối soát",
        );
      }
      incrementMetric("financial.idempotency_hits");
      return { skipped: true, balanceAfter: existing.balanceAfter };
    }
    if (incoming.status !== "settled" || !incoming.walletTransactionId) {
      throw financialError(
        409,
        "INVALID_INCOMING_TRANSITION",
        "Chỉ giao dịch đã cộng ví mới có thể hoàn tác",
      );
    }
    const original = await WalletTransaction.findById(
      incoming.walletTransactionId,
    ).session(session);
    if (!original) {
      throw financialError(
        409,
        "INCOMING_LEDGER_MISSING",
        "Không tìm thấy ledger gốc; cần đối soát",
      );
    }
    assertIncomingCreditLedger({ incoming, ledger: original });
    const ledger = await applyWalletEntry({
      session,
      userId: incoming.userId,
      amount: -incoming.amount,
      type: "reversal",
      referenceType: "incoming_bank_transaction",
      referenceId: incoming._id,
      idempotencyKey: `bank-reversal:sepay:${incoming._id}`,
      reversalOf: original._id,
      metadata: { reason, reversedBy: actor.id },
    });

    incoming.status = "reversed";
    incoming.reversalTransactionId = ledger.transaction._id;
    incoming.reviewedBy = actor.id;
    incoming.reviewedAt = new Date();
    incoming.reviewNote = reason;
    await incoming.save({ session });
    await markDepositReversedWhenNoCreditsRemain({
      incoming,
      actor,
      reason,
      session,
    });
    await AuditLog.create(
      [
        auditRecord({
          actor,
          action: "reverse_incoming_bank_transaction",
          incoming,
          metadata: {
            amount: incoming.amount,
            reason,
            originalTransactionId: original._id,
            reversalTransactionId: ledger.transaction._id,
            balanceBefore: ledger.balanceBefore,
            balanceAfter: ledger.balanceAfter,
          },
        }),
      ],
      { session },
    );
    incrementMetric("financial.reversals");
    return { skipped: false, balanceAfter: ledger.balanceAfter };
  });
};
