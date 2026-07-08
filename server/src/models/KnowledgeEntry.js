import mongoose from "mongoose";

const knowledgeEntrySchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
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
      type: [String],
      default: [],
    },
    embedding: {
      type: [Number],
      default: [],
      select: false, // Không trả về mặc định (tiết kiệm bandwidth)
    },
    // Biến thể câu hỏi — cùng answer, mỗi variant có embedding riêng
    variants: {
      type: [
        {
          text: { type: String, required: true, trim: true, maxlength: 500 },
          embedding: { type: [Number], default: [] },
        },
      ],
      default: [],
      select: false,
    },
    source: {
      conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatConversation", default: null },
      messageIndex: { type: Number, default: null },
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
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
  { timestamps: true }
);

// Indexes
knowledgeEntrySchema.index({ status: 1, category: 1 });
knowledgeEntrySchema.index({ tags: 1 });
knowledgeEntrySchema.index({ usageCount: -1 });

export default mongoose.model("KnowledgeEntry", knowledgeEntrySchema);
