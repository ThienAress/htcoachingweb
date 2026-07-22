import mongoose from "mongoose";

const auditTrailSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["created", "updated", "sent", "viewed", "signed", "expired", "cancelled", "downloaded"],
      required: true,
    },
    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    title: String,
    content: String,
    items: [String],
  },
  { _id: false }
);

const contractSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Bên A — Huấn luyện viên
    trainerInfo: {
      name: String,
      birthYear: String,
      address: String,
      phone: String,
      email: String,
    },

    // Bên B — Khách hàng
    clientInfo: {
      name: { type: String, required: true },
      phone: String,
      email: String,
    },

    // Snapshot gói dịch vụ từ Order
    packageDetails: {
      packageName: String,
      sessions: Number,
      pricePerSession: Number,
      totalAmount: Number,
      startDate: Date,
      endDate: Date,
    },

    // Nội quy (editable)
    customSections: [sectionSchema],

    // Chữ ký HLV (base64)
    trainerSignature: String,

    // State Machine: draft → sent → viewed → signing → signed → expired/cancelled
    status: {
      type: String,
      enum: ["draft", "sent", "viewed", "signing", "signed", "expired", "cancelled"],
      default: "draft",
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },

    // Chữ ký khách hàng
    signatureImage: String,
    signedAt: Date,

    // Tracking download khách hàng
    clientDownloadedAt: Date,

    // File PDF đã ký (GridFS)
    signedPdfFileId: mongoose.Schema.Types.ObjectId,
    fileHash: String,

    // Audit trail
    auditTrail: [auditTrailSchema],
  },
  { timestamps: true }
);

contractSchema.pre("validate", function syncActiveFlag() {
  this.isActive = !["cancelled", "expired"].includes(this.status);
});

// Indexes
contractSchema.index(
  { orderId: 1 },
  {
    name: "uniq_active_contract_per_order",
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);
contractSchema.index({ clientId: 1 });
contractSchema.index({ trainerId: 1 });
contractSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Contract", contractSchema);
