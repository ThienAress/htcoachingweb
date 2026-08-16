import mongoose from "mongoose";

import DepositRequest from "../models/DepositRequest.js";
import IncomingBankTransaction from "../models/IncomingBankTransaction.js";
import { hasActiveLegacyDepositCredit } from "./depositLedgerState.service.js";

const MAX_ATTEMPTS = 3;

export const financialError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });

export const assertObjectId = (value, code, message) => {
  if (!mongoose.isValidObjectId(value)) throw financialError(400, code, message);
};

export const runFinancialMutation = async (operation) => {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let outcome;
      await session.withTransaction(async () => {
        outcome = await operation(session);
      });
      return outcome;
    } catch (error) {
      lastError = error;
      const retryable =
        error?.code === 11000 ||
        error?.code === "WALLET_VERSION_CONFLICT" ||
        error?.errorLabels?.includes?.("TransientTransactionError");
      if (!retryable || attempt === MAX_ATTEMPTS) throw error;
    } finally {
      await session.endSession();
    }
  }
  throw lastError;
};

export const auditRecord = ({ actor, action, incoming, metadata = {} }) => ({
  actorId: actor.id,
  actorRole: actor.role,
  ipAddress: actor.ipAddress,
  userAgent: actor.userAgent,
  action,
  targetType: "incoming_bank_transaction",
  targetId: incoming._id,
  metadata,
});

export const markDepositReversedWhenNoCreditsRemain = async ({
  incoming,
  actor,
  reason,
  session,
}) => {
  if (!incoming.depositRequestId) return;
  const [remainingSettled, activeLegacyCredit] = await Promise.all([
    IncomingBankTransaction.countDocuments({
      depositRequestId: incoming.depositRequestId,
      status: "settled",
    }).session(session),
    hasActiveLegacyDepositCredit({
      depositRequestId: incoming.depositRequestId,
      session,
    }),
  ]);
  if (remainingSettled > 0 || activeLegacyCredit) return;

  const deposit = await DepositRequest.findById(
    incoming.depositRequestId,
  ).session(session);
  if (!deposit) return;
  deposit.status = "reversed";
  deposit.reversedAt = new Date();
  deposit.reversedBy = actor.id;
  deposit.reverseReason = reason;
  await deposit.save({ session });
};

export const assertIncomingCreditLedger = ({ incoming, ledger }) => {
  const matches =
    ledger?.type === "deposit" &&
    ledger.status === "success" &&
    ledger.referenceType === "incoming_bank_transaction" &&
    String(ledger.referenceId || "") === String(incoming._id) &&
    String(ledger.userId || "") === String(incoming.userId) &&
    ledger.amount === incoming.amount;
  if (!matches) {
    throw financialError(
      409,
      "INCOMING_LEDGER_MISMATCH",
      "Ledger giao dịch không nhất quán; cần đối soát trước khi tiếp tục",
    );
  }
  return ledger;
};
