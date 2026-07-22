import mongoose from "mongoose";

const trainingScheduleCommandSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestId: {
      type: String,
      required: true,
      maxlength: 64,
    },
    commandType: {
      type: String,
      enum: ["create", "reschedule", "cancel", "complete", "cancel_all"],
      required: true,
    },
    payloadFingerprint: {
      type: String,
      required: true,
      maxlength: 64,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainingSchedule",
    },
    responseRevision: {
      type: Number,
      min: 0,
    },
    resultCount: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true },
);

trainingScheduleCommandSchema.index(
  { actorId: 1, requestId: 1 },
  { unique: true, name: "uniq_training_schedule_command" },
);
trainingScheduleCommandSchema.index({ scheduleId: 1, createdAt: -1 });

export default mongoose.model(
  "TrainingScheduleCommand",
  trainingScheduleCommandSchema,
);
