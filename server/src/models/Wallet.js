import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Số dư hiện tại (VND, lưu integer). Đây chỉ là cache để đọc nhanh.
    // Nguồn sự thật vẫn là bảng WalletTransaction.
    balance: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    currency: {
      type: String,
      default: "VND",
    },

    // Optimistic Locking: mỗi lần cập nhật balance phải tăng version + 1
    // và kiểm tra version hiện tại khớp trước khi ghi.
    version: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  { timestamps: true }
);

// ✅ Indexes
walletSchema.index({ userId: 1 }, { unique: true }); // Mỗi user chỉ có 1 wallet

export default mongoose.model("Wallet", walletSchema);
