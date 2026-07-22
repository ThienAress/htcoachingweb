import mongoose from "mongoose";

const webVitalSampleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["LCP", "INP", "CLS"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    route: {
      type: String,
      required: true,
      maxlength: 120,
    },
    device: {
      type: String,
      enum: ["mobile", "desktop"],
      required: true,
    },
    rating: {
      type: String,
      enum: ["good", "needs-improvement", "poor"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

webVitalSampleSchema.index({ name: 1, route: 1, device: 1, createdAt: -1 });
webVitalSampleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("WebVitalSample", webVitalSampleSchema);
