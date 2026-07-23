import mongoose from "mongoose";
import {
  MAX_KNOWLEDGE_TAGS,
  MAX_KNOWLEDGE_VARIANTS,
  normalizeKnowledgeQuestion,
} from "../utils/knowledgeBase.js";

const EMBEDDING_DIMENSION = 768;

const knowledgeEntrySchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    normalizedQuestion: {
      type: String,
      required: true,
      select: false,
      maxlength: 500,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "service",     // Dịch vụ, giá cả, gói tập
        "nutrition",   // Dinh dưỡng, TDEE, thực đơn, macro
        "training",    // Tập luyện, bài tập, giáo án, kỹ thuật
        "athlete",     // VĐV, người nổi tiếng, influencer fitness
        "equipment",   // Dụng cụ, thiết bị tập luyện
        "supplement",  // Thực phẩm bổ sung (whey, creatine...)
        "health",      // Sức khỏe, phục hồi, chấn thương
        "hlv",         // Huấn luyện viên, đội ngũ
        "platform",    // Về nền tảng HTCOACHING, tính năng website
        "general",     // Chung, khác
      ],
      default: "general",
    },
    tags: {
      type: [{ type: String, trim: true, maxlength: 50 }],
      default: [],
      validate: {
        validator: (value) => value.length <= MAX_KNOWLEDGE_TAGS,
        message: `Tối đa ${MAX_KNOWLEDGE_TAGS} tags`,
      },
    },
    embedding: {
      type: [Number],
      default: [],
      select: false, // Không trả về mặc định (tiết kiệm bandwidth)
      validate: {
        validator: (value) =>
          value.length === 0 || value.length === EMBEDDING_DIMENSION,
        message: `Embedding phải có ${EMBEDDING_DIMENSION} chiều`,
      },
    },
    // Biến thể câu hỏi — cùng answer, mỗi variant có embedding riêng
    variants: {
      type: [
        {
          text: { type: String, required: true, trim: true, maxlength: 500 },
          embedding: {
            type: [Number],
            default: [],
            validate: {
              validator: (value) =>
                value.length === 0 || value.length === EMBEDDING_DIMENSION,
              message: `Variant embedding phải có ${EMBEDDING_DIMENSION} chiều`,
            },
          },
        },
      ],
      default: [],
      select: false,
      validate: {
        validator: (value) => value.length <= MAX_KNOWLEDGE_VARIANTS,
        message: `Tối đa ${MAX_KNOWLEDGE_VARIANTS} variants`,
      },
    },
    variantCount: {
      type: Number,
      default: 0,
      min: 0,
      max: MAX_KNOWLEDGE_VARIANTS,
    },
    embeddingStatus: {
      type: String,
      enum: ["pending", "ready", "failed"],
      default: "pending",
      index: true,
    },
    embeddingVersion: {
      type: String,
      default: null,
      maxlength: 100,
    },
    embeddingError: {
      type: String,
      default: null,
      maxlength: 500,
      select: false,
    },
    embeddingUpdatedAt: {
      type: Date,
      default: null,
    },
    source: {
      conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatConversation", default: null },
      messageIndex: { type: Number, default: null },
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

knowledgeEntrySchema.pre("validate", function syncKnowledgeIntegrity() {
  this.normalizedQuestion = normalizeKnowledgeQuestion(this.question);
  this.variantCount = this.variants?.length || 0;

  if (
    this.status === "published" &&
    (this.embeddingStatus !== "ready" ||
      !Array.isArray(this.embedding) ||
      this.embedding.length !== EMBEDDING_DIMENSION)
  ) {
    this.invalidate(
      "status",
      "Không thể publish knowledge entry khi embedding chưa sẵn sàng",
    );
  }
});

// Indexes
knowledgeEntrySchema.index({ status: 1, embeddingStatus: 1, category: 1 });
knowledgeEntrySchema.index({ tags: 1 });
knowledgeEntrySchema.index({ usageCount: -1 });
knowledgeEntrySchema.index({
  status: 1,
  category: 1,
  usageCount: -1,
  updatedAt: -1,
});
knowledgeEntrySchema.index(
  { normalizedQuestion: 1 },
  {
    unique: true,
    partialFilterExpression: { normalizedQuestion: { $type: "string" } },
    name: "uniq_knowledge_normalized_question",
  },
);

export default mongoose.model("KnowledgeEntry", knowledgeEntrySchema);
