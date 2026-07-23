import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    // Ledger append-only: reversal là một entry mới, không sửa entry gốc.
    type: {
      type: String,
      enum: ["deposit", "purchase", "refund", "adjustment", "reversal"],
      required: true,
    },

    // Số tiền: dương khi nạp/hoàn, âm khi mua
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) =>
          Number.isSafeInteger(value) && value !== 0,
        message: "Ledger amount must be a non-zero safe integer",
      },
    },

    // Số dư trước và sau giao dịch (snapshot để đối soát)
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    status: {
      type: String,
      enum: ["success", "failed", "reversed"],
      default: "success",
    },

    // Liên kết tới đối tượng gốc (deposit_request, order, v.v.)
    referenceType: {
      type: String,
      enum: [
        "deposit_request",
        "order",
        "trainer_subscription",
        "refund",
        "adjustment",
      ],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Chống xử lý trùng: mỗi giao dịch ngân hàng / đơn hàng chỉ được xử lý 1 lần
    idempotencyKey: {
      type: String,
      required: true,
      minlength: 8,
      maxlength: 180,
    },

    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
    },

    // Metadata mở rộng (VD: partial refund cho order_item cụ thể)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// ✅ Indexes
walletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceType: 1, referenceId: 1 });
walletTransactionSchema.index(
  { reversalOf: 1 },
  {
    unique: true,
    partialFilterExpression: { reversalOf: { $type: "objectId" } },
    name: "uniq_wallet_reversal",
  },
);

walletTransactionSchema.pre("save", function enforceAppendOnly() {
  if (!this.isNew) {
    throw new Error("WalletTransaction is append-only");
  }
});

walletTransactionSchema.pre("validate", function validateSnapshots() {
  if (
    Number.isSafeInteger(this.amount) &&
    Number.isSafeInteger(this.balanceBefore) &&
    Number.isSafeInteger(this.balanceAfter) &&
    this.balanceAfter !== this.balanceBefore + this.amount
  ) {
    this.invalidate(
      "balanceAfter",
      "Ledger balanceAfter must equal balanceBefore plus amount",
    );
  }
});

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
  "replaceOne",
  "findOneAndReplace",
]) {
  walletTransactionSchema.pre(operation, function rejectLedgerMutation() {
    throw new Error("WalletTransaction is append-only");
  });
}

export default mongoose.model("WalletTransaction", walletTransactionSchema);
