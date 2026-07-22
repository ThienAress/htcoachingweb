import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "tool", "system"],
      required: true,
    },
    content: { type: String, default: "", maxlength: 20000 },
    image: { type: String, default: null, maxlength: 420000 },
    toolCalls: { type: mongoose.Schema.Types.Mixed, default: null },
    toolName: { type: String, default: null, maxlength: 100 },
    toolCallId: { type: String, default: null, maxlength: 200 },
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
    timestamp: { type: Date, default: Date.now },
  },
);

const chatConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Indexes
chatConversationSchema.index({ userId: 1, updatedAt: -1 });
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
