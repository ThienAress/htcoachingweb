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
      ],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      default: "",
      trim: true,
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
  },
  { timestamps: true },
);

f1MediaSchema.index({ customerId: 1, type: 1, createdAt: -1 });
f1MediaSchema.index({ intakeId: 1 });

export default mongoose.model("F1Media", f1MediaSchema);
