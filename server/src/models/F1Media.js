import mongoose from "mongoose";

const f1MediaSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Customer",
      required: true,
    },
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1Intake",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "before_front",
        "before_back",
        "before_side",
        "posture_front",
        "posture_back",
        "posture_side",
        "prediction_front",
        "prediction_side",
      ],
      required: true,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
    publicId: {
      type: String,
      default: "",
      trim: true,
    },
    provider: {
      type: String,
      enum: ["cloudinary", "local_private", "legacy_local", "mock"],
      default: "legacy_local",
      required: true,
    },
    storageKey: {
      type: String,
      default: "",
      trim: true,
    },
    checksum: {
      type: String,
      default: "",
      trim: true,
    },
    format: {
      type: String,
      default: "",
      trim: true,
    },
    width: {
      type: Number,
      default: 0,
      min: 0,
    },
    height: {
      type: Number,
      default: 0,
      min: 0,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
    },
    sizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    predictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "F1ResultPrediction",
      default: null,
    },
    phaseKey: {
      type: String,
      enum: ["phase_1", "phase_2", "phase_3", "phase_4", "phase_5", ""],
      default: "",
    },
    status: {
      type: String,
      enum: [
        "pending_upload",
        "ready",
        "delete_pending",
        "deleted",
        "failed",
      ],
      default: "pending_upload",
      required: true,
    },
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
    failureCode: {
      type: String,
      default: "",
      trim: true,
    },
    readyAt: {
      type: Date,
      default: null,
    },
    deleteRequestedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

f1MediaSchema.index({
  customerId: 1,
  intakeId: 1,
  type: 1,
  status: 1,
  createdAt: -1,
});
f1MediaSchema.index({ intakeId: 1, status: 1 });
f1MediaSchema.index({ customerId: 1, status: 1, sizeBytes: 1 });
f1MediaSchema.index({ predictionId: 1, phaseKey: 1, status: 1 });
f1MediaSchema.index({ customerId: 1, checksum: 1, status: 1 });

export default mongoose.model("F1Media", f1MediaSchema);
