import Ajv from "ajv";
import mongoose from "mongoose";

import ChatConversation from "../models/ChatConversation.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import {
  EMBEDDING_VERSION,
  generateEmbedding,
  searchKnowledgeBase,
} from "../services/ai/embedding.service.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { trackDbQuery } from "../observability/queryTelemetry.js";
import { safeLog } from "../utils/safeLogger.js";
import {
  KNOWLEDGE_CATEGORIES,
  normalizeKnowledgeQuestion,
  parseKnowledgeEntryPayload,
} from "../utils/knowledgeBase.js";

const CATEGORY_LABELS = {
  service: "Dịch vụ",
  nutrition: "Dinh dưỡng",
  training: "Tập luyện",
  athlete: "VĐV / Influencer",
  equipment: "Dụng cụ",
  supplement: "Thực phẩm bổ sung",
  health: "Sức khỏe",
  hlv: "Huấn luyện viên",
  platform: "Nền tảng",
  general: "Chung",
};

const suggestionValidator = new Ajv({ allErrors: true }).compile({
  type: "array",
  maxItems: 10,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["index", "score", "category", "reason"],
    properties: {
      index: { type: "integer", minimum: 0, maximum: 29 },
      score: { type: "integer", minimum: 1, maximum: 10 },
      category: { type: "string", enum: KNOWLEDGE_CATEGORIES },
      reason: { type: "string", minLength: 1, maxLength: 300 },
    },
  },
});

const validId = (value) => mongoose.isValidObjectId(value);
const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};
const publicEntry = (entry) => {
  const result = entry?.toObject ? entry.toObject() : { ...entry };
  delete result.embedding;
  delete result.variants;
  delete result.normalizedQuestion;
  delete result.embeddingError;
  return result;
};
const embeddingFailure = (error) =>
  String(error?.message || "Embedding generation failed").slice(0, 500);

async function generateEntryEmbeddings(question, variantTexts) {
  const embedding = await generateEmbedding(question);
  const variants = [];
  for (const text of variantTexts) {
    variants.push({ text, embedding: await generateEmbedding(text) });
  }
  return { embedding, variants };
}

async function createKnowledgeRecord({ payload, userId, source }) {
  const normalizedQuestion = normalizeKnowledgeQuestion(payload.question);
  const exactDuplicate = await KnowledgeEntry.findOne({ normalizedQuestion })
    .select("question answer category variantCount")
    .lean();
  if (exactDuplicate) return { exactDuplicate };

  const variantTexts = payload.variants || [];
  let vectorData;
  let vectorError = null;
  try {
    vectorData = await generateEntryEmbeddings(payload.question, variantTexts);
  } catch (error) {
    vectorError = embeddingFailure(error);
    vectorData = {
      embedding: [],
      variants: variantTexts.map((text) => ({ text, embedding: [] })),
    };
  }

  if (!payload.skipDuplicateCheck && !vectorError) {
    const similar = await searchKnowledgeBase(payload.question, {
      limit: 3,
      threshold: 0.8,
    });
    if (similar.length > 0) return { similar };
  }

  const embeddingStatus = vectorError ? "failed" : "ready";
  const desiredStatus = payload.status || "draft";
  const entry = await KnowledgeEntry.create({
    question: payload.question,
    normalizedQuestion,
    answer: payload.answer,
    category: payload.category || "general",
    tags: payload.tags || [],
    status:
      desiredStatus === "published" && embeddingStatus !== "ready"
        ? "draft"
        : desiredStatus,
    ...vectorData,
    variantCount: vectorData.variants.length,
    embeddingStatus,
    embeddingVersion: EMBEDDING_VERSION,
    embeddingError: vectorError,
    embeddingUpdatedAt: vectorError ? null : new Date(),
    source,
    createdBy: userId,
  });
  return { entry, vectorError };
}

const duplicateResponse = (res, result, payload) => {
  if (result.exactDuplicate) {
    return res.status(409).json({
      success: false,
      code: "KNOWLEDGE_DUPLICATE",
      message: "Câu hỏi này đã tồn tại trong Knowledge Base",
      duplicate: publicEntry(result.exactDuplicate),
    });
  }
  if (result.similar) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: `Tìm thấy ${result.similar.length} entry tương tự`,
      similar: result.similar.map((entry) => ({
        _id: entry._id,
        question: entry.question,
        answer: `${entry.answer?.slice(0, 200) || ""}${entry.answer?.length > 200 ? "..." : ""}`,
        category: entry.category,
        similarity: Math.round(entry.similarity * 100),
        variantCount: entry.variantCount || 0,
      })),
      pendingData: {
        question: payload.question,
        answer: payload.answer,
        category: payload.category,
        tags: payload.tags,
        variants: payload.variants,
        status: payload.status,
      },
    });
  }
  return null;
};

export const getEntries = async (req, res) => {
  try {
    const page = clampInteger(req.query.page, 1, 1, 100000);
    const limit = clampInteger(req.query.limit, 20, 1, 100);
    const filter = {};
    if (req.query.category) {
      if (!KNOWLEDGE_CATEGORIES.includes(req.query.category)) {
        return res.status(400).json({ success: false, message: "Danh mục không hợp lệ" });
      }
      filter.category = req.query.category;
    }
    if (req.query.status) {
      if (!["draft", "published", "archived"].includes(req.query.status)) {
        return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
      }
      filter.status = req.query.status;
    }
    const search = String(req.query.search || "").trim().slice(0, 100);
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ question: regex }, { answer: regex }, { tags: regex }];
    }

    const [entries, total] = await trackDbQuery("knowledge.admin.list", () =>
      Promise.all([
        KnowledgeEntry.find(filter)
          .sort({ usageCount: -1, updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate("createdBy", "name")
          .lean(),
        KnowledgeEntry.countDocuments(filter),
      ]),
    );
    return res.json({
      success: true,
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể tải Knowledge Base" });
  }
};

export const createEntry = async (req, res) => {
  const parsed = parseKnowledgeEntryPayload(req.body);
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  try {
    const result = await createKnowledgeRecord({ payload: parsed.value, userId: req.user.id });
    const duplicate = duplicateResponse(res, result, parsed.value);
    if (duplicate) return duplicate;
    return res.status(201).json({
      success: true,
      data: publicEntry(result.entry),
      ...(result.vectorError && { warning: "Entry đã lưu ở draft vì chưa tạo được embedding" }),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Câu hỏi này đã tồn tại" });
    return res.status(500).json({ success: false, message: "Không thể tạo knowledge entry" });
  }
};

export const updateEntry = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Mã entry không hợp lệ" });
  }
  const parsed = parseKnowledgeEntryPayload(req.body, { partial: true });
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  const payload = parsed.value;
  delete payload.skipDuplicateCheck;
  if (!Object.keys(payload).length) {
    return res.status(400).json({ success: false, message: "Không có dữ liệu để cập nhật" });
  }

  try {
    const entry = await KnowledgeEntry.findById(req.params.id).select(
      "+embedding +variants +embeddingError +normalizedQuestion",
    );
    if (!entry) return res.status(404).json({ success: false, message: "Không tìm thấy knowledge entry" });

    const nextQuestion = payload.question || entry.question;
    const nextNormalized = normalizeKnowledgeQuestion(nextQuestion);
    const nextVariants = payload.variants || (entry.variants || []).map((item) => item.text);
    const embeddingChanged =
      nextNormalized !== entry.normalizedQuestion || payload.variants !== undefined;
    if (nextNormalized !== entry.normalizedQuestion) {
      const duplicate = await KnowledgeEntry.exists({
        _id: { $ne: entry._id },
        normalizedQuestion: nextNormalized,
      });
      if (duplicate) return res.status(409).json({ success: false, message: "Câu hỏi này đã tồn tại" });
    }

    for (const key of ["question", "answer", "category", "tags"]) {
      if (payload[key] !== undefined) entry[key] = payload[key];
    }
    const desiredStatus = payload.status || entry.status;
    if (!embeddingChanged) {
      if (desiredStatus === "published" && entry.embeddingStatus !== "ready") {
        return res.status(409).json({ success: false, message: "Hãy tạo embedding thành công trước khi publish" });
      }
      entry.status = desiredStatus;
      await entry.save();
      return res.json({ success: true, data: publicEntry(entry) });
    }

    entry.status = "draft";
    entry.embeddingStatus = "pending";
    entry.embeddingError = null;
    entry.embedding = [];
    entry.variants = nextVariants.map((text) => ({ text, embedding: [] }));
    entry.embeddingVersion = EMBEDDING_VERSION;
    await entry.save();

    try {
      const vectorData = await generateEntryEmbeddings(nextQuestion, nextVariants);
      entry.embedding = vectorData.embedding;
      entry.variants = vectorData.variants;
      entry.embeddingStatus = "ready";
      entry.embeddingError = null;
      entry.embeddingUpdatedAt = new Date();
      entry.status = desiredStatus;
    } catch (error) {
      entry.embedding = [];
      entry.variants = nextVariants.map((text) => ({ text, embedding: [] }));
      entry.embeddingStatus = "failed";
      entry.embeddingError = embeddingFailure(error);
      entry.embeddingUpdatedAt = null;
      entry.status = "draft";
    }
    await entry.save();
    return res.json({
      success: true,
      data: publicEntry(entry),
      ...(entry.embeddingStatus === "failed" && {
        warning: "Entry đã chuyển về draft vì chưa tạo được embedding",
      }),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Câu hỏi này đã tồn tại" });
    if (error?.name === "VersionError") return res.status(409).json({ success: false, message: "Entry vừa được cập nhật ở nơi khác, hãy tải lại" });
    return res.status(500).json({ success: false, message: "Không thể cập nhật knowledge entry" });
  }
};

export const deleteEntry = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã entry không hợp lệ" });
  const result = await KnowledgeEntry.deleteOne({ _id: req.params.id });
  if (!result.deletedCount) return res.status(404).json({ success: false, message: "Không tìm thấy knowledge entry" });
  return res.json({ success: true, message: "Đã xóa knowledge entry" });
};

export const createFromConversation = async (req, res) => {
  const { conversationId, questionIndex, answerIndex } = req.body || {};
  if (!validId(conversationId) || !Number.isInteger(questionIndex) || !Number.isInteger(answerIndex)) {
    return res.status(400).json({ success: false, message: "Nguồn conversation không hợp lệ" });
  }
  const conversation = await ChatConversation.findById(conversationId).select("messages").lean();
  if (!conversation) return res.status(404).json({ success: false, message: "Không tìm thấy conversation nguồn" });
  const sourceQuestion = conversation.messages[questionIndex];
  const sourceAnswer = conversation.messages[answerIndex];
  if (sourceQuestion?.role !== "user" || sourceAnswer?.role !== "assistant") {
    return res.status(400).json({ success: false, message: "Cặp Q&A nguồn không hợp lệ" });
  }

  const parsed = parseKnowledgeEntryPayload({
    question: req.body.question || sourceQuestion.content,
    answer: req.body.answer || sourceAnswer.content,
    category: req.body.category,
    tags: req.body.tags,
    status: req.body.status || "draft",
    variants: req.body.variants,
    skipDuplicateCheck: req.body.skipDuplicateCheck,
  });
  if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
  try {
    const result = await createKnowledgeRecord({
      payload: parsed.value,
      userId: req.user.id,
      source: { conversationId, messageIndex: questionIndex },
    });
    const duplicate = duplicateResponse(res, result, parsed.value);
    if (duplicate) return duplicate;
    return res.status(201).json({
      success: true,
      data: publicEntry(result.entry),
      ...(result.vectorError && { warning: "Entry đã lưu ở draft vì chưa tạo được embedding" }),
    });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Câu hỏi này đã tồn tại" });
    return res.status(500).json({ success: false, message: "Không thể tạo entry từ conversation" });
  }
};

export const searchEntries = async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query || query.length > 500) return res.status(400).json({ success: false, message: "Query không hợp lệ" });
  const limit = clampInteger(req.query.limit, 5, 1, 10);
  const threshold = Number(req.query.threshold ?? 0.7);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    return res.status(400).json({ success: false, message: "Threshold không hợp lệ" });
  }
  const results = await searchKnowledgeBase(query, { limit, threshold });
  return res.json({ success: true, data: results });
};

export const getStats = async (_req, res) => {
  try {
    const [total, byCategory, byStatus, byEmbeddingStatus, topUsed] = await Promise.all([
      KnowledgeEntry.countDocuments(),
      KnowledgeEntry.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      KnowledgeEntry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      KnowledgeEntry.aggregate([{ $group: { _id: "$embeddingStatus", count: { $sum: 1 } } }]),
      KnowledgeEntry.find({ usageCount: { $gt: 0 } })
        .sort({ usageCount: -1 })
        .limit(10)
        .select("question category usageCount lastUsedAt")
        .lean(),
    ]);
    return res.json({
      success: true,
      data: {
        total,
        byCategory: byCategory.map((item) => ({
          category: item._id,
          label: CATEGORY_LABELS[item._id] || item._id,
          count: item.count,
        })),
        byStatus,
        byEmbeddingStatus,
        topUsed,
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể tải thống kê" });
  }
};

export const regenerateEmbedding = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã entry không hợp lệ" });
  const entry = await KnowledgeEntry.findById(req.params.id).select(
    "+embedding +variants +embeddingError",
  );
  if (!entry) return res.status(404).json({ success: false, message: "Không tìm thấy knowledge entry" });
  const desiredStatus = entry.status;
  const variantTexts = (entry.variants || []).map((variant) => variant.text);
  entry.status = "draft";
  entry.embeddingStatus = "pending";
  entry.embeddingError = null;
  await entry.save();

  try {
    const vectorData = await generateEntryEmbeddings(entry.question, variantTexts);
    entry.embedding = vectorData.embedding;
    entry.variants = vectorData.variants;
    entry.embeddingStatus = "ready";
    entry.embeddingVersion = EMBEDDING_VERSION;
    entry.embeddingUpdatedAt = new Date();
    entry.status = desiredStatus;
    await entry.save();
    return res.json({ success: true, message: "Đã tạo lại embedding", data: publicEntry(entry) });
  } catch (error) {
    entry.embedding = [];
    entry.variants = variantTexts.map((text) => ({ text, embedding: [] }));
    entry.embeddingStatus = "failed";
    entry.embeddingError = embeddingFailure(error);
    entry.embeddingUpdatedAt = null;
    entry.status = "draft";
    await entry.save();
    return res.status(503).json({
      success: false,
      message: "Không thể tạo embedding; entry đã được giữ ở draft",
    });
  }
};

export const mergeVariant = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã entry không hợp lệ" });
  if (!req.body || Object.keys(req.body).some((key) => key !== "question")) {
    return res.status(400).json({ success: false, message: "Chỉ chấp nhận nội dung câu hỏi variant" });
  }
  const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
  if (!question || question.length > 500) {
    return res.status(400).json({ success: false, message: "Câu hỏi variant không hợp lệ" });
  }

  const entry = await KnowledgeEntry.findById(req.params.id).select(
    "+embedding +variants +embeddingError",
  );
  if (!entry) return res.status(404).json({ success: false, message: "Không tìm thấy entry gốc" });
  const normalized = normalizeKnowledgeQuestion(question);
  const alreadyExists =
    normalizeKnowledgeQuestion(entry.question) === normalized ||
    (entry.variants || []).some(
      (variant) => normalizeKnowledgeQuestion(variant.text) === normalized,
    );
  if (alreadyExists) return res.status(409).json({ success: false, message: "Variant này đã tồn tại" });

  let embedding;
  try {
    embedding = await generateEmbedding(question);
  } catch {
    return res.status(503).json({ success: false, message: "Không thể tạo embedding cho variant" });
  }
  entry.variants.push({ text: question, embedding });
  await entry.save();
  return res.json({ success: true, message: "Đã merge variant", variantCount: entry.variantCount });
};

export const getVariants = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã entry không hợp lệ" });
  const entry = await KnowledgeEntry.findById(req.params.id)
    .select("+variants question category")
    .lean();
  if (!entry) return res.status(404).json({ success: false, message: "Không tìm thấy entry" });
  return res.json({
    success: true,
    data: {
      _id: entry._id,
      question: entry.question,
      category: entry.category,
      variants: (entry.variants || []).map((variant) => ({
        _id: variant._id,
        text: variant.text,
        hasEmbedding: variant.embedding?.length > 0,
      })),
    },
  });
};

export const deleteVariant = async (req, res) => {
  if (!validId(req.params.id) || !validId(req.params.variantId)) {
    return res.status(400).json({ success: false, message: "Mã variant không hợp lệ" });
  }
  const entry = await KnowledgeEntry.findById(req.params.id).select(
    "+embedding +variants +embeddingError",
  );
  if (!entry) return res.status(404).json({ success: false, message: "Không tìm thấy entry" });
  const before = entry.variants.length;
  entry.variants = entry.variants.filter(
    (variant) => variant._id.toString() !== req.params.variantId,
  );
  if (entry.variants.length === before) {
    return res.status(404).json({ success: false, message: "Không tìm thấy variant" });
  }
  await entry.save();
  return res.json({ success: true, message: "Đã xóa variant" });
};

export const getAllConversations = async (req, res) => {
  const page = clampInteger(req.query.page, 1, 1, 100000);
  const limit = clampInteger(req.query.limit, 20, 1, 100);
  const filter = {};
  const search = String(req.query.search || "").trim().slice(0, 100);
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: regex }, { lastMessagePreview: regex }];
  }
  const [conversations, total] = await Promise.all([
    ChatConversation.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("userId", "name email")
      .select("_id title userId updatedAt messageCount lastMessagePreview tokenUsage")
      .lean(),
    ChatConversation.countDocuments(filter),
  ]);
  return res.json({
    success: true,
    data: conversations.map((item) => ({
      _id: item._id,
      title: item.title || "Cuộc trò chuyện",
      user: item.userId,
      updatedAt: item.updatedAt,
      messageCount: item.messageCount || 0,
      preview: item.lastMessagePreview || "",
      tokenUsage: item.tokenUsage,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
};

export const getFullConversation = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Mã conversation không hợp lệ" });
  const conversation = await ChatConversation.findById(req.params.id)
    .populate("userId", "name email")
    .lean();
  if (!conversation) return res.status(404).json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });

  const qaPairs = [];
  for (let index = 0; index < conversation.messages.length; index += 1) {
    const current = conversation.messages[index];
    if (current.role !== "user") continue;
    let answerIndex = null;
    for (let next = index + 1; next < conversation.messages.length; next += 1) {
      if (conversation.messages[next].role === "user") break;
      if (
        conversation.messages[next].role === "assistant" &&
        conversation.messages[next].content
      ) {
        answerIndex = next;
        break;
      }
    }
    qaPairs.push({
      questionIndex: index,
      question: current.content,
      answerIndex,
      answer: answerIndex === null ? null : conversation.messages[answerIndex].content,
      timestamp: current.timestamp,
    });
  }
  return res.json({ success: true, data: { ...conversation, qaPairs } });
};

export const getCategories = async (_req, res) =>
  res.json({
    success: true,
    data: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  });

export const suggestFromConversations = async (req, res) => {
  try {
    const days = clampInteger(req.body?.days, 7, 1, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const conversations = await ChatConversation.find({
      updatedAt: { $gte: since },
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .select("messages title")
      .lean();
    if (!conversations.length) {
      return res.json({
        success: true,
        data: [],
        message: `Không có cuộc trò chuyện nào trong ${days} ngày qua`,
      });
    }

    const allPairs = [];
    for (const conversation of conversations) {
      for (let index = 0; index < conversation.messages.length; index += 1) {
        const question = conversation.messages[index];
        if (question.role !== "user" || question.content?.trim().length <= 10) continue;
        let answer = null;
        for (let next = index + 1; next < conversation.messages.length; next += 1) {
          if (conversation.messages[next].role === "user") break;
          if (
            conversation.messages[next].role === "assistant" &&
            conversation.messages[next].content?.trim()
          ) {
            answer = conversation.messages[next];
            break;
          }
        }
        if (answer?.content.length > 30) {
          allPairs.push({
            question: question.content.slice(0, 500),
            answer: answer.content.slice(0, 5000),
            convTitle: conversation.title,
          });
        }
      }
    }

    const existing = await KnowledgeEntry.find({})
      .select("+normalizedQuestion")
      .lean();
    const existingSet = new Set(existing.map((item) => item.normalizedQuestion));
    const sample = allPairs
      .filter(
        (pair) =>
          !existingSet.has(normalizeKnowledgeQuestion(pair.question)),
      )
      .slice(0, 30);
    if (!sample.length) {
      return res.json({
        success: true,
        data: [],
        message: "Không tìm thấy Q&A mới phù hợp",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        message: "AI suggestion chưa được cấu hình",
      });
    }
    const prompt = `Đánh giá các cặp Q&A fitness sau. Chọn tối đa 10 mục dùng chung tốt nhất. Trả JSON array với index, score 1-10, category và reason ngắn. Category chỉ thuộc: ${KNOWLEDGE_CATEGORIES.join(", ")}.\n\n${sample
      .map(
        (pair, index) =>
          `[${index}] Q: ${pair.question.slice(0, 200)}\nA: ${pair.answer.slice(0, 300)}`,
      )
      .join("\n\n")}`;
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) {
      safeLog.warn("kb.ai_suggestion_provider_error", "Provider returned error", {
        status: response.status,
      });
      return res.status(503).json({
        success: false,
        message: "AI suggestion tạm thời không khả dụng",
      });
    }

    const data = await response.json();
    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("") || "";
    let suggestions;
    try {
      suggestions = JSON.parse(
        raw
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/, "")
          .trim(),
      );
    } catch {
      return res.status(502).json({
        success: false,
        message: "AI trả kết quả không hợp lệ",
      });
    }
    if (!suggestionValidator(suggestions)) {
      return res.status(502).json({
        success: false,
        message: "AI trả dữ liệu không đúng schema",
      });
    }

    const usedIndexes = new Set();
    const results = suggestions
      .filter((item) => {
        if (
          item.index >= sample.length ||
          item.score < 6 ||
          usedIndexes.has(item.index)
        ) {
          return false;
        }
        usedIndexes.add(item.index);
        return true;
      })
      .sort((left, right) => right.score - left.score)
      .map((item) => ({
        question: sample[item.index].question,
        answer: sample[item.index].answer,
        category: item.category,
        score: item.score,
        reason: item.reason,
        convTitle: sample[item.index].convTitle,
      }));
    return res.json({
      success: true,
      data: results,
      totalScanned: allPairs.length,
    });
  } catch (error) {
    safeLog.error("kb.ai_suggestion_failed", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo AI suggestion",
    });
  }
};
