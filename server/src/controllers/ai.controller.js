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
import {
  getToolSchemas,
  SEARCH_KNOWLEDGE_QUERY_MAX_CHARACTERS,
} from "../services/ai/tools/toolRegistry.js";
import {
  normalizePublicToolText,
  resolveToolResultStatus,
  serializeToolResultForModel,
} from "../services/ai/tools/toolResultBoundary.js";
import {
  buildKnowledgeReferenceBlock,
  buildSystemPrompt,
  getCitableKnowledgeSources,
} from "../services/ai/systemPrompt.js";
import {
  buildStandaloneRetrievalQuery,
  buildRequestRoutingBlock,
  getAllowedToolNamesForRoute,
  getUrgentSafetyResponse,
  routeAiRequest,
} from "../services/ai/requestRouter.js";
import { AI_PROMPT_CONTRACT_VERSION } from "../services/ai/promptContract.js";
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
import {
  boundAssistantOutputWithSources,
  sanitizeAssistantOutput,
} from "../services/ai/assistantOutput.js";
import {
  getPublicPersonLookupNames,
  prepareExternalKnowledgeQuery,
  prepareKnowledgeRetrievalQuery,
} from "../services/ai/knowledgePrivacy.js";
import {
  streamAssistantText,
  truncateAssistantText,
} from "../services/ai/responseStreamer.js";
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
import {
  STAGING_AI_ACCEPTANCE_RESPONSE,
  waitForStagingAiAcceptanceRelease,
} from "../services/ai/stagingAiAcceptance.service.js";

const MAX_ITERATIONS = AI_RUNTIME_POLICY.maxAgentIterations;
const MAX_HISTORY_MESSAGES = AI_RUNTIME_POLICY.maxHistoryMessages;
const STREAM_STALE_MS = 10 * 60 * 1000;
const CONVERSATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GUEST_CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;
const CHAT_DEADLINE_MS = AI_RUNTIME_POLICY.chatDeadlineMs;
const TOOL_TIMEOUT_MS = AI_RUNTIME_POLICY.toolTimeoutMs;
const MAX_ASSISTANT_RESPONSE_CHARACTERS = 20000;
const GUEST_REQUEST_KEY_VERSION = "guest-v1";

const explicitDietPlan = (message) => {
  const text = String(message || "");
  const negation = /(?:^|\s)(?:không|khong|đừng|dung|tránh|tranh|not|avoid|thay\s+vì|instead\s+of|rather\s+than)(?:\s|$)/iu;
  const quote = /["'“”‘’]/u;
  const matches = [
    ["Low-carb", /\blow[\s-]*carb\b/gi],
    ["Moderate-carb", /\bmoderate[\s-]*carb\b/gi],
    ["High-carb", /\bhigh[\s-]*carb\b/gi],
  ].filter(([, pattern]) => [...text.matchAll(pattern)].some((match) => {
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const clause = before.split(/[:,.;!?]|\s+(?:mà|nhưng|but|instead)\s+/iu).at(-1);
    const quoted = quote.test(before.trimEnd().at(-1) || "") &&
      quote.test(after.trimStart().at(0) || "");
    const afterQuote = quoted ? after.trimStart().slice(1).trimStart() : "";
    const quotedAsExample = quoted &&
      /^(?:chỉ\s+là\s+ví\s+dụ|là\s+ví\s+dụ|ví\s+dụ|không\s+phải|just\s+an?\s+example)(?:\s|[,.;!?]|$)/iu.test(afterQuote);
    const rejectedAfter = /^\s*["'”’]?\s*(?:không|khong|not)\s+(?:phù\s+hợp|muốn|đúng|phải|tốt|hợp)(?=\s|[,.;!?]|$)/iu.test(after);
    return !quotedAsExample && !negation.test(clause || "") && !rejectedAfter;
  }));
  return matches.length === 1 ? matches[0][0] : null;
};

const canReuseTdeeForMealFollowUp = (message) => {
  const remaining = String(message || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\b(?:low|moderate|high)[\s-]*carb\b/g, " ")
    .replace(/\b[1-6]\s*(?:bua|meals?)(?:\s*(?:\/|moi|trong)\s*ngay)?\b/g, " ")
    .replace(/\b(?:goi|y|thuc|don|len|lam|tao|doi|chuyen|cho|toi|minh|ban|giup|voi|theo|che|do|hay|nhe|an|bua|meal|plan|please)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
  // Chỉ dùng TDEE cũ cho lời hỏi tiếp thuần variant/số bữa. Mọi số đo,
  // calo, mục tiêu hoặc hoạt động mới phải được model xử lý như yêu cầu mới.
  return remaining.length === 0;
};

const canonicalCompoundMealArgs = (
  tdeeResult,
  requestedArgs = {},
  requestedDietPlan = null,
) => {
  const requested = requestedArgs && typeof requestedArgs === "object"
    ? requestedArgs
    : {};
  const data = tdeeResult?.uiCard?.cardType === "tdee"
    ? tdeeResult.uiCard.data
    : null;
  const defaultMacros = data?.macros?.["Moderate-carb"];
  const validMacros = (macro) =>
    Number.isSafeInteger(macro?.protein) && macro.protein >= 0 && macro.protein <= 500 &&
    Number.isSafeInteger(macro?.carb) && macro.carb >= 0 && macro.carb <= 1000 &&
    Number.isSafeInteger(macro?.fat) && macro.fat >= 0 && macro.fat <= 300;
  const matchesRequestedMacros = (macro) =>
    validMacros(macro) &&
    macro?.protein === requested.proteinGrams &&
    macro?.carb === requested.carbGrams &&
    macro?.fat === requested.fatGrams;
  const macros = requestedDietPlan
    ? data?.macros?.[requestedDietPlan]
    : Object.values(data?.macros || {}).find(matchesRequestedMacros) ||
      defaultMacros;
  if (
    !Number.isSafeInteger(data?.targetCalories) ||
    data.targetCalories < 800 || data.targetCalories > 6000 ||
    !validMacros(macros)
  ) {
    return null;
  }
  return {
    targetCalories: data.targetCalories,
    proteinGrams: macros.protein,
    carbGrams: macros.carb,
    fatGrams: macros.fat,
    mealsPerDay: Number.isInteger(requested.mealsPerDay) &&
      requested.mealsPerDay >= 1 && requested.mealsPerDay <= 6
      ? requested.mealsPerDay
      : 3,
  };
};

const httpError = (status, message) => Object.assign(new Error(message), { status });

const buildConversationRequestKey = ({ userId, guestKey, requestId }) => {
  if (userId) {
    return Object.freeze({ writeKey: requestId, lookupKeys: [requestId] });
  }
  const guestScope = crypto
    .createHash("sha256")
    .update(String(guestKey || ""))
    .digest("hex");
  const writeKey = `${GUEST_REQUEST_KEY_VERSION}:${guestScope}:${requestId}`;
  // Raw requestId remains a read alias for guest conversations created by
  // older releases; new writes are owner-scoped before hitting the legacy
  // { userId, recentRequestIds } unique index.
  return Object.freeze({ writeKey, lookupKeys: [writeKey, requestId] });
};

const serializePublicChatMessage = (message) => {
  const source = message?.toObject ? message.toObject() : message || {};
  return {
    _id: source._id,
    role: source.role,
    content: source.content || "",
    image: source.image || null,
    uiCard: source.uiCard || null,
    feedback: source.feedback || null,
    timestamp: source.timestamp,
  };
};

const serializePublicChatMessages = (messages = []) =>
  messages.map(serializePublicChatMessage);

const blockStagingAcceptanceSettlement = (req) => {
  if (req.stagingAiAcceptance) req.stagingAiAcceptanceSettlementBlocked = true;
};

const refundAiQuota = async (req, stage) => {
  if (!req.refundServiceUsage) return serializeRequestQuota(req, "ai_chat");
  try {
    return await req.refundServiceUsage();
  } catch (error) {
    safeLog.error("ai.quota_refund_failed", error, { stage });
    blockStagingAcceptanceSettlement(req);
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
  requestKey,
  requestLookupKeys,
  message,
  image,
  context,
  streamId,
}) {
  const duplicate = await ChatConversation.findOne({
    ...ownerFilter,
    recentRequestIds: { $in: requestLookupKeys },
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
        recentRequestIds: [requestKey],
        activeStreamId: streamId,
        activeStreamStartedAt: timestamp,
        context,
        expiresAt: new Date(Date.now() + conversationTtlMs),
      });
      return { conversation, duplicate: false };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const winner = await ChatConversation.findOne({
        ...ownerFilter,
        recentRequestIds: { $in: requestLookupKeys },
      });
      if (winner) return { conversation: winner, duplicate: true };
      throw error;
    }
  }

  const staleBefore = new Date(Date.now() - STREAM_STALE_MS);
  const conversation = await ChatConversation.findOneAndUpdate(
    {
      _id: conversationId,
      ...ownerFilter,
      recentRequestIds: { $nin: requestLookupKeys },
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
          $each: [requestKey],
          $slice: -MAX_RECENT_REQUEST_IDS,
        },
      },
    },
    { returnDocument: "after", runValidators: true },
  ).select("+activeStreamId +recentRequestIds");

  if (conversation) return { conversation, duplicate: false };

  const existing = await ChatConversation.findOne({
    _id: conversationId,
    ...ownerFilter,
  })
    .select("_id activeStreamId recentRequestIds")
    .lean();
  if (!existing) throw httpError(404, "Không tìm thấy cuộc trò chuyện");
  if (
    existing.recentRequestIds?.some((value) =>
      requestLookupKeys.includes(value),
    )
  ) {
    return { conversation: existing, duplicate: true };
  }
  throw httpError(409, "Cuộc trò chuyện đang xử lý một tin nhắn khác");
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

async function releaseFailedConversation({
  conversation,
  ownerFilter,
  streamId,
  requestKey,
}) {
  const failedUserMessage = conversation.messages.at(-1);
  const previousMessage = conversation.messages.at(-2);
  if (failedUserMessage?.role !== "user" || !failedUserMessage._id) {
    throw new Error("Failed chat request has no owned user message");
  }

  const update = await ChatConversation.updateOne(
    {
      _id: conversation._id,
      ...ownerFilter,
      activeStreamId: streamId,
      recentRequestIds: requestKey,
      messages: { $elemMatch: { _id: failedUserMessage._id, role: "user" } },
    },
    {
      $set: {
        activeStreamId: null,
        activeStreamStartedAt: null,
        lastMessagePreview: previousMessage?.content?.slice(0, 120) || "",
        lastMessageAt: previousMessage?.timestamp || null,
      },
      $pull: {
        messages: { _id: failedUserMessage._id },
        recentRequestIds: requestKey,
      },
      $inc: { messageCount: -1 },
    },
    { runValidators: true },
  );
  return update.modifiedCount === 1;
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
  const requestKeyContract = buildConversationRequestKey({
    userId,
    guestKey,
    requestId,
  });
  if (!userId && image) {
    await refundAiQuota(req, "guest_image_rejected");
    return res.status(403).json({
      success: false,
      code: "AI_GUEST_IMAGE_UNAVAILABLE",
      message: "Đăng nhập để gửi hình ảnh cho HT Assistant.",
    });
  }
  const streamId = crypto.randomUUID();
  const abortController = new AbortController();
  let clientDisconnected = false;
  let deadlineExceeded = false;
  const markClientDisconnected = () => {
    if (!res.writableEnded && !abortController.signal.aborted) {
      clientDisconnected = true;
      incrementMetric("ai.aborts");
      abortController.abort(new Error("Client disconnected"));
    }
  };
  res.on("close", markClientDisconnected);
  if (
    req.stagingAiAcceptanceResponseClosed ||
    req.aborted ||
    res.destroyed ||
    res.closed
  ) {
    markClientDisconnected();
  }
  const stopDisconnectedPreflight = async (stage) => {
    if (!clientDisconnected) return false;
    await refundAiQuota(req, stage);
    if (req.stagingAiAcceptance) req.stagingAiAcceptanceOutcome = "aborted";
    return true;
  };

  let user;
  let conversation;
  try {
    if (userId) {
      user = await User.findById(userId).select("name isAiChatBanned").lean();
      if (await stopDisconnectedPreflight("client_disconnected_user_lookup")) return;
      if (user?.isAiChatBanned) {
        aiLogger.userLocked(actorId, "permanent");
        await refundAiQuota(req, "user_banned");
        return res.status(403).json({
          success: false,
          message: "🚫 Tài khoản của bạn đã bị cấm sử dụng Chat AI vĩnh viễn do vi phạm quy tắc cộng đồng nhiều lần.",
        });
      }
      const lockStatus = await isUserLocked(userId);
      if (await stopDisconnectedPreflight("client_disconnected_lock_check")) return;
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
    if (await stopDisconnectedPreflight("client_disconnected_moderation")) return;
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
      requestKey: requestKeyContract.writeKey,
      requestLookupKeys: requestKeyContract.lookupKeys,
      message,
      image,
      context: canonicalContext,
      streamId,
    });
    conversation = acquired.conversation;

    if (clientDisconnected) {
      let released = acquired.duplicate;
      if (!acquired.duplicate) {
        try {
          released = await releaseFailedConversation({
            conversation,
            ownerFilter,
            streamId,
            requestKey: requestKeyContract.writeKey,
          });
        } catch (error) {
          aiLogger.chatError(actorId, error, "chatPreflightDisconnectRelease");
        }
      }
      if (!released) blockStagingAcceptanceSettlement(req);
      await refundAiQuota(req, "client_disconnected_conversation_acquire");
      if (req.stagingAiAcceptance) req.stagingAiAcceptanceOutcome = "aborted";
      return;
    }

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
      if (req.stagingAiAcceptance) req.stagingAiAcceptanceOutcome = "duplicate";
      return res.end();
    }
  } catch (error) {
    aiLogger.chatError(actorId, error, "chatPreflight");
    // A failed Mongo acquisition may still commit after an ambiguous write
    // error. Refunding quota cannot prove that acquisition was rolled back.
    if (!error.status || error.status >= 500) blockStagingAcceptanceSettlement(req);
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

  const deadlineTimer = setTimeout(() => {
    deadlineExceeded = true;
    abortController.abort(new Error("AI response deadline exceeded"));
  }, CHAT_DEADLINE_MS);
  const generatedMessages = [];
  let conversationMemory = deriveConversationMemory(
    conversation.messages,
    conversation.workingMemory,
  );
  let finalized = false;
  let failedStream = false;
  let rollbackSucceeded = false;
  let fullResponse = "";
  let routingDecision = null;
  let kbEntryIds = [];
  let kbCitationSources = [];
  let webSearchAttemptCount = 0;
  let webSearchExecutionCount = 0;
  let webSearchEvidenceAvailable = false;
  let webSearchSources = [];
  let internalEvidenceRequired = false;
  let internalEvidenceAvailable = false;
  let externalKnowledgeQuery = { eligible: false, reason: "not_required" };
  let responseModel = String(
    process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  ).slice(0, 100);
  const buildAnswerTrace = () =>
    routingDecision
      ? {
          routeDomain: routingDecision.domain,
          evidenceMode: routingDecision.evidence,
          kbEntryIds: kbEntryIds.slice(0, 10),
          webSearchUsed: webSearchExecutionCount > 0,
          model: responseModel,
          promptVersion: AI_PROMPT_CONTRACT_VERSION,
        }
      : null;
  const writeAssistantResponse = (content) =>
    streamAssistantText(content, {
      signal: abortController.signal,
      afterFirstFrame: req.stagingAiAcceptance?.mode === "paced_response" &&
        responseModel === "staging_acceptance_synthetic_v1"
        ? () => waitForStagingAiAcceptanceRelease(req.stagingAiAcceptance, {
            signal: abortController.signal,
          })
        : undefined,
      write: (frame) => {
        res.write(
          `data: ${JSON.stringify({ type: "text", content: frame })}\n\n`,
        );
      },
    });
  const deliverAssistantResponse = async (content) => {
    const boundedContent = truncateAssistantText(
      content,
      MAX_ASSISTANT_RESPONSE_CHARACTERS,
    );
    const streamed = await writeAssistantResponse(boundedContent);
    return boundedContent.slice(0, streamed.writtenCharacters);
  };
  const enforceEvidenceBoundary = (candidate) => {
    const urgentSafetyResponse = getUrgentSafetyResponse(routingDecision);
    if (urgentSafetyResponse) return urgentSafetyResponse;
    if (
      routingDecision?.webSearchRequired &&
      (!webSearchEvidenceAvailable || webSearchSources.length === 0)
    ) {
      return userId
        ? "Mình chưa thể xác minh thông tin này bằng nguồn đáng tin cậy lúc này, nên chưa muốn khẳng định từ trí nhớ. Bạn thử lại sau nhé."
        : "Mình chưa thể xác minh thông tin mới nhất này trong chế độ khách. Bạn đăng nhập để dùng tra cứu có nguồn nhé.";
    }
    if (internalEvidenceRequired && !internalEvidenceAvailable) {
      return "Mình chưa tìm thấy dữ kiện phù hợp trong thư viện bài tập để trả lời chắc chắn. Bạn thử mô tả tên bài hoặc nhóm cơ cụ thể hơn nhé.";
    }
    if (routingDecision?.webSearchRequired && webSearchEvidenceAvailable) {
      return boundAssistantOutputWithSources(candidate, {
        sources: webSearchSources,
        maxCharacters: MAX_ASSISTANT_RESPONSE_CHARACTERS,
      });
    }
    if (kbCitationSources.length > 0) {
      return boundAssistantOutputWithSources(candidate, {
        sources: kbCitationSources,
        maxCharacters: MAX_ASSISTANT_RESPONSE_CHARACTERS,
      });
    }
    return candidate;
  };
  try {
    const chatStartTime = Date.now();
    let toolCallCount = 0;
    res.write(
      `data: ${JSON.stringify({
        type: "conversation",
        conversationId: conversation._id,
      })}\n\n`,
    );

    const priorMessages = conversation.messages.slice(0, -1);
    const retrievalQuery = buildStandaloneRetrievalQuery(
      message,
      priorMessages,
    );
    routingDecision = routeAiRequest(message, {
      contextualQuery: retrievalQuery,
    });
    const allowedPublicPersonNames =
      getPublicPersonLookupNames(retrievalQuery);
    const urgentSafetyResponse = getUrgentSafetyResponse(routingDecision);
    if (urgentSafetyResponse) {
      incrementMetric("provider.gemini_chat_not_required");
      responseModel = "static_safety_v1";
      aiLogger.chatStart(actorId, conversation._id);
      const guardedSafetyResponse = sanitizeAssistantOutput(
        urgentSafetyResponse,
      );
      fullResponse = await deliverAssistantResponse(
        guardedSafetyResponse.content || urgentSafetyResponse,
      );
      if (fullResponse) {
        generatedMessages.push({
          role: "assistant",
          content: fullResponse,
          answerTrace: buildAnswerTrace(),
          timestamp: new Date(),
        });
      }
      const finalization = await finalizeConversation({
        conversationId: conversation._id,
        ownerFilter,
        conversationTtlMs,
        streamId,
        generatedMessages,
        assistantPreview: fullResponse,
        workingMemory: conversationMemory,
      });
      if (req.stagingAiAcceptance && finalization.modifiedCount !== 1) {
        blockStagingAcceptanceSettlement(req);
      }
      finalized = true;
      if (deadlineExceeded) {
        throw new Error("AI response deadline exceeded");
      }
      aiLogger.chatEnd(actorId, conversation._id, {
        iterations: 0,
        toolCalls: 0,
        durationMs: Date.now() - chatStartTime,
        kbHits: 0,
      });
      if (!abortController.signal.aborted) {
        res.write(
          `data: ${JSON.stringify({
            type: "done",
            conversationId: conversation._id,
          })}\n\n`,
        );
        res.end();
      }
      return;
    }

    const resolvedPageContext = await resolvePageContext(
      conversation.context,
      { expandContent: shouldExpandPageContent(message) },
    );

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
    // === KNOWLEDGE BASE SEARCH ===
    // Tìm kiến thức đã review trước khi gọi LLM. KB vẫn là untrusted data.
    if (routingDecision.knowledgeBaseEligible) {
      const preparedRetrieval = prepareKnowledgeRetrievalQuery(retrievalQuery);
      if (preparedRetrieval.eligible) {
        try {
          const kbResults = await searchKnowledgeBase(preparedRetrieval.query, {
            limit: 3,
            threshold: 0.75,
          });
          if (kbResults.length > 0) {
            kbEntryIds = kbResults.map((result) => result._id);
            kbCitationSources = getCitableKnowledgeSources(kbResults);
            aiLogger.kbMatch(actorId, kbResults.length, kbResults[0]?.similarity);
            systemPrompt += buildKnowledgeReferenceBlock(kbResults);
          }
        } catch (err) {
          // KB search lỗi không ảnh hưởng chat flow chính
          safeLog.error("ai.kb_search_non_blocking_failed", err);
        }
      }
    }

    // Với fitness rủi ro thấp, KB là enrichment. KB miss không được biến một
    // câu hỏi ổn định thành web lookup bắt buộc hoặc lời từ chối giả.
    if (
      routingDecision.evidence === "internal_kb" &&
      routingDecision.domain === "fitness" &&
      kbEntryIds.length === 0 &&
      !routingDecision.preferredTool
    ) {
      routingDecision = Object.freeze({
        ...routingDecision,
        evidence: "model_prior",
        knowledgeBaseEligible: false,
        webSearchRequired: false,
        preferredTool: null,
        maxWebSearchCalls: 0,
        reasonCodes: Object.freeze([
          ...routingDecision.reasonCodes,
          routingDecision.risk === "low"
            ? "knowledge_base_no_hit_model_prior"
            : "high_stakes_no_internal_evidence",
        ]),
      });
    }
    internalEvidenceAvailable = kbEntryIds.length > 0;
    internalEvidenceRequired =
      routingDecision.evidence === "internal_kb" &&
      routingDecision.domain === "fitness" &&
      routingDecision.risk !== "low" &&
      kbEntryIds.length === 0 &&
      routingDecision.preferredTool === "search_exercises";
    if (routingDecision.webSearchRequired) {
      const missingRequiredPublicPersonBinding =
        routingDecision.reasonCodes.includes("public_person_claim") &&
        allowedPublicPersonNames.length === 0;
      externalKnowledgeQuery = missingRequiredPublicPersonBinding
        ? { eligible: false, reason: "ambiguous_person_identity" }
        : prepareExternalKnowledgeQuery(retrievalQuery, {
            allowedPublicPersonNames,
          });
      if (externalKnowledgeQuery.eligible) {
        externalKnowledgeQuery = {
          ...externalKnowledgeQuery,
          query: externalKnowledgeQuery.query.slice(
            0,
            SEARCH_KNOWLEDGE_QUERY_MAX_CHARACTERS,
          ),
        };
      }
      if (!externalKnowledgeQuery.eligible) {
        routingDecision = Object.freeze({
          ...routingDecision,
          maxWebSearchCalls: 0,
          preferredTool: null,
          reasonCodes: Object.freeze([
            ...routingDecision.reasonCodes,
            "external_privacy_blocked",
          ]),
        });
      }
    }
    systemPrompt += buildRequestRoutingBlock(routingDecision, {
      canUseWebSearch:
        Boolean(userId) &&
        externalKnowledgeQuery.eligible &&
        routingDecision.maxWebSearchCalls > 0,
    });

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

    const availableTools = getToolSchemas({
      isAuthenticated: Boolean(userId),
      allowWebSearch:
        Boolean(userId) &&
        externalKnowledgeQuery.eligible &&
        routingDecision.maxWebSearchCalls > 0,
    });
    const routeAllowedToolNames = getAllowedToolNamesForRoute(
      routingDecision,
    ).filter(
      (toolName) =>
        toolName !== "search_knowledge" || externalKnowledgeQuery.eligible,
    );
    const routeAllowedToolNameSet = new Set(routeAllowedToolNames);
    const routedTools = availableTools.filter((tool) =>
      routeAllowedToolNameSet.has(tool?.function?.name),
    );
    const compoundTdeeMeal = routingDecision.reasonCodes.includes(
      "compound_tdee_meal",
    ) && routeAllowedToolNameSet.has("suggest_meal");
    const requestedDietPlan = routeAllowedToolNameSet.has("suggest_meal")
      ? explicitDietPlan(message)
      : null;
    const rememberedTdeeResult = !compoundTdeeMeal && requestedDietPlan &&
      canReuseTdeeForMealFollowUp(message) &&
      conversationMemory.lastTdee?.result
      ? { uiCard: { cardType: "tdee", data: conversationMemory.lastTdee.result } }
      : null;
    let completedTdeeResult = null;
    let completedCompoundMeal = false;
    const getIterationTools = () => {
      if (routingDecision.webSearchRequired &&
          webSearchAttemptCount >= routingDecision.maxWebSearchCalls) return [];
      if (compoundTdeeMeal) {
        const nextToolName = completedCompoundMeal
          ? null
          : completedTdeeResult ? "suggest_meal" : "calculate_tdee";
        return routedTools.filter((tool) => tool?.function?.name === nextToolName);
      }
      return routedTools;
    };
    let lastToolResultText = ""; // Backup: dùng khi Gemini im luôn sau tool call

    // === AGENT LOOP (Pattern từ Dify fc_agent_runner.py) ===
    let iteration = 0;
    let needsToolCall = true;
    let protocolRetryCount = 0;
    aiLogger.chatStart(actorId, conversation._id);

    while (
      needsToolCall &&
      iteration < MAX_ITERATIONS &&
      !abortController.signal.aborted
    ) {
      needsToolCall = false;
      iteration++;
      let iterationText = "";
      let iterationCalledTool = false;
      let iterationCompletedWebSearch = false;
      let iterationGroundedWebText = "";
      const iterationTools = getIterationTools();
      const allowedToolNames = new Set(
        iterationTools.map((tool) => tool?.function?.name).filter(Boolean),
      );

      // Only the authenticated, one-time staging middleware can set this lane.
      // The ordinary acquisition, moderation, routing and retrieval remain above.
      if (req.stagingAiAcceptance?.mode === "provider_failure_before_llm") {
        throw Object.assign(new Error("Injected staging acceptance failure before LLM invocation"), {
          code: "STAGING_AI_ACCEPTANCE_PROVIDER_FAILURE",
          isOperational: true,
        });
      }
      const pacedAcceptance = req.stagingAiAcceptance?.mode === "paced_response";
      if (pacedAcceptance) responseModel = "staging_acceptance_synthetic_v1";
      const providerStream = pacedAcceptance
        ? [{ type: "text", content: STAGING_AI_ACCEPTANCE_RESPONSE }]
        : llmStream(llmMessages, iterationTools, { signal: abortController.signal });
      for await (const chunk of providerStream) {
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
            // Mọi text phát trước function call chỉ là draft. Bỏ ngay cả khi
            // function call bị runtime policy từ chối để không lộ protocol nháp.
            iterationText = "";
            fullResponse = "";
            const runtimeBoundedToolCalls = boundAiToolCalls(
              chunk.toolCalls,
              toolCallCount,
            );
            const eligibleToolCalls = runtimeBoundedToolCalls
              .filter((call) => {
                if (!allowedToolNames.has(call.name)) return false;
                if (call.name !== "search_knowledge") return true;
                if (
                  webSearchAttemptCount >= routingDecision.maxWebSearchCalls ||
                  !userId ||
                  !externalKnowledgeQuery.eligible
                ) {
                  return false;
                }
                webSearchAttemptCount += 1;
                return true;
              })
              .map((call) =>
                call.name === "search_knowledge"
                  ? {
                      ...call,
                      args: { query: externalKnowledgeQuery.query },
                    }
                  : (compoundTdeeMeal || rememberedTdeeResult) &&
                      call.name === "suggest_meal"
                    ? {
                        ...call,
                        args: canonicalCompoundMealArgs(
                          completedTdeeResult || rememberedTdeeResult,
                          call.args,
                          requestedDietPlan,
                        ),
                      }
                  : call,
              );
            const boundedToolCalls = compoundTdeeMeal
              ? eligibleToolCalls.slice(0, 1).filter((call) => call.args)
              : eligibleToolCalls.filter((call) =>
                  call.name !== "suggest_meal" || !rememberedTdeeResult || call.args,
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
            needsToolCall = true;
            iterationCalledTool = true;

            // Gemini yêu cầu parallel function calls nằm trong cùng model turn,
            // sau đó mới tới các functionResponse trong một user turn.
            llmMessages.push({
              role: "assistant",
              content: "",
              tool_calls: boundedToolCalls,
              _thoughtParts: chunk.thoughtParts || [],
            });

            const toolExecutions = await executeToolBatch(
              boundedToolCalls,
              {
                userId,
                signal: abortController.signal,
                timeoutMs: TOOL_TIMEOUT_MS,
                allowedToolNames: [...allowedToolNames],
                allowedPublicPersonNames,
              },
              {
                executor: (toolName, parameters, context) => {
                  if (toolName !== "search_knowledge") {
                    return executeTool(toolName, parameters, context);
                  }
                  if (!externalKnowledgeQuery.eligible) {
                    return {
                      text:
                        "Không thể gửi dữ liệu sức khỏe hoặc định danh cá nhân lên web search để tra cứu.",
                      uiCard: null,
                      error: null,
                      meta: {
                        toolName,
                        evidenceAvailable: false,
                        sourceCount: 0,
                        validationFailed: true,
                        invalidFields: ["query"],
                        privacyBlocked: true,
                      },
                    };
                  }
                  webSearchExecutionCount += 1;
                  return executeTool(
                    toolName,
                    { query: externalKnowledgeQuery.query },
                    context,
                  );
                },
                onStart: (call) => {
                  res.write(
                    `data: ${JSON.stringify({ type: "tool_start" })}\n\n`,
                  );
                },
              },
            );
            const completedToolMessages = [];

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
                if (abortController.signal.aborted) break;
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
              if (call.name === "search_knowledge") {
                iterationCompletedWebSearch = true;
                webSearchSources = Array.isArray(toolResult.meta?.sources)
                  ? toolResult.meta.sources
                  : [];
                webSearchEvidenceAvailable =
                  toolResult.meta?.evidenceAvailable === true &&
                  webSearchSources.length > 0;
                if (webSearchEvidenceAvailable) {
                  iterationGroundedWebText = safeToolText;
                }
              }
              toolCallCount++;
              const toolSucceeded = isSuccessfulToolResult(toolResult);
              if (compoundTdeeMeal && toolSucceeded) {
                if (call.name === "calculate_tdee" &&
                    canonicalCompoundMealArgs(toolResult)) {
                  completedTdeeResult = toolResult;
                } else if (call.name === "suggest_meal") {
                  completedCompoundMeal = true;
                }
              }
              if (
                routingDecision.evidence === "internal_kb" &&
                call.name === routingDecision.preferredTool
              ) {
                internalEvidenceAvailable =
                  internalEvidenceAvailable ||
                  (toolSucceeded &&
                    toolResult.meta?.evidenceAvailable === true);
              }
              if (
                call.name === "search_exercises" &&
                routingDecision.risk === "low" &&
                toolResult.meta?.evidenceAvailable !== true
              ) {
                routingDecision = Object.freeze({
                  ...routingDecision,
                  evidence: "model_prior",
                  reasonCodes: Object.freeze([
                    ...routingDecision.reasonCodes,
                    "exercise_catalog_no_hit_model_prior",
                  ]),
                });
              }
              aiLogger.toolCall(actorId, call.name, toolDuration, toolSucceeded);
              if (toolSucceeded) {
                conversationMemory = updateConversationMemory(
                  conversationMemory,
                  call.name,
                  call.args,
                  toolResult,
                );
              }

              // FE chỉ cần biết tool đã hoàn tất; tên/nội dung tool là protocol nội bộ.
              res.write(`data: ${JSON.stringify({ type: "tool_result" })}\n\n`);

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
              lastToolResultText = safeToolText; // Lưu backup

              // Lưu tool call vào conversation
              completedToolMessages.push({
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
            if (
              !abortController.signal.aborted &&
              completedToolMessages.length === boundedToolCalls.length
            ) {
              generatedMessages.push(
                {
                  role: "assistant",
                  content: "",
                  toolCalls: boundedToolCalls,
                  timestamp: new Date(),
                },
                ...completedToolMessages,
              );
            }
            }
            break;

          case "ui_card":
            res.write(`data: ${JSON.stringify({ type: "ui_card", cardType: chunk.cardType, data: chunk.data })}\n\n`);
            break;
        }
      }

      if (abortController.signal.aborted) break;
      if (iterationCalledTool && iterationCompletedWebSearch) {
        let groundedContent = "";
        if (webSearchEvidenceAvailable) {
          const guardedGrounding = sanitizeAssistantOutput(
            iterationGroundedWebText,
          );
          groundedContent = guardedGrounding.content;
          if (!groundedContent) {
            webSearchEvidenceAvailable = false;
            webSearchSources = [];
          }
        }
        const finalContent = enforceEvidenceBoundary(groundedContent);
        fullResponse = await deliverAssistantResponse(finalContent);
        needsToolCall = false;
        break;
      }
      if (!iterationCalledTool && iterationText) {
        if (
          routingDecision.evidence === "internal_kb" &&
          routingDecision.domain === "fitness" &&
          routingDecision.risk === "low" &&
          !internalEvidenceAvailable
        ) {
          routingDecision = Object.freeze({
            ...routingDecision,
            evidence: "model_prior",
            reasonCodes: Object.freeze([
              ...routingDecision.reasonCodes,
              "internal_evidence_not_used_model_prior",
            ]),
          });
        }
        const guarded = sanitizeAssistantOutput(iterationText);
        if (guarded.protocolLeak) {
          if (protocolRetryCount < 1) {
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
          const malformedOutputError = new Error(
            "AI provider returned malformed protocol output",
          );
          malformedOutputError.code = "AI_MALFORMED_OUTPUT";
          malformedOutputError.isOperational = true;
          throw malformedOutputError;
        }

        const finalContent = enforceEvidenceBoundary(
            guarded.content ||
              "Mình chưa thể hoàn tất yêu cầu này. Bạn thử diễn đạt lại ngắn gọn hơn nhé.",
        );
        fullResponse = await deliverAssistantResponse(finalContent);
      }
    }

    if (deadlineExceeded) {
      fullResponse = "";
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
      const guardedFallback = sanitizeAssistantOutput(lastToolResultText);
      if (guardedFallback.protocolLeak) {
        safeLog.warn(
          "ai.tool_result_fallback_blocked",
          "Tool fallback contained assistant protocol text",
        );
      }
      const fallbackContent = enforceEvidenceBoundary(
        guardedFallback.content ||
          "Mình chưa thể hoàn tất yêu cầu này. Bạn thử diễn đạt lại ngắn gọn hơn nhé.",
      );
      fullResponse = await deliverAssistantResponse(fallbackContent);
    }
    if (fullResponse) {
      generatedMessages.push({
        role: "assistant",
        content: fullResponse,
        answerTrace: buildAnswerTrace(),
        timestamp: new Date(),
      });
    }
    if (!abortController.signal.aborted && !fullResponse) {
      throw new Error("AI provider completed without usable output");
    }

    const finalization = await finalizeConversation({
      conversationId: conversation._id,
      ownerFilter,
      conversationTtlMs,
      streamId,
      generatedMessages,
      assistantPreview: fullResponse,
      workingMemory: conversationMemory,
    });
    if (req.stagingAiAcceptance && finalization.modifiedCount !== 1) {
      blockStagingAcceptanceSettlement(req);
    }
    finalized = true;
    if (deadlineExceeded) {
      throw new Error("AI response deadline exceeded");
    }

    // Tăng usageCount cho KB entries đã dùng (non-blocking)
    if (kbEntryIds.length > 0) {
      const usageUpdate = KnowledgeEntry.updateMany(
        { _id: { $in: kbEntryIds } },
        { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
      );
      if (req.stagingAiAcceptance) {
        try {
          await usageUpdate;
        } catch (error) {
          safeLog.error("ai.kb_usage_update_failed", error);
          blockStagingAcceptanceSettlement(req);
        }
      } else {
        usageUpdate.catch((error) => safeLog.error("ai.kb_usage_update_failed", error));
      }
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
      if (req.stagingAiAcceptance) req.stagingAiAcceptanceOutcome = "completed";
    } else if (req.stagingAiAcceptance) {
      req.stagingAiAcceptanceOutcome = "aborted";
    }
  } catch (err) {
    aiLogger.chatError(actorId, err, "chatStream");
    failedStream = !clientDisconnected;
    if (req.stagingAiAcceptance) {
      req.stagingAiAcceptanceOutcome = clientDisconnected ? "aborted" : "failed";
    }
    if (failedStream && !finalized) {
      try {
        rollbackSucceeded = await releaseFailedConversation({
          conversation,
          ownerFilter,
          streamId,
          requestKey: requestKeyContract.writeKey,
        });
        finalized = rollbackSucceeded;
      } catch (error) {
        aiLogger.chatError(actorId, error, "chatReleaseFailed");
      }
    }
    const refundedQuota = await refundAiQuota(
      req,
      deadlineExceeded ? "provider_deadline" : "provider_stream",
    );
    if (!clientDisconnected && !res.writableEnded) {
      let errorMessage = "Có lỗi xảy ra, vui lòng thử lại";
      if (deadlineExceeded) {
        errorMessage = "HT Assistant phản hồi quá lâu. Bạn vui lòng thử lại.";
      } else if (err?.code === "AI_MALFORMED_OUTPUT") {
        errorMessage =
          "HT Assistant nhận được phản hồi chưa hoàn chỉnh. Bạn vui lòng thử lại.";
      } else if (err?.code === "GEMINI_HTTP_ERROR" && err?.status === 429) {
        errorMessage =
          "HT Assistant đang nhận quá nhiều yêu cầu từ nhà cung cấp. Bạn vui lòng thử lại sau ít phút.";
      } else if (
        (err?.code === "GEMINI_HTTP_ERROR" && Number(err?.status) >= 500) ||
        [
          "GEMINI_NETWORK_ERROR",
          "GEMINI_STREAM_ERROR",
          "GEMINI_STREAM_EMPTY",
          "GEMINI_TIMEOUT",
        ]
          .includes(err?.code)
      ) {
        errorMessage =
          "Dịch vụ AI đang tạm gián đoạn. Bạn vui lòng thử lại sau.";
      }
      if (refundedQuota) {
        res.write(
          `data: ${JSON.stringify({ type: "quota", quota: refundedQuota })}\n\n`,
        );
      }
      res.write(`data: ${JSON.stringify({
        type: "error",
        message: errorMessage,
        retryable: rollbackSucceeded,
      })}\n\n`);
      res.end();
    }
  } finally {
    clearTimeout(deadlineTimer);
    if (!finalized) {
      if (failedStream) {
        try {
          const released = await releaseFailedConversation({
            conversation,
            ownerFilter,
            streamId,
            requestKey: requestKeyContract.writeKey,
          });
          if (!released) blockStagingAcceptanceSettlement(req);
        } catch (error) {
          aiLogger.chatError(actorId, error, "chatReleaseFailed");
          blockStagingAcceptanceSettlement(req);
        }
        return;
      }
      if (fullResponse && !generatedMessages.some((item) => item.content === fullResponse)) {
        generatedMessages.push({
          role: "assistant",
          content: truncateAssistantText(
            fullResponse,
            MAX_ASSISTANT_RESPONSE_CHARACTERS,
          ),
          answerTrace: buildAnswerTrace(),
          timestamp: new Date(),
        });
      }
      try {
        const finalization = await finalizeConversation({
          conversationId: conversation._id,
          ownerFilter,
          conversationTtlMs,
          streamId,
          generatedMessages,
          assistantPreview: fullResponse,
          workingMemory: conversationMemory,
        });
        if (req.stagingAiAcceptance && finalization.modifiedCount !== 1) {
          blockStagingAcceptanceSettlement(req);
        }
      } catch (error) {
        aiLogger.chatError(actorId, error, "chatFinalize");
        blockStagingAcceptanceSettlement(req);
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
        messages: serializePublicChatMessages(conversation.messages),
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
        messages: serializePublicChatMessages(branch.messages),
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
        messages: serializePublicChatMessages(conversation.messages),
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

    const feedbackReview = feedback === "down"
      ? { status: "pending", reviewedBy: null, reviewedAt: null }
      : { status: "none", reviewedBy: null, reviewedAt: null };
    const result = await ChatConversation.updateOne({
      _id: req.params.id,
      userId: req.user.id,
      messages: {
        $elemMatch: { _id: messageId, role: "assistant" },
      },
    }, {
      $set: {
        "messages.$[message].feedback": feedback,
        "messages.$[message].feedbackReview": feedbackReview,
      },
    }, {
      arrayFilters: [{ "message._id": messageId, "message.role": "assistant" }],
      runValidators: true,
    });

    if (result.matchedCount === 0) {
      return res.status(400).json({ success: false, message: "Message không hợp lệ" });
    }

    res.json({ success: true, message: "Đã lưu feedback" });
  } catch (err) {
    safeLog.error("ai.feedback_submit_failed", err);
    res.status(500).json({ success: false, message: "Không thể lưu feedback" });
  }
};
