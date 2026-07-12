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

const MAX_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 20;

// POST /api/ai/chat — SSE streaming chat với Agent Loop
export const chatStream = async (req, res) => {
  const { message, conversationId, context } = req.body;
  const userId = req.user.id;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: "Tin nhắn không được để trống" });
  }

  // Load user info sớm để check ban và dùng cho system prompt
  let user;
  try {
    user = await User.findById(userId).select("name isAiChatBanned").lean();
    if (user?.isAiChatBanned) {
      aiLogger.userLocked(userId, "permanent");
      return res.status(403).json({
        success: false,
        message: "🚫 Tài khoản của bạn đã bị cấm sử dụng Chat AI vĩnh viễn do vi phạm quy tắc cộng đồng nhiều lần.",
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: "Lỗi hệ thống khi kiểm tra người dùng" });
  }

  // Kiểm tra user bị khóa tạm thời (1h)
  const lockStatus = isUserLocked(userId);
  if (lockStatus.blocked) {
    aiLogger.userLocked(userId, lockStatus.remainingMinutes);
    return res.status(403).json({
      success: false,
      message: `🚫 Chat AI đang bị khóa tạm thời. Còn ${lockStatus.remainingMinutes} phút.`,
    });
  }

  // Kiểm tra nội dung tin nhắn hiện tại
  const moderation = await moderateContent(userId, message);
  if (!moderation.safe) {
    aiLogger.moderationTrigger(userId, moderation.action || "blocked");
    return res.status(400).json({ success: false, message: moderation.message });
  }

  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let isAborted = false;
  req.on("close", () => {
    isAborted = true;
  });

  try {
    const chatStartTime = Date.now();
    let toolCallCount = 0;

    // Load hoặc tạo conversation
    let conversation;
    if (conversationId) {
      conversation = await ChatConversation.findOne({ _id: conversationId, userId });
    }
    if (!conversation) {
      conversation = new ChatConversation({ userId, context: context || {} });
    }

    // Update context
    if (context) {
      const existing = conversation.context?.toObject?.() || conversation.context || {};
      conversation.context = { ...existing, ...context };
    }

    // Auto-set title từ tin nhắn đầu tiên của user
    if (!conversation.title && message) {
      conversation.title = message.trim().slice(0, 60);
    }

    // Thêm user message (kèm ảnh nếu có)
    conversation.messages.push({
      role: "user",
      content: message.trim(),
      image: context?.image || null,
      timestamp: new Date(),
    });

    // Build system prompt với context
    let systemPrompt = buildSystemPrompt({
      userName: user?.name,
      currentPage: conversation.context?.lastPage,
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
      console.error("KB search error (non-blocking):", err.message);
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
    let fullResponse = "";
    let lastToolResultText = ""; // Backup: dùng khi Gemini im luôn sau tool call

    // === AGENT LOOP (Pattern từ Dify fc_agent_runner.py) ===
    let iteration = 0;
    let needsToolCall = true;
    aiLogger.chatStart(userId, conversation._id);

    while (needsToolCall && iteration < MAX_ITERATIONS && !isAborted) {
      needsToolCall = false;
      iteration++;

      for await (const chunk of llmStream(llmMessages, tools)) {
        if (isAborted) break;
        switch (chunk.type) {
          case "text":
            // Lọc error text từ Gemini (trả 200 nhưng body chứa lỗi kỹ thuật)
            if (chunk.content.includes("thought_signature") || 
                chunk.content.includes("Lỗi AI") ||
                chunk.content.startsWith("⚠️ Lỗi")) {
              console.error("[AI] Filtered error text from LLM:", chunk.content.substring(0, 100));
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
              const toolDuration = Date.now() - toolStartTime;
              toolCallCount++;
              aiLogger.toolCall(userId, call.name, toolDuration, !toolResult.error);

              // Gửi tool_result cho FE
              res.write(`data: ${JSON.stringify({ type: "tool_result", tool: call.name, text: toolResult.text })}\n\n`);

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
              llmMessages.push({ role: "tool", content: toolResult.text, name: call.name });
              lastToolResultText = toolResult.text; // Lưu backup

              // Lưu tool call vào conversation
              conversation.messages.push({
                role: "assistant",
                content: "",
                toolCalls: [call],
                timestamp: new Date(),
              });
              conversation.messages.push({
                role: "tool",
                content: toolResult.text,
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

    if (isAborted) {
      res.end();
      return;
    }

    // Lưu final response
    // Fallback: nếu Gemini không trả text sau tool call → dùng tool result text
    if (!fullResponse && toolCallCount > 0 && lastToolResultText) {
      console.error("[AI] Gemini silent after tool call — using tool result as fallback");
      fullResponse = lastToolResultText;
      res.write(`data: ${JSON.stringify({ type: "text", content: fullResponse })}\n\n`);
    }
    if (fullResponse) {
      conversation.messages.push({
        role: "assistant",
        content: fullResponse,
        timestamp: new Date(),
      });
    }

    // Reset TTL 30 ngày
    conversation.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await conversation.save();

    // Tăng usageCount cho KB entries đã dùng (non-blocking)
    if (kbEntryIds.length > 0) {
      KnowledgeEntry.updateMany(
        { _id: { $in: kbEntryIds } },
        { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
      ).catch((err) => console.error("KB usage update error:", err.message));
    }

    // Done event
    aiLogger.chatEnd(userId, conversation._id, {
      iterations: iteration,
      toolCalls: toolCallCount,
      durationMs: Date.now() - chatStartTime,
      kbHits: kbEntryIds.length,
    });
    res.write(`data: ${JSON.stringify({ type: "done", conversationId: conversation._id })}\n\n`);
    res.end();
  } catch (err) {
    aiLogger.chatError(userId, err, "chatStream");
    res.write(`data: ${JSON.stringify({ type: "error", message: "Có lỗi xảy ra, vui lòng thử lại" })}\n\n`);
    res.end();
  }
};

// GET /api/ai/conversations — Danh sách tất cả conversations của user
export const getConversations = async (req, res) => {
  try {
    const conversations = await ChatConversation.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(30)
      .select("_id title updatedAt messages")
      .lean();

    const list = conversations.map((c) => ({
      _id: c._id,
      title: c.title || "Cuộc trò chuyện",
      updatedAt: c.updatedAt,
      preview: c.messages
        .filter((m) => m.role === "user")
        .slice(-1)[0]?.content?.slice(0, 80) || "",
      messageCount: c.messages.filter((m) => m.role === "user" || m.role === "assistant").length,
    }));

    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ai/conversations/:id — Load 1 conversation cụ thể
export const getConversationById = async (req, res) => {
  try {
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
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/ai/conversations/:id — Xóa 1 conversation cụ thể
export const deleteConversation = async (req, res) => {
  try {
    const result = await ChatConversation.deleteOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    res.json({ success: true, message: "Đã xóa cuộc trò chuyện" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    if (!messageId || !["up", "down", null].includes(feedback)) {
      return res.status(400).json({ success: false, message: "Thiếu messageId hoặc feedback không hợp lệ" });
    }

    const conversation = await ChatConversation.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    const message = conversation.messages.id(messageId);
    if (!message || message.role !== "assistant") {
      return res.status(400).json({ success: false, message: "Message không hợp lệ" });
    }

    message.feedback = feedback;
    await conversation.save();

    res.json({ success: true, message: "Đã lưu feedback" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
