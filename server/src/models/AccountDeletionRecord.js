import mongoose from "mongoose";

const accountDeletionRecordSchema = new mongoose.Schema(
  {
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    actorRole: {
      type: String,
      enum: ["admin", "trainer", "user"],
      required: true,
      immutable: true,
    },
    deletedCounts: {
      type: Map,
      of: Number,
      default: {},
      immutable: true,
    },
    retainedCounts: {
      type: Map,
      of: Number,
      default: {},
      immutable: true,
    },
    deferredBoundaries: {
      type: [String],
      default: [],
      immutable: true,
    },
    mediaJobsQueued: {
      type: Number,
      default: 0,
      min: 0,
      immutable: true,
    },
    f1DeletionJobsQueued: {
      type: Number,
      default: 0,
      min: 0,
      immutable: true,
    },
  },
  { timestamps: true },
);

accountDeletionRecordSchema.index(
  { targetUserId: 1 },
  { unique: true, name: "uniq_account_deletion_record" },
);
accountDeletionRecordSchema.index(
  { actorId: 1, createdAt: -1 },
  { name: "account_deletion_actor_created" },
);

export default mongoose.model(
  "AccountDeletionRecord",
  accountDeletionRecordSchema,
);
