import crypto from "crypto";
import mongoose from "mongoose";
import ChatConversation from "../models/ChatConversation.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import User from "../models/User.js";
import { llmStream } from "../services/ai/providers/index.js";
import { executeTool } from "../services/ai/tools/toolEngine.js";
import { getToolSchemas } from "../services/ai/tools/toolRegistry.js";
import { buildSystemPrompt } from "../services/ai/systemPrompt.js";
import { isUserLocked, moderateContent } from "../services/ai/contentModeration.js";
import { searchKnowledgeBase } from "../services/ai/embedding.service.js";
import { aiLogger } from "../services/ai/aiLogger.js";
import { enrichContextWithDbData } from "../services/ai/contextEnricher.js";
import {
  buildChatSummary,
  MAX_RECENT_REQUEST_IDS,
  MAX_STORED_CHAT_MESSAGES,
  parseChatRequest,
} from "../utils/aiChat.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";

const MAX_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 20;
const STREAM_STALE_MS = 10 * 60 * 1000;
const CONVERSATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const httpError = (status, message) => Object.assign(new Error(message), { status });

const contextUpdate = (context) => {
  const update = {};
  for (const key of ["page", "pageType", "pageTitle", "lastPage", "userMetrics"]) {
    if (context[key] !== "" && context[key] !== null && context[key] !== undefined) {
      update[`context.${key}`] = context[key];
    }
  }
  return update;
};

async function acquireConversation({
  userId,
  conversationId,
  requestId,
  message,
  image,
  context,
  streamId,
}) {
  const duplicate = await ChatConversation.findOne({
    userId,
    recentRequestIds: requestId,
  }).select("_id");
  if (duplicate) return { conversation: duplicate, duplicate: true };

  const timestamp = new Date();
  const summary = buildChatSummary(message, timestamp);
  const userMessage = {
    role: "user",
    content: message,
    image,
    timestamp,
  };

  if (!conversationId) {
    try {
      const conversation = await ChatConversation.create({
        userId,
        title: message.slice(0, 60),
        messages: [userMessage],
        messageCount: 1,
        ...summary,
        recentRequestIds: [requestId],
        activeStreamId: streamId,
        activeStreamStartedAt: timestamp,
        context,
        expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS),
      });
      return { conversation, duplicate: false };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const winner = await ChatConversation.findOne({
        userId,
        recentRequestIds: requestId,
      });
      if (winner) return { conversation: winner, duplicate: true };
      throw error;
    }
  }

  const staleBefore = new Date(Date.now() - STREAM_STALE_MS);
  const conversation = await ChatConversation.findOneAndUpdate(
    {
      _id: conversationId,
      userId,
      recentRequestIds: { $ne: requestId },
      $or: [
        { activeStreamId: null },
        { activeStreamId: { $exists: false } },
        { activeStreamStartedAt: { $lt: staleBefore } },
      ],
    },
    {
      $set: {
        activeStreamId: streamId,
        activeStreamStartedAt: timestamp,
        expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS),
        ...summary,
        ...contextUpdate(context),
      },
      $inc: { messageCount: 1 },
      $push: {
        messages: {
          $each: [userMessage],
          $slice: -MAX_STORED_CHAT_MESSAGES,
        },
        recentRequestIds: {
          $each: [requestId],
          $slice: -MAX_RECENT_REQUEST_IDS,
        },
      },
    },
    { returnDocument: "after", runValidators: true },
  ).select("+activeStreamId +recentRequestIds");

  if (conversation) return { conversation, duplicate: false };

  const existing = await ChatConversation.findOne({
    _id: conversationId,
    userId,
  })
    .select("_id activeStreamId recentRequestIds")
    .lean();
  if (!existing) throw httpError(404, "Không tìm thấy cuộc trò chuyện");
  if (existing.recentRequestIds?.includes(requestId)) {
    return { conversation: existing, duplicate: true };
  }
  throw httpError(409, "Cuộc trò chuyện đang xử lý một tin nhắn khác");
}

async function finalizeConversation({
  conversationId,
  userId,
  streamId,
  generatedMessages,
  assistantPreview,
}) {
  const update = {
    $set: {
      activeStreamId: null,
      activeStreamStartedAt: null,
      expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS),
    },
  };

  if (generatedMessages.length > 0) {
    update.$push = {
      messages: {
        $each: generatedMessages,
        $slice: -MAX_STORED_CHAT_MESSAGES,
      },
    };
    update.$inc = {
      messageCount: generatedMessages.filter(
        (item) => item.role === "assistant",
      ).length,
    };
  }
  if (assistantPreview) {
    Object.assign(update.$set, buildChatSummary(assistantPreview));
  }

  return ChatConversation.updateOne(
    { _id: conversationId, userId, activeStreamId: streamId },
    update,
    { runValidators: true },
  );
}

// POST /api/ai/chat — SSE streaming chat với Agent Loop
export const chatStream = async (req, res) => {
  const userId = req.user.id;
  const parsed = parseChatRequest(req.body);

  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }
  const { message, conversationId, context, image, requestId } = parsed.value;
  const streamId = crypto.randomUUID();

  let user;
  let conversation;
  try {
    user = await User.findById(userId).select("name isAiChatBanned").lean();
    if (user?.isAiChatBanned) {
      aiLogger.userLocked(userId, "permanent");
      return res.status(403).json({
        success: false,
        message: "🚫 Tài khoản của bạn đã bị cấm sử dụng Chat AI vĩnh viễn do vi phạm quy tắc cộng đồng nhiều lần.",
      });
    }
    const lockStatus = await isUserLocked(userId);
    if (lockStatus.blocked) {
      aiLogger.userLocked(userId, lockStatus.remainingMinutes);
      return res.status(403).json({
        success: false,
        message: `🚫 Chat AI đang bị khóa tạm thời. Còn ${lockStatus.remainingMinutes} phút.`,
      });
    }

    const moderation = await moderateContent(userId, message);
    if (!moderation.safe) {
      aiLogger.moderationTrigger(userId, moderation.action || "blocked");
      return res.status(400).json({ success: false, message: moderation.message });
    }

    const acquired = await acquireConversation({
      userId,
      conversationId,
      requestId,
      message,
      image,
      context,
      streamId,
    });
    conversation = acquired.conversation;

    if (acquired.duplicate) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      res.write(
        `data: ${JSON.stringify({
          type: "done",
          conversationId: conversation._id,
          duplicate: true,
        })}\n\n`,
      );
      return res.end();
    }
  } catch (error) {
    aiLogger.chatError(userId, error, "chatPreflight");
    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Lỗi hệ thống khi chuẩn bị cuộc trò chuyện",
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded && !abortController.signal.aborted) {
      incrementMetric("ai.aborts");
    }
    abortController.abort();
  });

  const generatedMessages = [];
  let finalized = false;
  let fullResponse = "";
  try {
    const chatStartTime = Date.now();
    let toolCallCount = 0;
    res.write(
      `data: ${JSON.stringify({
        type: "conversation",
        conversationId: conversation._id,
      })}\n\n`,
    );

    // Enrich Context from DB
    let pageData = null;
    let pageType = null;
    if (conversation.context?.page) {
      pageType = conversation.context.pageType || 'general';
      pageData = await enrichContextWithDbData(conversation.context);
    }

    // Build system prompt với context
    let systemPrompt = buildSystemPrompt({
      userName: user?.name,
      currentPage: conversation.context?.page || conversation.context?.lastPage,
      pageType,
      pageData,
      userMetrics: conversation.context?.userMetrics,
    });

    // === KNOWLEDGE BASE SEARCH ===
    // Tìm kiến thức đã verified trước khi gọi LLM
    let kbEntryIds = [];
    try {
      const kbResults = await searchKnowledgeBase(message, { limit: 3, threshold: 0.75 });
      if (kbResults.length > 0) {
        kbEntryIds = kbResults.map((r) => r._id);
        aiLogger.kbMatch(userId, kbResults.length, kbResults[0]?.similarity);
        systemPrompt += `\n\n## Kiến thức đã verified (ưu tiên dùng làm tham khảo chính):\n`;
        kbResults.forEach((r, i) => {
          const matchLabel = r.matchedQuestion && r.matchedQuestion !== r.question 
            ? `Q: ${r.question} (Biến thể trùng khớp: "${r.matchedQuestion}")` 
            : `Q: ${r.question}`;
          systemPrompt += `\n### KB #${i + 1} (${(r.similarity * 100).toFixed(0)}% match):\n`;
          systemPrompt += `${matchLabel}\nA: ${r.answer}\n`;
        });
        systemPrompt += `\nHãy dùng kiến thức trên làm tham khảo CHÍNH. Có thể diễn đạt lại cho tự nhiên, nhưng KHÔNG đi ngược lại nội dung verified. QUAN TRỌNG: Khi đã có kiến thức verified ở trên, KHÔNG được gọi search_knowledge — trả lời trực tiếp từ kiến thức này.`;
      }
    } catch (err) {
      // KB search lỗi không ảnh hưởng chat flow chính
      safeLog.error("ai.kb_search_non_blocking_failed", err);
    }

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...conversation.messages.slice(-MAX_HISTORY_MESSAGES).map((m) => {
        const mapped = { role: m.role, content: m.content || "" };
        if (m.image) mapped.image = m.image;
        
        // Giữ lại tool_calls trong history để LLM không "quên" đã gọi tool gì
        if (m.role === "assistant" && m.toolCalls?.length > 0) {
          mapped.tool_calls = m.toolCalls;
        }
        // Giữ tên tool cho role "tool"
        if (m.role === "tool" && m.toolName) {
          mapped.name = m.toolName;
          if (m.toolCallId) mapped.id = m.toolCallId;
        }
        return mapped;
      }),
    ];

    const tools = getToolSchemas();
    let lastToolResultText = ""; // Backup: dùng khi Gemini im luôn sau tool call

    // === AGENT LOOP (Pattern từ Dify fc_agent_runner.py) ===
    let iteration = 0;
    let needsToolCall = true;
    aiLogger.chatStart(userId, conversation._id);

    while (
      needsToolCall &&
      iteration < MAX_ITERATIONS &&
      !abortController.signal.aborted
    ) {
      needsToolCall = false;
      iteration++;

      for await (const chunk of llmStream(llmMessages, tools, {
        signal: abortController.signal,
      })) {
        if (abortController.signal.aborted) break;
        switch (chunk.type) {
          case "text":
            // Lọc error text từ Gemini (trả 200 nhưng body chứa lỗi kỹ thuật)
            if (chunk.content.includes("thought_signature") || 
                chunk.content.includes("Lỗi AI") ||
                chunk.content.startsWith("⚠️ Lỗi")) {
              safeLog.warn(
                "ai.filtered_provider_error_text",
                "Provider emitted technical error text",
              );
              break;
            }
            fullResponse += chunk.content;
            res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
            break;

          case "tool_call":
            needsToolCall = true;
            
            // XÓA BỎ VĂN BẢN RÁC: Khi LLM gọi tool, nó sẽ bắt đầu lại từ đầu ở Turn sau,
            // nên mọi văn bản đã sinh ra ở Turn hiện tại chỉ là nháp và phải bị vứt bỏ.
            fullResponse = "";

            for (const call of chunk.toolCalls) {
              // Gửi tool_start cho FE loading
              res.write(`data: ${JSON.stringify({ type: "tool_start", tool: call.name })}\n\n`);

              // Thực thi tool
              const toolStartTime = Date.now();
              const toolResult = await executeTool(call.name, call.args, { userId });
              const safeToolText = String(toolResult.text || "").slice(0, 20000);
              const toolDuration = Date.now() - toolStartTime;
              toolCallCount++;
              aiLogger.toolCall(userId, call.name, toolDuration, !toolResult.error);

              // Gửi tool_result cho FE
              res.write(`data: ${JSON.stringify({ type: "tool_result", tool: call.name, text: safeToolText })}\n\n`);

              // Nếu có UI card → gửi cho FE render
              if (toolResult.uiCard) {
                res.write(`data: ${JSON.stringify({ type: "ui_card", ...toolResult.uiCard })}\n\n`);
              }

              // Thêm assistant tool_call + tool result vào messages cho LLM iteration tiếp
              // Kèm thoughtParts để Gemini nhận diện đúng thinking context
              llmMessages.push({ 
                role: "assistant", 
                content: "", 
                tool_calls: [call],
                _thoughtParts: chunk.thoughtParts || [],
              });
              llmMessages.push({ role: "tool", content: safeToolText, name: call.name });
              lastToolResultText = safeToolText; // Lưu backup

              // Lưu tool call vào conversation
              generatedMessages.push({
                role: "assistant",
                content: "",
                toolCalls: [call],
                timestamp: new Date(),
              });
              generatedMessages.push({
                role: "tool",
                content: safeToolText,
                toolName: call.name,
                toolCallId: call.id,
                uiCard: toolResult.uiCard,
                timestamp: new Date(),
              });
            }
            break;

          case "ui_card":
            res.write(`data: ${JSON.stringify({ type: "ui_card", cardType: chunk.cardType, data: chunk.data })}\n\n`);
            break;
        }
      }
    }

    // Lưu final response
    // Fallback: nếu Gemini không trả text sau tool call → dùng tool result text
    if (
      !abortController.signal.aborted &&
      !fullResponse &&
      toolCallCount > 0 &&
      lastToolResultText
    ) {
      safeLog.warn(
        "ai.tool_result_fallback",
        "Provider returned no text after tool call",
      );
      fullResponse = lastToolResultText;
      res.write(`data: ${JSON.stringify({ type: "text", content: fullResponse })}\n\n`);
    }
    if (fullResponse) {
      fullResponse = fullResponse.slice(0, 20000);
      generatedMessages.push({
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
      });
    }

    await finalizeConversation({
      conversationId: conversation._id,
      userId,
      streamId,
      generatedMessages,
      assistantPreview: fullResponse,
    });
    finalized = true;

    // Tăng usageCount cho KB entries đã dùng (non-blocking)
    if (kbEntryIds.length > 0) {
      KnowledgeEntry.updateMany(
        { _id: { $in: kbEntryIds } },
        { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
      ).catch((err) => safeLog.error("ai.kb_usage_update_failed", err));
    }

    // Done event
    aiLogger.chatEnd(userId, conversation._id, {
      iterations: iteration,
      toolCalls: toolCallCount,
      durationMs: Date.now() - chatStartTime,
      kbHits: kbEntryIds.length,
    });
    if (!abortController.signal.aborted) {
      res.write(`data: ${JSON.stringify({ type: "done", conversationId: conversation._id })}\n\n`);
      res.end();
    }
  } catch (err) {
    aiLogger.chatError(userId, err, "chatStream");
    if (!abortController.signal.aborted && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: "error", message: "Có lỗi xảy ra, vui lòng thử lại" })}\n\n`);
      res.end();
    }
  } finally {
    if (!finalized) {
      if (fullResponse && !generatedMessages.some((item) => item.content === fullResponse)) {
        generatedMessages.push({
          role: "assistant",
          content: fullResponse.slice(0, 20000),
          timestamp: new Date(),
        });
      }
      try {
        await finalizeConversation({
          conversationId: conversation._id,
          userId,
          streamId,
          generatedMessages,
          assistantPreview: fullResponse,
        });
      } catch (error) {
        aiLogger.chatError(userId, error, "chatFinalize");
      }
    }
  }
};

// GET /api/ai/conversations — Danh sách tất cả conversations của user
export const getConversations = async (req, res) => {
  try {
    const conversations = await ChatConversation.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(30)
      .select("_id title updatedAt lastMessageAt lastMessagePreview messageCount")
      .lean();

    const list = conversations.map((c) => ({
      _id: c._id,
      title: c.title || "Cuộc trò chuyện",
      updatedAt: c.updatedAt,
      preview: c.lastMessagePreview || "",
      messageCount: c.messageCount || 0,
    }));

    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ai/conversations/:id — Load 1 conversation cụ thể
export const getConversationById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã cuộc trò chuyện không hợp lệ" });
    }
    const conversation = await ChatConversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        title: conversation.title || "Cuộc trò chuyện",
        messages: conversation.messages,
        context: conversation.context,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Không thể tải cuộc trò chuyện" });
  }
};

// DELETE /api/ai/conversations/:id — Xóa 1 conversation cụ thể
export const deleteConversation = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Mã cuộc trò chuyện không hợp lệ" });
    }
    const result = await ChatConversation.deleteOne({
      _id: req.params.id,
      userId: req.user.id,
      $or: [{ activeStreamId: null }, { activeStreamId: { $exists: false } }],
    });

    if (result.deletedCount === 0) {
      const exists = await ChatConversation.exists({
        _id: req.params.id,
        userId: req.user.id,
      });
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Hãy dừng phản hồi AI trước khi xóa cuộc trò chuyện",
        });
      }
      return res.status(404).json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    res.json({ success: true, message: "Đã xóa cuộc trò chuyện" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Không thể xóa cuộc trò chuyện" });
  }
};

// POST /api/ai/conversations/:id/fork — branch trước một user message
export const forkConversation = async (req, res) => {
  try {
    const { messageId } = req.body || {};
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(messageId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã conversation hoặc message không hợp lệ",
      });
    }

    const source = await ChatConversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!source) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cuộc trò chuyện",
      });
    }

    const branchIndex = source.messages.findIndex(
      (message) => message._id.toString() === messageId,
    );
    if (branchIndex < 0 || source.messages[branchIndex].role !== "user") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể tạo nhánh từ tin nhắn của người dùng",
      });
    }

    const copiedMessages = source.messages
      .slice(0, branchIndex)
      .slice(-(MAX_STORED_CHAT_MESSAGES - 1))
      .map((message) => {
        const copy = message.toObject();
        delete copy._id;
        return copy;
      });
    const lastMeaningful = [...copiedMessages]
      .reverse()
      .find(
        (message) =>
          ["user", "assistant"].includes(message.role) && message.content,
      );
    const branch = await ChatConversation.create({
      userId: req.user.id,
      title: `${source.title || "Cuộc trò chuyện"} (nhánh)`.slice(0, 80),
      messages: copiedMessages,
      messageCount: copiedMessages.filter((message) =>
        ["user", "assistant"].includes(message.role),
      ).length,
      lastMessagePreview: String(lastMeaningful?.content || "").slice(0, 120),
      lastMessageAt: lastMeaningful?.timestamp || null,
      context: source.context?.toObject?.() || source.context || {},
      forkedFromConversationId: source._id,
      forkedFromMessageId: messageId,
      expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS),
    });

    return res.status(201).json({
      success: true,
      data: {
        conversationId: branch._id,
        title: branch.title,
        messages: branch.messages,
        context: branch.context,
      },
    });
  } catch (error) {
    aiLogger.chatError(req.user.id, error, "forkConversation");
    return res.status(500).json({
      success: false,
      message: "Không thể tạo nhánh cuộc trò chuyện",
    });
  }
};
// GET /api/ai/history — Lấy conversation gần nhất (backward compat)
export const getHistory = async (req, res) => {
  try {
    const conversation = await ChatConversation.findOne({ userId: req.user.id }).sort({ updatedAt: -1 });

    if (!conversation) {
      return res.json({ success: true, data: null });
    }

    res.json({
      success: true,
      data: {
        conversationId: conversation._id,
        title: conversation.title || "",
        messages: conversation.messages,
        context: conversation.context,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/ai/history — Xóa tất cả conversations
export const clearHistory = async (req, res) => {
  try {
    const active = await ChatConversation.exists({
      userId: req.user.id,
      activeStreamId: { $ne: null },
    });
    if (active) {
      return res.status(409).json({
        success: false,
        message: "Hãy dừng phản hồi AI trước khi xóa lịch sử",
      });
    }
    await ChatConversation.deleteMany({ userId: req.user.id });
    res.json({ success: true, message: "Đã xóa lịch sử chat" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/ai/conversations/:id/feedback — Gửi feedback 👍/👎 cho message
export const submitFeedback = async (req, res) => {
  try {
    const { messageId, feedback } = req.body;

    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(messageId) ||
      !["up", "down", null].includes(feedback)
    ) {
      return res.status(400).json({ success: false, message: "Thiếu messageId hoặc feedback không hợp lệ" });
    }

    const result = await ChatConversation.updateOne({
      _id: req.params.id,
      userId: req.user.id,
      messages: {
        $elemMatch: { _id: messageId, role: "assistant" },
      },
    }, {
      $set: { "messages.$[message].feedback": feedback },
    }, {
      arrayFilters: [{ "message._id": messageId, "message.role": "assistant" }],
      runValidators: true,
    });

    if (result.matchedCount === 0) {
      return res.status(400).json({ success: false, message: "Message không hợp lệ" });
    }

    res.json({ success: true, message: "Đã lưu feedback" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Không thể lưu feedback" });
  }
};
