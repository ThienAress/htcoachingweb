import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "tool", "system"],
      required: true,
    },
    content: { type: String, default: "" },
    image: { type: String, default: null },
    toolCalls: { type: mongoose.Schema.Types.Mixed, default: null },
    toolName: { type: String, default: null },
    toolCallId: { type: String, default: null },
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
    context: {
      page: { type: String, default: "" },
      pageType: { type: String, default: "general" },
      pageTitle: { type: String, default: "" },
      lastPage: { type: String, default: "" },
      userMetrics: { type: mongoose.Schema.Types.Mixed, default: null },
      image: { type: String, default: null },
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

export default mongoose.model("ChatConversation", chatConversationSchema);
