import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // Ai thực hiện hành động
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Role của người thực hiện tại thời điểm hành động
    actorRole: {
      type: String,
      enum: ["admin", "trainer", "user"],
      required: true,
    },

    // Hành động cụ thể
    action: {
      type: String,
      required: true,
      enum: [
        "approve_deposit",
        "reject_deposit",
        "delete_deposit",
        "manual_adjustment",
        "purchase_with_wallet",
        "purchase_trainer_plan",
        "refund",
        "change_user_role",
        "admin_login",
      ],
    },

    // Đối tượng bị tác động
    targetType: {
      type: String,
      enum: ["deposit_request", "wallet", "order", "user", "trainer_subscription"],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    // Chi tiết hành động (số dư trước/sau, lý do, v.v.)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    // KHÔNG CHO XOÁ audit log — chỉ ghi thêm
    capped: false,
  }
);

// ✅ Indexes
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
