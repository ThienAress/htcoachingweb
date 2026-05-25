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

    // pending -> success / expired / rejected / needs_review
    status: {
      type: String,
      enum: ["pending", "expired", "success", "rejected", "needs_review"],
      default: "pending",
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
    },
  },
  { timestamps: true }
);

// ✅ Indexes
depositRequestSchema.index({ depositCode: 1 }, { unique: true });
depositRequestSchema.index({ userId: 1, status: 1 });
depositRequestSchema.index({ status: 1, expiresAt: 1 }); // Tối ưu Cron Job quét QR hết hạn

// Chống spam: 1 user chỉ có tối đa 1 request pending tại 1 thời điểm
// MongoDB hỗ trợ Partial Unique Index qua partialFilterExpression
depositRequestSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "unique_pending_per_user",
  }
);

export default mongoose.model("DepositRequest", depositRequestSchema);
