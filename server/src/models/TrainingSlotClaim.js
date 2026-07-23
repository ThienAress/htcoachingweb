import mongoose from "mongoose";

const trainingSlotClaimSchema = new mongoose.Schema(
  {
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSchedule",
      required: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    occurrenceDateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    slotStartAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

trainingSlotClaimSchema.index(
  { trainerId: 1, slotStartAt: 1 },
  { unique: true, name: "uniq_trainer_slot" },
);
trainingSlotClaimSchema.index({ scheduleId: 1 });
trainingSlotClaimSchema.index({ clientId: 1, occurrenceDateKey: 1 });

export default mongoose.model("TrainingSlotClaim", trainingSlotClaimSchema);
