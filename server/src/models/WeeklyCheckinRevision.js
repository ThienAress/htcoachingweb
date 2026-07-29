import mongoose from "mongoose";

const changeSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, maxlength: 80 },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const weeklyCheckinRevisionSchema = new mongoose.Schema(
  {
    checkinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WeeklyCheckin",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    revision: { type: Number, min: 1, required: true },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorRole: {
      type: String,
      enum: ["admin", "trainer", "user"],
      required: true,
    },
    action: {
      type: String,
      enum: ["create", "update", "submit", "correction", "review"],
      required: true,
    },
    changedAt: { type: Date, default: Date.now, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    requestId: {
      type: String,
      required: true,
      maxlength: 100,
      match:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    payloadFingerprint: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
      select: false,
    },
    changes: {
      type: [changeSchema],
      validate: {
        validator: (items) => items.length > 0 && items.length <= 12,
        message: "Revision phải có từ 1 đến 12 thay đổi",
      },
      required: true,
    },
  },
  { timestamps: true },
);

weeklyCheckinRevisionSchema.index(
  { checkinId: 1, revision: 1 },
  { unique: true, name: "uniq_weekly_checkin_revision" },
);
weeklyCheckinRevisionSchema.index(
  { actorId: 1, requestId: 1 },
  { unique: true, name: "uniq_weekly_checkin_request" },
);
weeklyCheckinRevisionSchema.index(
  { clientId: 1, changedAt: -1 },
  { name: "weekly_checkin_revision_client_history" },
);

export default mongoose.model(
  "WeeklyCheckinRevision",
  weeklyCheckinRevisionSchema,
);
