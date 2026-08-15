import mongoose from "mongoose";

import { resolveSePayConfig } from "../config/sepay.js";
import DepositRequest from "../models/DepositRequest.js";
import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import { hasActiveLegacyDepositCredit } from "./depositLedgerState.service.js";
import { applyWalletEntry } from "./walletLedger.service.js";

const AUTO_SETTLEABLE_DEPOSIT_STATUSES = new Set([
  "pending",
  "expired",
  "needs_review",
  "success",
  "reversed",
]);
const AUTO_SETTLEMENT_GRACE_MS = 24 * 60 * 60 * 1000;
const EARLY_CLOCK_SKEW_MS = 10 * 60 * 1000;
const MAX_SETTLEMENT_ATTEMPTS = 3;

const markForReview = async ({ incoming, reason, deposit = null, session }) => {
  incoming.status = "needs_review";
  incoming.reviewReason = reason;
  if (deposit) {
    incoming.depositRequestId = deposit._id;
    incoming.userId = deposit.userId;
  }
  await incoming.save({ session });
  return {
    status: incoming.status,
    reviewReason: incoming.reviewReason,
    skipped: false,
  };
};

const settleAttempt = async (incomingId, config) => {
  const session = await mongoose.startSession();
  let outcome;
  try {
    await session.withTransaction(async () => {
      const incoming = await IncomingBankTransaction.findById(incomingId).session(
        session,
      );
      if (!incoming) {
        const error = new Error("Không tìm thấy giao dịch ngân hàng");
        error.code = "INCOMING_BANK_TRANSACTION_NOT_FOUND";
        error.status = 404;
        throw error;
      }
      if (incoming.status === "settled") {
        outcome = { status: "settled", skipped: true };
        return;
      }
      if (incoming.status !== "received") {
        outcome = {
          status: incoming.status,
          reviewReason: incoming.reviewReason,
          skipped: true,
        };
        return;
      }
      if (!incoming.depositCode) {
        outcome = await markForReview({
          incoming,
          reason: "CODE_NOT_FOUND",
          session,
        });
        return;
      }

      const deposit = await DepositRequest.findOne({
        depositCode: incoming.depositCode,
      }).session(session);
      if (!deposit) {
        outcome = await markForReview({
          incoming,
          reason: "DEPOSIT_NOT_FOUND",
          session,
        });
        return;
      }
      if (!AUTO_SETTLEABLE_DEPOSIT_STATUSES.has(deposit.status)) {
        outcome = await markForReview({
          incoming,
          deposit,
          reason: "DEPOSIT_NOT_SETTLEABLE",
          session,
        });
        return;
      }
      if (
        await hasActiveLegacyDepositCredit({
          depositRequestId: deposit._id,
          session,
        })
      ) {
        outcome = await markForReview({
          incoming,
          deposit,
          reason: "POSSIBLE_LEGACY_MANUAL_CREDIT",
          session,
        });
        return;
      }
      if (
        Number.isNaN(config.cutoverAt.getTime()) ||
        deposit.createdAt < config.cutoverAt
      ) {
        outcome = await markForReview({
          incoming,
          deposit,
          reason: "PRE_CUTOVER_DEPOSIT",
          session,
        });
        return;
      }
      if (incoming.amount !== deposit.amount) {
        outcome = await markForReview({
          incoming,
          deposit,
          reason: "AMOUNT_MISMATCH",
          session,
        });
        return;
      }
      const transactionTime = incoming.transactionAt.getTime();
      const earliestAllowed = deposit.createdAt.getTime() - EARLY_CLOCK_SKEW_MS;
      const latestAllowed =
        deposit.expiresAt.getTime() + AUTO_SETTLEMENT_GRACE_MS;
      if (
        transactionTime < earliestAllowed ||
        transactionTime > latestAllowed
      ) {
        outcome = await markForReview({
          incoming,
          deposit,
          reason: "OUTSIDE_AUTO_SETTLEMENT_WINDOW",
          session,
        });
        return;
      }

      const ledger = await applyWalletEntry({
        session,
        userId: deposit.userId,
        amount: incoming.amount,
        type: "deposit",
        referenceType: "incoming_bank_transaction",
        referenceId: incoming._id,
        idempotencyKey: `bank-credit:sepay:${incoming._id}`,
        metadata: { depositRequestId: deposit._id },
      });

      incoming.status = "settled";
      incoming.reviewReason = null;
      incoming.depositRequestId = deposit._id;
      incoming.userId = deposit.userId;
      incoming.walletTransactionId = ledger.transaction._id;
      await incoming.save({ session });

      deposit.status = "success";
      deposit.isOpen = false;
      deposit.rejectReason = null;
      deposit.reversedAt = null;
      deposit.reversedBy = null;
      deposit.reverseReason = null;
      if (!deposit.paidAt || incoming.transactionAt < deposit.paidAt) {
        deposit.paidAt = incoming.transactionAt;
      }
      await deposit.save({ session });

      outcome = {
        status: "settled",
        skipped: ledger.skipped,
        balanceAfter: ledger.balanceAfter,
        walletTransactionId: ledger.transaction._id,
      };
    });
    return outcome;
  } finally {
    await session.endSession();
  }
};

export const processIncomingBankTransaction = async ({
  incomingId,
  config = resolveSePayConfig(process.env),
}) => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_SETTLEMENT_ATTEMPTS; attempt += 1) {
    try {
      return await settleAttempt(incomingId, config);
    } catch (error) {
      lastError = error;
      const retryable =
        error?.code === "WALLET_VERSION_CONFLICT" ||
        error?.errorLabels?.includes?.("TransientTransactionError");
      if (!retryable || attempt === MAX_SETTLEMENT_ATTEMPTS) throw error;
    }
  }
  throw lastError;
};
