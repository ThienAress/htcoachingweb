import mongoose from "mongoose";

const countSummarySchema = new mongoose.Schema(
  {
    orders: { type: Number, min: 0, default: 0 },
    schedules: { type: Number, min: 0, default: 0 },
    scheduleClaims: { type: Number, min: 0, default: 0 },
    workoutPlans: { type: Number, min: 0, default: 0 },
    coachingDays: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const retainedSummarySchema = new mongoose.Schema(
  {
    checkins: { type: Number, min: 0, default: 0 },
    contracts: { type: Number, min: 0, default: 0 },
    signedContracts: { type: Number, min: 0, default: 0 },
    f1Customers: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const trainerTransferSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      immutable: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    fromTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    toTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      immutable: true,
    },
    previewToken: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      immutable: true,
    },
    affected: { type: countSummarySchema, required: true, immutable: true },
    retained: { type: retainedSummarySchema, required: true, immutable: true },
    completedAt: { type: Date, required: true, immutable: true },
  },
  { timestamps: true },
);

trainerTransferSchema.index(
  { requestId: 1 },
  { unique: true, name: "uniq_trainer_transfer_request" },
);
trainerTransferSchema.index(
  { clientId: 1, createdAt: -1 },
  { name: "trainer_transfer_client_created" },
);
trainerTransferSchema.index(
  { fromTrainerId: 1, createdAt: -1 },
  { name: "trainer_transfer_from_created" },
);
trainerTransferSchema.index(
  { toTrainerId: 1, createdAt: -1 },
  { name: "trainer_transfer_to_created" },
);

export default mongoose.model("TrainerTransfer", trainerTransferSchema);
