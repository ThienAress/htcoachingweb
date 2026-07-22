import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { incrementMetric } from "../observability/metrics.js";

export class WalletLedgerError extends Error {
  constructor(message, { status = 400, code = "WALLET_LEDGER_ERROR" } = {}) {
    super(message);
    this.name = "WalletLedgerError";
    this.status = status;
    this.code = code;
  }
}

const assertLedgerInput = ({ amount, idempotencyKey, session }) => {
  if (!session) {
    throw new WalletLedgerError("Wallet transaction requires a database session", {
      status: 500,
      code: "WALLET_SESSION_REQUIRED",
    });
  }
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new WalletLedgerError("Số tiền giao dịch phải là số nguyên VND khác 0", {
      code: "INVALID_WALLET_AMOUNT",
    });
  }
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 180
  ) {
    throw new WalletLedgerError("Idempotency key không hợp lệ", {
      code: "INVALID_IDEMPOTENCY_KEY",
    });
  }
};

export const applyWalletEntry = async ({
  session,
  userId,
  amount,
  type,
  referenceType,
  referenceId,
  idempotencyKey,
  metadata = {},
  reversalOf = null,
}) => {
  assertLedgerInput({ amount, idempotencyKey, session });

  const existing = await WalletTransaction.findOne({ idempotencyKey })
    .session(session)
    .lean();
  if (existing) {
    incrementMetric("financial.idempotency_hits");
    return {
      skipped: true,
      transaction: existing,
      balanceBefore: existing.balanceBefore,
      balanceAfter: existing.balanceAfter,
    };
  }

  const wallet = await Wallet.findOne({ userId }).session(session);
  if (!wallet) {
    throw new WalletLedgerError("Không tìm thấy ví của người dùng", {
      status: 404,
      code: "WALLET_NOT_FOUND",
    });
  }
  if (
    !Number.isSafeInteger(wallet.balance) ||
    !Number.isSafeInteger(wallet.version)
  ) {
    throw new WalletLedgerError("Dữ liệu ví không hợp lệ, cần đối soát", {
      status: 409,
      code: "WALLET_RECONCILIATION_REQUIRED",
    });
  }

  const balanceBefore = wallet.balance;
  const balanceAfter = balanceBefore + amount;
  if (!Number.isSafeInteger(balanceAfter) || balanceAfter < 0) {
    throw new WalletLedgerError("Số dư ví không đủ để thực hiện giao dịch", {
      status: 409,
      code: "INSUFFICIENT_WALLET_BALANCE",
    });
  }

  const updateResult = await Wallet.updateOne(
    { _id: wallet._id, version: wallet.version, balance: balanceBefore },
    {
      $set: {
        balance: balanceAfter,
        version: wallet.version + 1,
      },
    },
    { session },
  );
  if (updateResult.modifiedCount !== 1) {
    incrementMetric("financial.conflicts");
    throw new WalletLedgerError("Có giao dịch ví đồng thời. Vui lòng thử lại.", {
      status: 409,
      code: "WALLET_VERSION_CONFLICT",
    });
  }

  const [transaction] = await WalletTransaction.create(
    [
      {
        userId,
        walletId: wallet._id,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        status: "success",
        referenceType,
        referenceId,
        idempotencyKey,
        metadata,
        reversalOf,
      },
    ],
    { session },
  );

  return {
    skipped: false,
    transaction,
    balanceBefore,
    balanceAfter,
  };
};
