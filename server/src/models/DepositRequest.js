import mongoose from "mongoose";

const depositRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Số tiền muốn nạp (VND, integer)
    amount: {
      type: Number,
      required: true,
      min: 5000, // Tối thiểu 5.000đ
    },

    // Mã nạp tiền duy nhất (NanoID), VD: HTC-8A9X-2M4K
    // User sẽ ghi mã này vào nội dung chuyển khoản để hệ thống đối soát
    depositCode: {
      type: String,
      required: true,
    },

    // Dữ liệu tạo QR (chuỗi JSON hoặc URL ảnh QR)
    qrPayload: {
      type: String,
    },

    // pending -> needs_review -> success -> reversed
    status: {
      type: String,
      enum: [
        "pending",
        "expired",
        "success",
        "rejected",
        "needs_review",
        "reversed",
      ],
      default: "pending",
    },

    isOpen: {
      type: Boolean,
      default: true,
      required: true,
    },

    // Thời điểm QR hết hạn (mặc định 15 phút sau khi tạo)
    expiresAt: {
      type: Date,
      required: true,
    },

    // Thời điểm xác nhận đã thanh toán
    paidAt: {
      type: Date,
      default: null,
    },

    // Admin nào duyệt (nếu duyệt thủ công)
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Lý do từ chối (nếu bị reject)
    rejectReason: {
      type: String,
      default: null,
      maxlength: 500,
    },

    reversedAt: {
      type: Date,
      default: null,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reverseReason: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// ✅ Indexes
depositRequestSchema.index({ depositCode: 1 }, { unique: true });
depositRequestSchema.index({ userId: 1, status: 1 });
depositRequestSchema.index({ status: 1, expiresAt: 1 }); // Tối ưu Cron Job quét QR hết hạn

depositRequestSchema.pre("validate", function syncOpenState() {
  this.isOpen = ["pending", "needs_review"].includes(this.status);
});

// Một user chỉ có tối đa một deposit chưa kết thúc.
depositRequestSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { isOpen: true },
    name: "unique_open_deposit_per_user",
  }
);

export default mongoose.model("DepositRequest", depositRequestSchema);
