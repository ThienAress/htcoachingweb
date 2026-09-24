import crypto from "crypto";
import mongoose from "mongoose";
import ChatConversation from "../models/ChatConversation.js";
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import User from "../models/User.js";
import { llmStream } from "../services/ai/providers/index.js";
import {
  executeTool,
  isSuccessfulToolResult,
} from "../services/ai/tools/toolEngine.js";
import { executeToolBatch } from "../services/ai/tools/toolBatchExecutor.js";
import { getToolSchemas } from "../services/ai/tools/toolRegistry.js";
import {
  normalizePublicToolText,
  resolveToolResultStatus,
  serializeToolResultForModel,
} from "../services/ai/tools/toolResultBoundary.js";
import {
  buildKnowledgeReferenceBlock,
  buildSystemPrompt,
} from "../services/ai/systemPrompt.js";
import {
  isUserLocked,
  moderateContent,
  moderateGuestContent,
} from "../services/ai/contentModeration.js";
import { searchKnowledgeBase } from "../services/ai/embedding.service.js";
import { aiLogger } from "../services/ai/aiLogger.js";
import { serializeRequestQuota } from "../services/serviceAccessPolicy.service.js";
import {
  canonicalizePageContext,
  resolvePageContext,
  shouldExpandPageContent,
} from "../services/ai/contextEnricher.js";
import {
  deriveConversationMemory,
  updateConversationMemory,
} from "../services/ai/conversationMemory.js";
import { buildCanonicalMealToolRequest } from "../services/ai/mealRequestConstraints.js";
import {
  buildRequestRoutingBlock,
  buildStandaloneRetrievalQuery,
  getAllowedToolNamesForRoute,
  routeAiRequest,
} from "../services/ai/requestRouter.js";
import { validateWorkoutEquipmentOutput } from "../services/ai/equipmentConstraint.js";
import { sanitizeAssistantOutput } from "../services/ai/assistantOutput.js";
import {
  AI_RUNTIME_POLICY,
  boundAiToolCalls,
} from "../services/ai/runtimePolicy.js";
import {
  createAiToolConfirmation,
  serializeAiToolConfirmationCard,
} from "../services/ai/toolConfirmation.service.js";
import {
  buildChatSummary,
  MAX_RECENT_REQUEST_IDS,
  MAX_STORED_CHAT_MESSAGES,
  parseChatRequest,
} from "../utils/aiChat.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";
import { getAiMemoryContext } from "../services/aiMemory.service.js";

const MAX_ITERATIONS = AI_RUNTIME_POLICY.maxAgentIterations;
const MAX_HISTORY_MESSAGES = AI_RUNTIME_POLICY.maxHistoryMessages;
const STREAM_STALE_MS = 10 * 60 * 1000;
const CONVERSATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GUEST_CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;
const CHAT_DEADLINE_MS = AI_RUNTIME_POLICY.chatDeadlineMs;
const TOOL_TIMEOUT_MS = AI_RUNTIME_POLICY.toolTimeoutMs;
const MALFORMED_OUTPUT_CODES = new Set([
  "AI_MALFORMED_OUTPUT",
  "AI_EMPTY_OUTPUT",
]);

const httpError = (status, message) => Object.assign(new Error(message), { status });

const refundAiQuota = async (req, stage) => {
  if (!req.refundServiceUsage) return serializeRequestQuota(req, "ai_chat");
  try {
    return await req.refundServiceUsage();
  } catch (error) {
    safeLog.error("ai.quota_refund_failed", error, { stage });
    return serializeRequestQuota(req, "ai_chat");
  }
};

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
  ownerFilter,
  ownerDocument,
  conversationTtlMs,
  conversationId,
  requestId,
  message,
  image,
  context,
  streamId,
}) {
  const duplicate = await ChatConversation.findOne({
    ...ownerFilter,
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
        ...ownerDocument,
        title: message.slice(0, 60),
        messages: [userMessage],
        messageCount: 1,
        ...summary,
        recentRequestIds: [requestId],
        activeStreamId: streamId,
        activeStreamStartedAt: timestamp,
        context,
        expiresAt: new Date(Date.now() + conversationTtlMs),
      });
      return { conversation, duplicate: false, previousState: null };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const winner = await ChatConversation.findOne({
        ...ownerFilter,
        recentRequestIds: requestId,
      });
      if (winner) return { conversation: winner, duplicate: true };
      throw error;
    }
  }

  const previousState = await ChatConversation.findOne({
    _id: conversationId,
    ...ownerFilter,
  })
    .select("title messages messageCount lastMessagePreview lastMessageAt context workingMemory expiresAt +recentRequestIds")
    .lean();
  const staleBefore = new Date(Date.now() - STREAM_STALE_MS);
  const conversation = await ChatConversation.findOneAndUpdate(
    {
      _id: conversationId,
      ...ownerFilter,
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
        expiresAt: new Date(Date.now() + conversationTtlMs),
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

  if (conversation) return { conversation, duplicate: false, previousState };

  const existing = await ChatConversation.findOne({
    _id: conversationId,
    ...ownerFilter,
  })
    .select("_id activeStreamId recentRequestIds")
    .lean();
  if (!existing) throw httpError(404, "Không tìm thấy cuộc trò chuyện");
  if (existing.recentRequestIds?.includes(requestId)) {
    return { conversation: existing, duplicate: true };
  }
  throw httpError(409, "Cuộc trò chuyện đang xử lý một tin nhắn khác");
}

async function rollbackFailedConversationTurn({
  conversationId,
  ownerFilter,
  streamId,
  previousState,
  conversationTtlMs,
}) {
  const state = previousState || {};
  const result = await ChatConversation.updateOne(
    { _id: conversationId, ...ownerFilter, activeStreamId: streamId },
    {
      $set: {
        title: state.title || "",
        messages: Array.isArray(state.messages) ? state.messages : [],
        messageCount: Number.isFinite(state.messageCount) ? state.messageCount : 0,
        lastMessagePreview: state.lastMessagePreview || "",
        lastMessageAt: state.lastMessageAt || null,
        context: state.context || {},
        workingMemory: state.workingMemory || {},
        recentRequestIds: Array.isArray(state.recentRequestIds)
          ? state.recentRequestIds
          : [],
        expiresAt: state.expiresAt || new Date(Date.now() + conversationTtlMs),
        activeStreamId: null,
        activeStreamStartedAt: null,
      },
    },
    { runValidators: true },
  );
  return result.modifiedCount === 1;
}

async function finalizeConversation({
  conversationId,
  ownerFilter,
  conversationTtlMs,
  streamId,
  generatedMessages,
  assistantPreview,
  workingMemory,
}) {
  const update = {
    $set: {
      activeStreamId: null,
      activeStreamStartedAt: null,
      expiresAt: new Date(Date.now() + conversationTtlMs),
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
  if (workingMemory && Object.keys(workingMemory).length > 0) {
    update.$set.workingMemory = workingMemory;
  }

  return ChatConversation.updateOne(
    { _id: conversationId, ...ownerFilter, activeStreamId: streamId },
    update,
    { runValidators: true },
  );
}

// POST /api/ai/chat — SSE streaming chat với Agent Loop
export const chatStream = async (req, res) => {
  const userId = req.user?.id || null;
  const guestKey = req.aiActor?.guestKey || null;
  const ownerFilter = userId ? { userId } : { guestKey };
  const ownerDocument = userId ? { userId } : { guestKey };
  const conversationTtlMs = userId
    ? CONVERSATION_TTL_MS
    : GUEST_CONVERSATION_TTL_MS;
  const actorId = userId || guestKey;

  if (!actorId) {
    await refundAiQuota(req, "actor_missing");
    return res.status(500).json({
      success: false,
      message: "Không thể xác định phiên trò chuyện",
    });
  }
  const parsed = req.aiChatRequest || parseChatRequest(req.body);

  if (parsed.error) {
    await refundAiQuota(req, "request_invalid");
    return res.status(400).json({ success: false, message: parsed.error });
  }
  const { message, conversationId, context, image, requestId } = parsed.value;
  if (!userId && image) {
    await refundAiQuota(req, "guest_image_rejected");
    return res.status(403).json({
      success: false,
      code: "AI_GUEST_IMAGE_UNAVAILABLE",
      message: "Đăng nhập để gửi hình ảnh cho HT Assistant.",
    });
  }
  const streamId = crypto.randomUUID();

  let user;
  let conversation;
  let previousConversationState = null;
  try {
    if (userId) {
      user = await User.findById(userId).select("name isAiChatBanned").lean();
      if (user?.isAiChatBanned) {
        aiLogger.userLocked(actorId, "permanent");
        await refundAiQuota(req, "user_banned");
        return res.status(403).json({
          success: false,
          message: "🚫 Tài khoản của bạn đã bị cấm sử dụng Chat AI vĩnh viễn do vi phạm quy tắc cộng đồng nhiều lần.",
        });
      }
      const lockStatus = await isUserLocked(userId);
      if (lockStatus.blocked) {
        aiLogger.userLocked(actorId, lockStatus.remainingMinutes);
        await refundAiQuota(req, "user_locked");
        return res.status(403).json({
          success: false,
          message: `🚫 Chat AI đang bị khóa tạm thời. Còn ${lockStatus.remainingMinutes} phút.`,
        });
      }
    }

    const moderation = userId
      ? await moderateContent(userId, message)
      : moderateGuestContent(message);
    if (!moderation.safe) {
      aiLogger.moderationTrigger(actorId, moderation.action || "blocked");
      await refundAiQuota(req, "moderation_rejected");
      return res.status(400).json({ success: false, message: moderation.message });
    }

    const canonicalContext = canonicalizePageContext(context);

    const acquired = await acquireConversation({
      ownerFilter,
      ownerDocument,
      conversationTtlMs,
      conversationId,
      requestId,
      message,
      image,
      context: canonicalContext,
      streamId,
    });
    conversation = acquired.conversation;
    previousConversationState = acquired.previousState || null;

    if (acquired.duplicate) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      const quota = serializeRequestQuota(req, "ai_chat");
      if (quota) {
        res.write(`data: ${JSON.stringify({ type: "quota", quota })}\n\n`);
      }
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
    aiLogger.chatError(actorId, error, "chatPreflight");
    const quota = await refundAiQuota(req, "chat_preflight");
    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Lỗi hệ thống khi chuẩn bị cuộc trò chuyện",
      ...(quota ? { meta: { quota } } : {}),
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const quota = serializeRequestQuota(req, "ai_chat");
  if (quota) {
    res.write(`data: ${JSON.stringify({ type: "quota", quota })}\n\n`);
  }

  const abortController = new AbortController();
  let clientDisconnected = false;
  let deadlineExceeded = false;
  const deadlineTimer = setTimeout(() => {
    deadlineExceeded = true;
    abortController.abort(new Error("AI response deadline exceeded"));
  }, CHAT_DEADLINE_MS);
  res.on("close", () => {
    if (!res.writableEnded && !abortController.signal.aborted) {
      clientDisconnected = true;
      incrementMetric("ai.aborts");
      abortController.abort(new Error("Client disconnected"));
    }
  });

  const generatedMessages = [];
  let conversationMemory = deriveConversationMemory(
    conversation.messages,
    conversation.workingMemory,
  );
  let finalized = false;
  let fullResponse = "";
  let failedProviderTurn = false;
  try {
    const chatStartTime = Date.now();
    let toolCallCount = 0;
    res.write(
      `data: ${JSON.stringify({
        type: "conversation",
        conversationId: conversation._id,
      })}\n\n`,
    );

    const resolvedPageContext = await resolvePageContext(
      conversation.context,
      { expandContent: shouldExpandPageContent(message) },
    );
    const retrievalQuery = buildStandaloneRetrievalQuery(
      message,
      conversation.messages.slice(0, -1),
    );
    const routingDecision = routeAiRequest(message, {
      contextualQuery: retrievalQuery,
    });

    let personalMemory = [];
    if (userId) {
      try {
        personalMemory = await getAiMemoryContext(userId);
      } catch (error) {
        safeLog.error("ai.memory_context_non_blocking_failed", error);
      }
    }

    // Build system prompt với context
    let systemPrompt = buildSystemPrompt({
      userName: user?.name,
      currentPage: conversation.context?.page || conversation.context?.lastPage,
      pageType: resolvedPageContext.pageType,
      pageInfo: resolvedPageContext.pageInfo,
      pageData: resolvedPageContext.pageData,
      userMetrics: conversation.context?.userMetrics,
      conversationMemory,
      personalMemory,
    });
    systemPrompt += buildRequestRoutingBlock(routingDecision, {
      canUseWebSearch: Boolean(userId),
    });

    // === KNOWLEDGE BASE SEARCH ===
    // Tìm kiến thức đã review trước khi gọi LLM. KB vẫn là untrusted data.
    let kbEntryIds = [];
    if (routingDecision.knowledgeBaseEligible) {
      try {
        const kbResults = await searchKnowledgeBase(retrievalQuery, {
          limit: 3,
          threshold: 0.75,
        });
        if (kbResults.length > 0) {
          kbEntryIds = kbResults.map((r) => r._id);
          aiLogger.kbMatch(actorId, kbResults.length, kbResults[0]?.similarity);
          systemPrompt += buildKnowledgeReferenceBlock(kbResults);
        }
      } catch (err) {
        // KB search lỗi không ảnh hưởng chat flow chính; stable fitness vẫn answer-first.
        safeLog.error("ai.kb_search_non_blocking_failed", err);
      }
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
          mapped.content = serializeToolResultForModel({
            toolName: m.toolName,
            text: m.content || "",
            status: m.toolStatus || "success",
          });
          mapped.toolResultEnvelope = true;
        }
        return mapped;
      }),
    ];

    const availableTools = getToolSchemas({ isAuthenticated: Boolean(userId) });
    const allowedToolNames = new Set(getAllowedToolNamesForRoute(routingDecision));
    const tools = availableTools.filter((tool) =>
      allowedToolNames.has(tool.function.name),
    );
    let lastToolResultText = ""; // Backup: dùng khi Gemini im luôn sau tool call
    let finalAssistantCard = null;
    const canonicalMealRequest = buildCanonicalMealToolRequest(
      message,
      {},
      conversationMemory,
    );
    const isCanonicalMealRequest = canonicalMealRequest.isMealRequest ?? (
      Number.isFinite(canonicalMealRequest.args?.targetCalories) ||
      routingDecision.preferredTool === "suggest_meal"
    );
    const hasCompleteMealArgs = (args) =>
      Number.isFinite(args?.targetCalories) &&
      Number.isFinite(args?.proteinGrams) &&
      Number.isFinite(args?.carbGrams) &&
      Number.isFinite(args?.fatGrams) &&
      Number.isInteger(args?.mealsPerDay) &&
      args.mealsPerDay >= 1 &&
      args.mealsPerDay <= 6;

    // === AGENT LOOP (Pattern từ Dify fc_agent_runner.py) ===
    let iteration = 0;
    let needsToolCall = true;
    let protocolRetryCount = 0;
    let routeToolCalled = false;
    aiLogger.chatStart(actorId, conversation._id);

    if (routingDecision.webSearchRequired && userId) {
      const call = { id: `server-search_knowledge-${toolCallCount + 1}`, name: "search_knowledge", args: { query: retrievalQuery } };
      const startedAt = Date.now();
      res.write(`data: ${JSON.stringify({ type: "tool_start", tool: call.name })}\n\n`);
      const toolResult = await executeTool(call.name, call.args, {
        userId,
        signal: abortController.signal,
        timeoutMs: TOOL_TIMEOUT_MS,
        allowedToolNames: ["search_knowledge"],
      });
      const safeToolText = normalizePublicToolText(toolResult.text);
      toolCallCount += 1;
      aiLogger.toolCall(actorId, call.name, Date.now() - startedAt, isSuccessfulToolResult(toolResult));
      res.write(`data: ${JSON.stringify({ type: "tool_result", tool: call.name, text: safeToolText })}\n\n`);
      if (toolResult.uiCard) res.write(`data: ${JSON.stringify({ type: "ui_card", ...toolResult.uiCard })}\n\n`);
      generatedMessages.push(
        { role: "assistant", content: "", toolCalls: [call], timestamp: new Date() },
        { role: "tool", content: safeToolText, toolName: call.name, toolCallId: call.id, toolStatus: resolveToolResultStatus(toolResult), uiCard: toolResult.uiCard, timestamp: new Date() },
      );
      fullResponse = safeToolText;
      res.write(`data: ${JSON.stringify({ type: "text", content: fullResponse })}\n\n`);
      needsToolCall = false;
    } else if (isCanonicalMealRequest && hasCompleteMealArgs(canonicalMealRequest.args)) {
      const call = {
        id: `server-suggest_meal-${toolCallCount + 1}`,
        name: "suggest_meal",
        args: canonicalMealRequest.args,
      };
      res.write(`data: ${JSON.stringify({ type: "tool_start", tool: call.name })}\n\n`);
      const startedAt = Date.now();
      const toolResult = await executeTool("suggest_meal", call.args, {
        userId,
        signal: abortController.signal,
        timeoutMs: TOOL_TIMEOUT_MS,
        allowedToolNames: ["suggest_meal"],
        previousMealPlan: conversationMemory.lastMeal?.plan || null,
      });
      const durationMs = Date.now() - startedAt;
      const safeToolText = normalizePublicToolText(toolResult.text);
      const toolStatus = resolveToolResultStatus(toolResult);
      const toolSucceeded = isSuccessfulToolResult(toolResult);
      toolCallCount += 1;
      aiLogger.toolCall(actorId, call.name, durationMs, toolSucceeded);
      if (toolSucceeded) {
        conversationMemory = updateConversationMemory(
          conversationMemory,
          call.name,
          call.args,
          toolResult,
        );
      }
      res.write(`data: ${JSON.stringify({ type: "tool_result", tool: call.name, text: safeToolText })}\n\n`);
      if (toolResult.uiCard) {
        res.write(`data: ${JSON.stringify({ type: "ui_card", ...toolResult.uiCard })}\n\n`);
      }
      generatedMessages.push(
        {
          role: "assistant",
          content: "",
          toolCalls: [call],
          timestamp: new Date(),
        },
        {
          role: "tool",
          content: safeToolText,
          toolName: call.name,
          toolCallId: call.id,
          toolStatus,
          uiCard: toolResult.uiCard,
          timestamp: new Date(),
        },
      );
      fullResponse = safeToolText;
      res.write(`data: ${JSON.stringify({ type: "text", content: fullResponse })}\n\n`);
      needsToolCall = false;
    } else if (isCanonicalMealRequest) {
      const missingText =
        "Mình cần mục tiêu kcal, protein tối thiểu và số bữa để tạo thực đơn bằng dữ liệu thực phẩm đã kiểm duyệt.";
      finalAssistantCard = {
        cardType: "meal",
        data: {
          status: "missing_data",
          reason: "incomplete_constraints",
          meals: [],
          totals: null,
        },
      };
      res.write(`data: ${JSON.stringify({ type: "ui_card", ...finalAssistantCard })}\n\n`);
      fullResponse = missingText;
      res.write(`data: ${JSON.stringify({ type: "text", content: fullResponse })}\n\n`);
      needsToolCall = false;
    }

    while (
      needsToolCall &&
      iteration < MAX_ITERATIONS &&
      !abortController.signal.aborted
    ) {
      needsToolCall = false;
      iteration++;
      let iterationText = "";
      let iterationCalledTool = false;

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
            iterationText += chunk.content;
            break;

          case "tool_call":
            {
            const boundedToolCalls = boundAiToolCalls(
              chunk.toolCalls,
              toolCallCount,
            );
            if (boundedToolCalls.length === 0) {
              needsToolCall = false;
              iterationText +=
                "Mình đã đạt giới hạn xử lý công cụ cho yêu cầu này. Bạn hãy thử lại với một yêu cầu ngắn gọn hơn.";
              safeLog.warn(
                "ai.tool_call_budget_exhausted",
                "Tool call budget exhausted",
              );
              break;
            }
            if (boundedToolCalls.length < chunk.toolCalls.length) {
              safeLog.warn(
                "ai.tool_calls_truncated",
                "Provider tool calls exceeded the bounded runtime policy",
                {
                  received: chunk.toolCalls.length,
                  accepted: boundedToolCalls.length,
                },
              );
            }
            if (boundedToolCalls.some((call) =>
              call.name === routingDecision.preferredTool ||
              (routingDecision.webSearchRequired && call.name === "search_knowledge"),
            )) {
              routeToolCalled = true;
            }
            needsToolCall = true;
            iterationCalledTool = true;
            
            // XÓA BỎ VĂN BẢN RÁC: Khi LLM gọi tool, nó sẽ bắt đầu lại từ đầu ở Turn sau,
            // nên mọi văn bản đã sinh ra ở Turn hiện tại chỉ là nháp và phải bị vứt bỏ.
            fullResponse = "";

            // Gemini yêu cầu parallel function calls nằm trong cùng model turn,
            // sau đó mới tới các functionResponse trong một user turn.
            llmMessages.push({
              role: "assistant",
              content: "",
              tool_calls: boundedToolCalls,
              _thoughtParts: chunk.thoughtParts || [],
            });
            generatedMessages.push({
              role: "assistant",
              content: "",
              toolCalls: boundedToolCalls,
              timestamp: new Date(),
            });

            const toolExecutions = await executeToolBatch(
              boundedToolCalls,
              {
                userId,
                signal: abortController.signal,
                timeoutMs: TOOL_TIMEOUT_MS,
                allowedToolNames: [...allowedToolNames],
                previousMealPlan: conversationMemory.lastMeal?.plan || null,
              },
              {
                executor: executeTool,
                onStart: (call) => {
                  res.write(
                    `data: ${JSON.stringify({ type: "tool_start", tool: call.name })}\n\n`,
                  );
                },
              },
            );

            for (const execution of toolExecutions) {
              const { call, durationMs: toolDuration } =
                execution;
              let toolResult = execution.result;
              if (abortController.signal.aborted) break;
              if (toolResult.needsConfirmation) {
                const challenge = await createAiToolConfirmation({
                  userId,
                  toolName: call.name,
                  parameters: call.args,
                });
                toolResult = {
                  ...toolResult,
                  uiCard: serializeAiToolConfirmationCard(challenge),
                };
              }
              const safeToolText = normalizePublicToolText(toolResult.text);
              const modelToolContent = serializeToolResultForModel({
                toolName: call.name,
                text: safeToolText,
                status: resolveToolResultStatus(toolResult),
              });
              const toolStatus = resolveToolResultStatus(toolResult);
              toolCallCount++;
              const toolSucceeded = isSuccessfulToolResult(toolResult);
              const exerciseCatalogMiss =
                call.name === "search_exercises" &&
                toolResult.meta?.evidenceAvailable === false &&
                routingDecision.risk === "low";
              aiLogger.toolCall(actorId, call.name, toolDuration, toolSucceeded);
              if (toolSucceeded) {
                conversationMemory = updateConversationMemory(
                  conversationMemory,
                  call.name,
                  call.args,
                  toolResult,
                );
              }

              // Gửi tool_result cho FE
              res.write(`data: ${JSON.stringify({ type: "tool_result", tool: call.name, text: safeToolText })}\n\n`);

              // Nếu có UI card → gửi cho FE render
              if (toolResult.uiCard) {
                res.write(`data: ${JSON.stringify({ type: "ui_card", ...toolResult.uiCard })}\n\n`);
              }

              // Thêm tool result vào messages cho LLM iteration tiếp.
              llmMessages.push({
                role: "tool",
                content: modelToolContent,
                name: call.name,
                id: call.id,
                toolResultEnvelope: true,
              });
              if (exerciseCatalogMiss) {
                llmMessages.push({
                  role: "user",
                  content:
                    "Thư viện hiện chưa có kết quả phù hợp. Đây là câu hỏi fitness ổn định rủi ro thấp: hãy trả lời bằng kiến thức nền hữu ích, nêu rõ đây là hướng dẫn chung và không bịa tên bài trong thư viện.",
                });
              }
              lastToolResultText = safeToolText; // Lưu backup

              // Lưu tool call vào conversation
              generatedMessages.push({
                role: "tool",
                content: safeToolText,
                toolName: call.name,
                toolCallId: call.id,
                toolStatus,
                uiCard:
                  toolResult.uiCard?.cardType === "confirmation"
                    ? null
                    : toolResult.uiCard,
                timestamp: new Date(),
              });
            }
            }
            break;

          case "ui_card":
            res.write(`data: ${JSON.stringify({ type: "ui_card", cardType: chunk.cardType, data: chunk.data })}\n\n`);
            break;
        }
      }

      if (abortController.signal.aborted) break;
      if (!iterationCalledTool && iterationText) {
        const routeGuardedText = routingDecision.webSearchRequired && !routeToolCalled
          ? userId
            ? "Mình chưa thể xác minh thông tin này bằng nguồn đáng tin cậy lúc này, nên chưa muốn khẳng định từ trí nhớ. Bạn thử lại sau nhé."
            : "Mình chưa thể xác minh thông tin mới nhất này trong chế độ khách. Bạn đăng nhập để dùng tra cứu có nguồn nhé."
          : routingDecision.reasonCodes.includes("workout_creation") &&
              !validateWorkoutEquipmentOutput(message, iterationText).valid
            ? "Mình chưa thể tạo giáo án mà vẫn bảo đảm đúng giới hạn thiết bị bạn nêu. Bạn hãy xác nhận lại thiết bị hoặc cho phép biến thể thay thế an toàn nhé."
            : iterationText;
        const guarded = sanitizeAssistantOutput(routeGuardedText);
        if (guarded.protocolLeak && protocolRetryCount < 1) {
          protocolRetryCount++;
          llmMessages.push({ role: "assistant", content: iterationText });
          llmMessages.push({
            role: "user",
            content:
              "Không hiển thị JSON action, tên tool hoặc suy nghĩ nội bộ. Hãy gọi function phù hợp trực tiếp; nếu không cần function thì chỉ trả lời cuối cùng.",
          });
          needsToolCall = true;
          continue;
        }
        if (guarded.protocolLeak) {
          throw Object.assign(
            new Error("AI provider returned malformed output"),
            { code: "AI_MALFORMED_OUTPUT" },
          );
        }

        fullResponse =
          guarded.content ||
          "Mình chưa thể hoàn tất yêu cầu này. Bạn thử diễn đạt lại ngắn gọn hơn nhé.";
        res.write(
          `data: ${JSON.stringify({ type: "text", content: fullResponse })}\n\n`,
        );
      }
      if (!iterationCalledTool && !iterationText && !fullResponse && !lastToolResultText) {
        throw Object.assign(
          new Error("AI provider returned an empty output"),
          { code: "AI_EMPTY_OUTPUT" },
        );
      }
    }

    if (deadlineExceeded) {
      throw new Error("AI response deadline exceeded");
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
        uiCard: finalAssistantCard,
        timestamp: new Date(),
      });
    }

    await finalizeConversation({
      conversationId: conversation._id,
      ownerFilter,
      conversationTtlMs,
      streamId,
      generatedMessages,
      assistantPreview: fullResponse,
      workingMemory: conversationMemory,
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
    aiLogger.chatEnd(actorId, conversation._id, {
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
    aiLogger.chatError(actorId, err, "chatStream");
    const transientProviderFailure = [
      "GEMINI_TRANSIENT_EXHAUSTED",
      "GEMINI_RATE_LIMIT_EXHAUSTED",
    ].includes(err?.code);
    const malformedProviderOutput = MALFORMED_OUTPUT_CODES.has(err?.code);
    const providerTurnFailed = transientProviderFailure || malformedProviderOutput;
    failedProviderTurn = providerTurnFailed;
    let rollbackSucceeded = false;
    if (providerTurnFailed && conversation) {
      try {
        rollbackSucceeded = await rollbackFailedConversationTurn({
          conversationId: conversation._id,
          ownerFilter,
          streamId,
          previousState: previousConversationState,
          conversationTtlMs,
        });
        finalized = rollbackSucceeded;
      } catch (rollbackError) {
        safeLog.error("ai.failed_turn_rollback_failed", rollbackError);
      }
    }
    const refundedQuota = providerTurnFailed && !rollbackSucceeded
      ? serializeRequestQuota(req, "ai_chat")
      : await refundAiQuota(
          req,
          deadlineExceeded ? "provider_deadline" : "provider_stream",
        );
    if (!clientDisconnected && !res.writableEnded) {
      const message = deadlineExceeded
        ? "HT Assistant phản hồi quá lâu. Bạn vui lòng thử lại."
        : transientProviderFailure
          ? "Dịch vụ AI đang tạm gián đoạn. Bạn thử lại sau ít phút nhé."
          : malformedProviderOutput
            ? "Phản hồi AI chưa hoàn chỉnh. Bạn có thể thử lại nhé."
        : "Có lỗi xảy ra, vui lòng thử lại";
      if (refundedQuota) {
        res.write(
          `data: ${JSON.stringify({ type: "quota", quota: refundedQuota })}\n\n`,
        );
      }
      res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
      res.end();
    }
  } finally {
    clearTimeout(deadlineTimer);
    if (!finalized) {
      if (
        !failedProviderTurn &&
        fullResponse &&
        !generatedMessages.some((item) => item.content === fullResponse)
      ) {
        generatedMessages.push({
          role: "assistant",
          content: fullResponse.slice(0, 20000),
          timestamp: new Date(),
        });
      }
      try {
        await finalizeConversation({
          conversationId: conversation._id,
          ownerFilter,
          conversationTtlMs,
          streamId,
          generatedMessages,
          assistantPreview: fullResponse,
          workingMemory: conversationMemory,
        });
      } catch (error) {
        aiLogger.chatError(actorId, error, "chatFinalize");
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
    safeLog.error("ai.conversations_list_failed", err);
    res.status(500).json({
      success: false,
      message: "Không thể tải danh sách cuộc trò chuyện",
    });
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
      workingMemory: deriveConversationMemory(copiedMessages),
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
    safeLog.error("ai.history_read_failed", err);
    res.status(500).json({
      success: false,
      message: "Không thể tải lịch sử trò chuyện",
    });
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
    safeLog.error("ai.history_clear_failed", err);
    res.status(500).json({
      success: false,
      message: "Không thể xóa lịch sử trò chuyện",
    });
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
