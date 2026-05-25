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

    // deposit = nạp tiền, purchase = mua hàng, refund = hoàn tiền, adjustment = admin điều chỉnh
    type: {
      type: String,
      enum: ["deposit", "purchase", "refund", "adjustment"],
      required: true,
    },

    // Số tiền: dương khi nạp/hoàn, âm khi mua
    amount: {
      type: Number,
      required: true,
    },

    // Số dư trước và sau giao dịch (snapshot để đối soát)
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["success", "failed", "reversed"],
      default: "success",
    },

    // Liên kết tới đối tượng gốc (deposit_request, order, v.v.)
    referenceType: {
      type: String,
      enum: ["deposit_request", "order", "refund", "adjustment"],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Chống xử lý trùng: mỗi giao dịch ngân hàng / đơn hàng chỉ được xử lý 1 lần
    idempotencyKey: {
      type: String,
      required: true,
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

export default mongoose.model("WalletTransaction", walletTransactionSchema);
