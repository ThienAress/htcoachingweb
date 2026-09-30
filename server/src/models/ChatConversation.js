import mongoose from "mongoose";
import { AI_TOOL_RESULT_STATUSES } from "../constants/aiToolResult.js";

const answerTraceSchema = new mongoose.Schema(
  {
    routeDomain: {
      type: String,
      enum: ["ht_service", "fitness", "adjacent", "general"],
      required: true,
    },
    evidenceMode: {
      type: String,
      enum: ["internal_kb", "web_required", "model_prior"],
      required: true,
    },
    kbEntryIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "KnowledgeEntry" }],
      default: [],
      validate: {
        validator: (value) => value.length <= 10,
        message: "Answer trace chỉ được chứa tối đa 10 Knowledge Entry IDs",
      },
    },
    webSearchUsed: { type: Boolean, default: false },
    webSearchOutcome: {
      type: String,
      enum: [
        "not_called",
        "provider_error",
        "no_supported_source",
        "grounded",
      ],
      default: "not_called",
    },
    model: { type: String, required: true, maxlength: 100 },
    promptVersion: { type: String, required: true, maxlength: 100 },
  },
  { _id: false },
);

const feedbackReviewSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "pending", "resolved", "dismissed"],
      default: "none",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false },
);

const structuredActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["calculate_tdee"],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false },
);

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "tool", "system"],
      required: true,
    },
    content: { type: String, default: "", maxlength: 20000 },
    image: { type: String, default: null, maxlength: 420000 },
    structuredAction: {
      type: structuredActionSchema,
      default: null,
    },
    toolCalls: { type: mongoose.Schema.Types.Mixed, default: null },
    toolName: { type: String, default: null, maxlength: 100 },
    toolCallId: { type: String, default: null, maxlength: 200 },
    toolStatus: {
      type: String,
      enum: [...AI_TOOL_RESULT_STATUSES, null],
      default: null,
    },
    uiCard: {
      type: {
        cardType: String,
        data: mongoose.Schema.Types.Mixed,
      },
      default: null,
    },
    feedback: {
      type: String,
      enum: ["up", "down", null],
      default: null,
    },
    feedbackReview: {
      type: feedbackReviewSchema,
      default: null,
    },
    answerTrace: {
      type: answerTraceSchema,
      default: null,
    },
    timestamp: { type: Date, default: Date.now },
  },
);

const chatConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestKey: {
      type: String,
      default: null,
      maxlength: 64,
      select: false,
    },
    title: {
      type: String,
      default: "",
      maxlength: 80,
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
    },
    messageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessagePreview: {
      type: String,
      default: "",
      maxlength: 120,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    recentRequestIds: {
      type: [String],
      default: [],
      select: false,
    },
    activeStreamId: {
      type: String,
      default: null,
      select: false,
    },
    activeStreamStartedAt: {
      type: Date,
      default: null,
      select: false,
    },
    forkedFromConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      default: null,
    },
    forkedFromMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    context: {
      page: { type: String, default: "" },
      pageType: { type: String, default: "general" },
      pageTitle: { type: String, default: "" },
      lastPage: { type: String, default: "" },
      userMetrics: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    workingMemory: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    tokenUsage: {
      totalInputTokens: { type: Number, default: 0 },
      totalOutputTokens: { type: Number, default: 0 },
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

chatConversationSchema.pre("validate", function validateConversationOwner() {
  const ownerCount = Number(Boolean(this.userId)) + Number(Boolean(this.guestKey));
  if (ownerCount !== 1) {
    this.invalidate(
      "userId",
      "Conversation phải thuộc đúng một user hoặc guest session",
    );
  }
});

// Indexes
chatConversationSchema.index({ userId: 1, updatedAt: -1 });
chatConversationSchema.index(
  { guestKey: 1, updatedAt: -1 },
  {
    partialFilterExpression: { guestKey: { $type: "string" } },
    name: "guest_ai_conversations",
  },
);
chatConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
chatConversationSchema.index(
  { userId: 1, recentRequestIds: 1 },
  {
    unique: true,
    partialFilterExpression: { recentRequestIds: { $type: "string" } },
    name: "uniq_ai_request_per_user",
  },
);

export default mongoose.model("ChatConversation", chatConversationSchema);
