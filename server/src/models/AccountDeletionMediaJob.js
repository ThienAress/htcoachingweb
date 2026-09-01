import mongoose from "mongoose";

const accountDeletionAssetSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["cloudinary", "local"],
      required: true,
    },
    storageKey: { type: String, required: true, maxlength: 500 },
    resourceType: { type: String, enum: ["video"], required: true },
    deliveryType: {
      type: String,
      enum: ["authenticated", "upload", "local"],
      required: true,
    },
    format: { type: String, default: "mp4", maxlength: 20 },
    version: { type: Number, default: null },
    bytes: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const accountDeletionMediaJobSchema = new mongoose.Schema(
  {
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    asset: {
      type: accountDeletionAssetSchema,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    claimedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastErrorCode: { type: String, default: "", maxlength: 80 },
  },
  { timestamps: true },
);

accountDeletionMediaJobSchema.index(
  { targetUserId: 1, "asset.provider": 1, "asset.storageKey": 1 },
  { unique: true, name: "uniq_account_deletion_media_asset" },
);
accountDeletionMediaJobSchema.index(
  { status: 1, nextAttemptAt: 1 },
  { name: "account_deletion_media_status_retry" },
);

export default mongoose.model(
  "AccountDeletionMediaJob",
  accountDeletionMediaJobSchema,
);
