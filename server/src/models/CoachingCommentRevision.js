import mongoose from "mongoose";

const coachingCommentRevisionSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoachingComment",
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
      enum: ["trainer", "user"],
      required: true,
    },
    action: {
      type: String,
      enum: ["create", "edit", "remove"],
      required: true,
    },
    requestId: {
      type: String,
      required: true,
      match:
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    payloadFingerprint: {
      type: String,
      minlength: 64,
      maxlength: 64,
      required: true,
      select: false,
    },
    beforeHash: { type: String, minlength: 64, maxlength: 64, default: null },
    afterHash: { type: String, minlength: 64, maxlength: 64, default: null },
    changedAt: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true },
);

coachingCommentRevisionSchema.index(
  { commentId: 1, revision: 1 },
  { unique: true, name: "uniq_coaching_comment_revision" },
);
coachingCommentRevisionSchema.index(
  { actorId: 1, requestId: 1 },
  { unique: true, name: "uniq_coaching_comment_request" },
);
coachingCommentRevisionSchema.index(
  { clientId: 1, changedAt: -1 },
  { name: "coaching_comment_revision_client_history" },
);

export default mongoose.model(
  "CoachingCommentRevision",
  coachingCommentRevisionSchema,
);
