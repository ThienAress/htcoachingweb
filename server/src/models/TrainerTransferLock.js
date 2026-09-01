import mongoose from "mongoose";

const trainerTransferLockSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    revision: {
      type: Number,
      min: 0,
      default: 0,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("TrainerTransferLock", trainerTransferLockSchema);
