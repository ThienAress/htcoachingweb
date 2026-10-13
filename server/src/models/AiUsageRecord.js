import mongoose from "mongoose";

// Chi phí ước tính của một lượt AI. Cố ý không lưu userId, guestKey, nội dung câu hỏi
// hay câu trả lời: chỉ dùng để thống kê chi phí theo loại thao tác và nhóm người dùng.
export const AI_USAGE_RETENTION_DAYS = 90;
export const AI_USAGE_OPERATIONS = Object.freeze([
  "chat",
  "chat_image",
  "chat_smart_search",
  "meal_scan",
]);

const count = { type: Number, default: 0, min: 0 };

const aiUsageRecordSchema = new mongoose.Schema(
  {
    serviceKey: { type: String, enum: ["ai_chat", "meal_scan"], required: true },
    operation: { type: String, enum: AI_USAGE_OPERATIONS, required: true },
    tier: { type: String, maxlength: 40, default: "unknown" },
    actorKind: { type: String, enum: ["user", "guest"], required: true },
    httpStatus: { type: Number, min: 0, max: 999, default: 0 },
    aborted: { type: Boolean, default: false },
    deepseek: {
      calls: count,
      promptTokens: count,
      cacheHitTokens: count,
      cacheMissTokens: count,
      outputTokens: count,
    },
    gemini: { calls: count, promptTokens: count, outputTokens: count },
    brave: { contextCalls: count, imageCalls: count },
    estimatedCostUsd: { type: Number, min: 0, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

aiUsageRecordSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: AI_USAGE_RETENTION_DAYS * 24 * 60 * 60,
    name: "ai_usage_record_ttl",
  },
);
aiUsageRecordSchema.index(
  { operation: 1, createdAt: -1 },
  { name: "ai_usage_record_operation_created" },
);

export default mongoose.model("AiUsageRecord", aiUsageRecordSchema);
