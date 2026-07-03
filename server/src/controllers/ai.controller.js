import ChatConversation from "../models/ChatConversation.js";
import User from "../models/User.js";
import { llmStream } from "../services/ai/providers/index.js";
import { executeTool } from "../services/ai/tools/toolEngine.js";
import { getToolSchemas } from "../services/ai/tools/toolRegistry.js";
import { buildSystemPrompt } from "../services/ai/systemPrompt.js";
import { isUserLocked, moderateContent } from "../services/ai/contentModeration.js";

const MAX_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 20;

// POST /api/ai/chat — SSE streaming chat với Agent Loop
export const chatStream = async (req, res) => {
  const { message, conversationId, context } = req.body;
  const userId = req.user.id;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: "Tin nhắn không được để trống" });
  }

  // Kiểm tra user bị khóa
  const lockStatus = isUserLocked(userId);
  if (lockStatus.blocked) {
    return res.status(403).json({
      success: false,
      message: `🚫 Chat AI đang bị khóa. Còn ${lockStatus.remainingMinutes} phút.`,
    });
  }

  // Kiểm tra nội dung
  const moderation = moderateContent(userId, message);
  if (!moderation.safe) {
    return res.status(400).json({ success: false, message: moderation.message });
  }

  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    // Load user info cho system prompt
    const user = await User.findById(userId).select("name").lean();

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

    // Thêm user message
    conversation.messages.push({
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    });

    // Build system prompt với context
    const systemPrompt = buildSystemPrompt({
      userName: user?.name,
      currentPage: conversation.context?.lastPage,
      userMetrics: conversation.context?.userMetrics,
    });

    // Chuẩn bị messages cho LLM
    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...conversation.messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolName && { name: m.toolName }),
      })),
    ];

    const tools = getToolSchemas();
    let fullResponse = "";

    // === AGENT LOOP (Pattern từ Dify fc_agent_runner.py) ===
    let iteration = 0;
    let needsToolCall = true;

    while (needsToolCall && iteration < MAX_ITERATIONS) {
      needsToolCall = false;
      iteration++;

      for await (const chunk of llmStream(llmMessages, tools)) {
        switch (chunk.type) {
          case "text":
            fullResponse += chunk.content;
            res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
            break;

          case "tool_call":
            needsToolCall = true;

            for (const call of chunk.toolCalls) {
              // Gửi tool_start cho FE loading
              res.write(`data: ${JSON.stringify({ type: "tool_start", tool: call.name })}\n\n`);

              // Thực thi tool
              const toolResult = await executeTool(call.name, call.args, { userId });

              // Gửi tool_result cho FE
              res.write(`data: ${JSON.stringify({ type: "tool_result", tool: call.name, text: toolResult.text })}\n\n`);

              // Nếu có UI card → gửi cho FE render
              if (toolResult.uiCard) {
                res.write(`data: ${JSON.stringify({ type: "ui_card", ...toolResult.uiCard })}\n\n`);
              }

              // Thêm assistant tool_call + tool result vào messages cho LLM iteration tiếp
              llmMessages.push({ role: "assistant", content: "", tool_calls: [call] });
              llmMessages.push({ role: "tool", content: toolResult.text, name: call.name });

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

    // Done event
    res.write(`data: ${JSON.stringify({ type: "done", conversationId: conversation._id })}\n\n`);
    res.end();
  } catch (err) {
    console.error("AI Chat Error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Có lỗi xảy ra, vui lòng thử lại" })}\n\n`);
    res.end();
  }
};

// GET /api/ai/history — Lấy conversation hiện tại
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
        messages: conversation.messages,
        context: conversation.context,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/ai/history — Xóa conversation
export const clearHistory = async (req, res) => {
  try {
    await ChatConversation.deleteMany({ userId: req.user.id });
    res.json({ success: true, message: "Đã xóa lịch sử chat" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
