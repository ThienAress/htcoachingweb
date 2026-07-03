import mongoose from "mongoose";

const gymSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    openingHours: {
      type: String,
      default: "24/7",
    },
    googleMapsUrl: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },
    hasKickfit: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

gymSchema.index({ district: 1 });
gymSchema.index({ status: 1 });

const Gym = mongoose.model("Gym", gymSchema);
export default Gym;
