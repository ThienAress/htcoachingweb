import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    gym: { type: String, required: true, trim: true, maxlength: 120 },
    schedule: { type: String, required: true, trim: true, maxlength: 500 },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    package: { type: String, required: true, trim: true, maxlength: 150 },
    sessions: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      validate: Number.isSafeInteger,
    },
    discountCode: { type: String, default: null, trim: true, maxlength: 20 },
    gifts: {
      type: [String],
      default: [],
      validate: {
        validator: (items) =>
          items.length <= 10 &&
          items.every((item) => String(item).length <= 100),
        message: "Danh sách quà tặng không hợp lệ",
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    clientRequestId: {
      type: String,
      required: true,
      maxlength: 64,
    },
    requestFingerprint: {
      type: String,
      required: true,
      maxlength: 64,
    },
    status: {
      type: String,
      enum: ["pending", "contacted", "completed", "cancelled"],
      default: "pending",
    },
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
    contactedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    noteAdmin: { type: String, default: "", trim: true, maxlength: 500 },
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    nameNormalized: { type: String, default: "" },
    emailNormalized: { type: String, default: "" },
    phoneNormalized: { type: String, default: "" },
  },
  { timestamps: true },
);

bookingSchema.pre("validate", function normalizeSearchFields() {
  this.nameNormalized = String(this.name || "").trim().toLowerCase();
  this.emailNormalized = String(this.email || "").trim().toLowerCase();
  this.phoneNormalized = String(this.phone || "").replace(/\D/g, "");
});

bookingSchema.index(
  { clientRequestId: 1 },
  { unique: true, name: "uniq_booking_client_request" },
);
bookingSchema.index({ isArchived: 1, createdAt: -1 });
bookingSchema.index({ isArchived: 1, status: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, isArchived: 1, createdAt: -1 });
bookingSchema.index({ emailNormalized: 1, createdAt: -1 });
bookingSchema.index({ phoneNormalized: 1, createdAt: -1 });
bookingSchema.index({ nameNormalized: 1, createdAt: -1 });

export default mongoose.model("Booking", bookingSchema);
