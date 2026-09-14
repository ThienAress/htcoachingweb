import mongoose from "mongoose";
import {
  KNOWLEDGE_EVIDENCE_LEVELS,
  KNOWLEDGE_EVIDENCE_TIERS,
  KNOWLEDGE_FRESHNESS_CLASSES,
  KNOWLEDGE_REVIEW_STATUSES,
  KNOWLEDGE_SOURCE_TYPES,
  MAX_KNOWLEDGE_SOURCES,
  MAX_KNOWLEDGE_TAGS,
  MAX_KNOWLEDGE_VARIANTS,
  normalizeKnowledgeQuestion,
  validateKnowledgePublication,
} from "../utils/knowledgeBase.js";
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_VERSION,
} from "../services/ai/embeddingProfile.js";

const sourceSchema = new mongoose.Schema(
  {
    type: { type: String, enum: KNOWLEDGE_SOURCE_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    publisher: { type: String, required: true, trim: true, maxlength: 200 },
    url: {
      type: String,
      default: null,
      maxlength: 2048,
      validate: {
        validator: (value) => {
          if (!value) return true;
          try {
            const parsed = new URL(value);
            return parsed.protocol === "https:" && !parsed.username && !parsed.password;
          } catch {
            return false;
          }
        },
        message: "Knowledge source URL phải dùng HTTPS",
      },
    },
    publishedAt: { type: Date, default: null },
    retrievedAt: { type: Date, default: null },
    evidenceTier: {
      type: String,
      enum: KNOWLEDGE_EVIDENCE_TIERS,
      required: true,
    },
  },
  { _id: false },
);

const sha256Pattern = /^[a-f0-9]{64}$/;

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
    sources: {
      type: [sourceSchema],
      default: [],
      validate: {
        validator: (value) => value.length <= MAX_KNOWLEDGE_SOURCES,
        message: `Tối đa ${MAX_KNOWLEDGE_SOURCES} knowledge sources`,
      },
    },
    evidenceLevel: {
      type: String,
      enum: KNOWLEDGE_EVIDENCE_LEVELS,
      default: "legacy_unverified",
    },
    reviewStatus: {
      type: String,
      enum: KNOWLEDGE_REVIEW_STATUSES,
      default: "needs_review",
    },
    freshnessClass: {
      type: String,
      enum: KNOWLEDGE_FRESHNESS_CLASSES,
      default: "stable",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: { type: Date, default: null },
    reviewDueAt: { type: Date, default: null },
    revision: { type: Number, default: 1, min: 1 },
    source: {
      conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatConversation", default: null },
      messageIndex: { type: Number, default: null },
      questionIndex: { type: Number, default: null, min: 0 },
      answerIndex: { type: Number, default: null, min: 0 },
      questionMessageId: { type: mongoose.Schema.Types.ObjectId, default: null },
      answerMessageId: { type: mongoose.Schema.Types.ObjectId, default: null },
      questionHash: {
        type: String,
        default: null,
        validate: {
          validator: (value) => value === null || sha256Pattern.test(value),
          message: "Question hash không hợp lệ",
        },
      },
      answerHash: {
        type: String,
        default: null,
        validate: {
          validator: (value) => value === null || sha256Pattern.test(value),
          message: "Answer hash không hợp lệ",
        },
      },
      capturedAt: { type: Date, default: null },
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
      this.embeddingVersion !== EMBEDDING_VERSION ||
      !Array.isArray(this.embedding) ||
      this.embedding.length !== EMBEDDING_DIMENSION)
  ) {
    this.invalidate(
      "status",
      "Không thể publish knowledge entry khi embedding chưa sẵn sàng",
    );
  }

  const evidenceChanged = [
    "status",
    "question",
    "answer",
    "category",
    "sources",
    "evidenceLevel",
    "freshnessClass",
    "reviewDueAt",
  ].some((path) => this.isModified(path));
  if (this.status === "published" && (this.isNew || evidenceChanged)) {
    const publication = validateKnowledgePublication(this);
    if (!publication.valid) this.invalidate("status", publication.message);
    if (this.reviewStatus !== "reviewed" || !this.reviewedBy || !this.reviewedAt) {
      this.invalidate(
        "reviewStatus",
        "Knowledge entry phải được server ghi nhận reviewer trước khi publish",
      );
    }
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
