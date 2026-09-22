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
  toolRegistry,
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
import { buildCanonicalMealToolRequest } from "../services/ai/mealRequestConstraints.js";
import { buildTdeeIntakeResponse } from "../services/ai/tdeeIntake.js";
import {
  hasLimitedDumbbellBandConstraint,
  validateWorkoutEquipmentOutput,
} from "../services/ai/equipmentConstraint.js";
import {
  buildScopeCorrectionInstruction,
  buildScopePreservationFallback,
  parseScopePreservationRequest,
  validateScopePreservationOutput,
} from "../services/ai/scopePreservation.js";
import {
  MIXED_WORKOUT_CORRECTION_INSTRUCTION,
  MIXED_WORKOUT_FALLBACK,
  validateMixedWorkoutSupplementOutput,
} from "../services/ai/mixedWorkoutMealGuard.js";
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
const MANDATORY_READ_ONLY_TOOL_NAMES = new Set([
  "calculate_tdee",
  "suggest_meal",
  "search_exercises",
  "search_knowledge",
]);

const resolveRequiredReadOnlyToolName = (toolName, routedTools) => {
  const tool = toolRegistry[toolName];
  const isExposed = routedTools.some(
    (schema) => schema?.function?.name === toolName,
  );
  return MANDATORY_READ_ONLY_TOOL_NAMES.has(toolName) &&
    isExposed &&
    tool?.readOnly === true &&
    tool?.requiresConfirmation !== true
    ? toolName
    : null;
};

const canonicalExerciseArgs = (message, args = {}) => {
  const normalized = String(message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
  const intent = [
    String(args.searchQuery || args.muscleGroup || "bài tập").trim(),
    /\b(?:nguoi moi|moi bat dau|beginner)\b/.test(normalized)
      ? "người mới"
      : "",
    hasLimitedDumbbellBandConstraint(message)
      ? "chỉ có tạ đơn và dây kháng lực"
      : "",
  ].filter(Boolean).join(" ").slice(0, 100);
  return {
    ...(args.muscleGroup && { muscleGroup: args.muscleGroup }),
    searchQuery: intent,
    ...(Number.isInteger(args.limit) && { limit: args.limit }),
  };
};

const attachMealIdentity = (toolName, toolResult) => {
  if (
    toolName !== "suggest_meal" ||
    toolResult?.uiCard?.cardType !== "meal" ||
    toolResult.uiCard.data?.status !== "complete"
  ) {
    return toolResult;
  }
  return {
    ...toolResult,
    uiCard: {
      ...toolResult.uiCard,
      data: {
        ...toolResult.uiCard.data,
        mealPlanId: crypto.randomUUID(),
        mealRevision: 1,
      },
    },
  };
};

const requiredToolMissingResponse = (toolName) => {
  if (toolName === "calculate_tdee") {
    return {
      text:
        "TDEE là một ước tính và mình chưa đủ dữ liệu có cấu trúc để tính cho bạn. Vui lòng cung cấp tối đa 5 nhóm: (1) giới tính, tuổi, chiều cao và cân nặng; (2) mục tiêu; (3) công việc, di chuyển và số bước; (4) số buổi, thời lượng và cường độ tập; (5) thiết bị, kinh nghiệm và chấn thương nếu bạn cũng muốn lập giáo án.",
      uiCard: null,
    };
  }
  if (toolName === "suggest_meal") {
    return {
      text:
        "Mình chưa nhận được đủ dữ liệu có cấu trúc để tạo thực đơn chính xác. Bạn vui lòng nêu mục tiêu kcal, protein tối thiểu và số bữa.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "missing_data",
          reason: "required_tool_not_called",
          meals: [],
          totals: null,
        },
      },
    };
  }
  if (toolName === "search_exercises") {
    return {
      text:
        "Mình chưa thể đối chiếu thư viện bài tập cho yêu cầu này. Bạn thử nêu nhóm cơ và thiết bị hiện có nhé.",
      uiCard: null,
    };
  }
  return {
    text:
      "Mình chưa thể xác minh thông tin này bằng nguồn đáng tin cậy lúc này, nên chưa muốn khẳng định từ trí nhớ. Bạn thử lại sau nhé.",
    uiCard: null,
  };
};

const hasCompleteCanonicalMealArgs = (args) =>
  Number.isFinite(args?.targetCalories) &&
  Number.isFinite(args?.proteinGrams) && args.proteinGrams > 0 &&
  Number.isFinite(args?.carbGrams) && args.carbGrams >= 0 &&
  Number.isFinite(args?.fatGrams) && args.fatGrams >= 0 &&
  Number.isInteger(args?.mealsPerDay) &&
  args.mealsPerDay >= 1 && args.mealsPerDay <= 6;

const EQUIPMENT_CORRECTION_INSTRUCTION =
  "Hãy viết lại câu trả lời và giữ nguyên mục tiêu lịch tập. Chỉ dùng tạ đơn điều chỉnh, dây kháng lực hoặc bodyweight. Không dùng thanh đòn, máy, cáp hay ghế; dumbbell chest press phải ghi rõ biến thể floor press trên sàn. Chỉ trả lời cuối cùng, không nêu quy trình nội bộ.";

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
    .replace(/\b(?:goi|y|thuc|don|len|lam|tao|doi|chuyen|cho|toi|minh|ban|giup|voi|theo|che|do|hay|nhe|an|bua|meal|plan|please|khong|muon|chi|la|vi|du|phu|hop|chon|thay|ma|nhung|not|avoid|instead|of|rather|than|example|want|suitable|but)\b/g, " ")
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
    structuredAction: source.structuredAction || null,
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

const buildRetryUserMessage = ({ message, image, structuredAction, timestamp }) => ({
  role: "user",
  content: message,
  image,
  structuredAction: structuredAction || null,
  timestamp,
});

const canonicalRetryValue = (value) => {
  const source = value?.toObject?.() || value;
  if (source === undefined || source === null) return null;
  if (Array.isArray(source)) return source.map(canonicalRetryValue);
  if (typeof source !== "object") return source;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, canonicalRetryValue(source[key])]),
  );
};

const retryValuesEqual = (left, right) =>
  JSON.stringify(canonicalRetryValue(left)) ===
  JSON.stringify(canonicalRetryValue(right));

const acquireRetryConversation = async ({
  ownerFilter,
  conversationTtlMs,
  conversationId,
  retryOfMessageId,
  requestKey,
  requestLookupKeys,
  message,
  image,
  structuredAction,
  context,
  streamId,
}) => {
  const existing = await ChatConversation.findOne({
    _id: conversationId,
    ...ownerFilter,
  })
    .select("+guestKey +activeStreamId +activeStreamStartedAt +recentRequestIds")
    .lean();

  if (!existing) throw httpError(404, "Không tìm thấy cuộc trò chuyện");
  if (existing.recentRequestIds?.some((value) => requestLookupKeys.includes(value))) {
    return { conversation: existing, duplicate: true };
  }
  const staleBefore = new Date(Date.now() - STREAM_STALE_MS);
  const activeStreamIsFresh = existing.activeStreamId &&
    (!existing.activeStreamStartedAt || existing.activeStreamStartedAt >= staleBefore);
  if (activeStreamIsFresh) {
    throw httpError(409, "Cuộc trò chuyện đang xử lý một tin nhắn khác");
  }

  const targetIndex = existing.messages.findIndex(
    (candidate) =>
      String(candidate._id) === String(retryOfMessageId) &&
      candidate.role === "user",
  );
  if (targetIndex < 0) {
    throw httpError(409, "Tin nhắn cần retry không còn trong cuộc trò chuyện");
  }

  const targetMessage = existing.messages[targetIndex];
  if (targetMessage.content !== message) {
    throw httpError(409, "Nội dung retry không khớp tin nhắn gốc");
  }
  if ((targetMessage.image || null) !== (image || null) ||
      !retryValuesEqual(targetMessage.structuredAction, structuredAction)) {
    throw httpError(409, "Dữ liệu retry không khớp tin nhắn gốc");
  }
  if (existing.messages.slice(targetIndex + 1).some(({ role }) => role === "user")) {
    throw httpError(409, "Chỉ có thể retry lượt cuối cùng của cuộc trò chuyện");
  }

  const retainedMessages = existing.messages.slice(0, targetIndex);
  const removedTail = existing.messages.slice(targetIndex);
  const snapshotMessages = existing.messages;
  const currentWorkingMemory =
    existing.workingMemory?.toObject?.() || existing.workingMemory || {};
  const removedToolNames = new Set(
    removedTail
      .filter((item) => item.role === "tool")
      .map((item) => item.toolName),
  );
  let nextWorkingMemory = currentWorkingMemory;
  if (removedToolNames.has("calculate_tdee")) {
    const memoryWithoutRemovedState = { ...currentWorkingMemory };
    delete memoryWithoutRemovedState.lastTdee;
    delete memoryWithoutRemovedState.lastMeal;
    nextWorkingMemory = deriveConversationMemory(
      retainedMessages,
      memoryWithoutRemovedState,
    );
  } else if (removedToolNames.has("suggest_meal")) {
    const memoryWithoutRemovedMeal = { ...currentWorkingMemory };
    delete memoryWithoutRemovedMeal.lastMeal;
    nextWorkingMemory = deriveConversationMemory(
      retainedMessages,
      memoryWithoutRemovedMeal,
    );
  }
  const retryRollback = {
    removedTail,
    messageCount: Number(existing.messageCount || 0),
    lastMessagePreview: existing.lastMessagePreview || "",
    lastMessageAt: existing.lastMessageAt || null,
    context: existing.context?.toObject?.() || existing.context || {},
    workingMemory: currentWorkingMemory,
    expiresAt: existing.expiresAt || null,
  };
  const timestamp = new Date();
  const retryUserMessage = ChatConversation.hydrate(existing).messages.create(
    buildRetryUserMessage({ message, image, structuredAction, timestamp }),
  ).toObject();
  const nextMessages = [
    ...retainedMessages,
    retryUserMessage,
  ].slice(-MAX_STORED_CHAT_MESSAGES);
  const removedAssistantCount = existing.messages
    .slice(targetIndex)
    .filter(({ role }) => role === "assistant").length;
  const nextMessageCount = Math.max(
    0,
    Number(existing.messageCount || 0) - 1 - removedAssistantCount + 1,
  );
  const rawOwnerFilter = existing.userId
    ? { userId: existing.userId }
    : { guestKey: existing.guestKey };
  const retrySnapshotFilter = {
    _id: existing._id,
    ...rawOwnerFilter,
    __v: existing.__v,
    messages: snapshotMessages,
    messageCount: Number(existing.messageCount || 0),
    $or: [
      { activeStreamId: null },
      { activeStreamId: { $exists: false } },
      {
        activeStreamId: { $ne: null },
        activeStreamStartedAt: { $lt: staleBefore },
      },
    ],
    recentRequestIds: { $nin: requestLookupKeys },
  };
  retrySnapshotFilter.workingMemory = Object.hasOwn(existing, "workingMemory")
    ? currentWorkingMemory
    : { $exists: false };
  if (existing.updatedAt) retrySnapshotFilter.updatedAt = existing.updatedAt;
  // The exact snapshot prevents a stale retry from replacing a turn that
  // acquired/finalized after the initial read. Keep the active-stream guard
  // above as the cheap contention check for legacy documents.
  const acquisition = await ChatConversation.collection.updateOne(
    retrySnapshotFilter,
    {
      $set: {
        messages: nextMessages,
        messageCount: nextMessageCount,
        activeStreamId: streamId,
        activeStreamStartedAt: timestamp,
        expiresAt: new Date(Date.now() + conversationTtlMs),
        updatedAt: timestamp,
        lastMessagePreview: message.slice(0, 120),
        lastMessageAt: timestamp,
        workingMemory: nextWorkingMemory,
        ...contextUpdate(context),
      },
      $push: {
        recentRequestIds: {
          $each: [requestKey],
          $slice: -MAX_RECENT_REQUEST_IDS,
        },
      },
      $inc: { __v: 1 },
    },
  );

  if (acquisition.matchedCount !== 1) {
    const winner = await ChatConversation.findOne({
      _id: existing._id,
      ...ownerFilter,
      recentRequestIds: { $in: requestLookupKeys },
    }).select("+activeStreamId +recentRequestIds");
    if (winner) return { conversation: winner, duplicate: true };
    throw httpError(409, "Cuộc trò chuyện vừa thay đổi. Vui lòng thử lại");
  }
  const activeSnapshot = await ChatConversation.collection.findOne({
    _id: existing._id,
    ...rawOwnerFilter,
    activeStreamId: streamId,
    recentRequestIds: requestKey,
  });
  if (!activeSnapshot) {
    throw httpError(409, "Cuộc trò chuyện vừa thay đổi. Vui lòng thử lại");
  }
  const conversation = ChatConversation.hydrate(activeSnapshot);
  retryRollback.activeMessageCount = Number(conversation.messageCount || 0);
  retryRollback.activeMessagesLength = conversation.messages.length;
  retryRollback.retainedMessageCount = Math.max(0, conversation.messages.length - 1);
  retryRollback.activeWorkingMemory = activeSnapshot.workingMemory;
  retryRollback.activeContext = activeSnapshot.context;
  retryRollback.activeContextExists = Object.hasOwn(activeSnapshot, "context");
  retryRollback.activeLastMessagePreview = activeSnapshot.lastMessagePreview;
  retryRollback.activeLastMessageAt = activeSnapshot.lastMessageAt;
  conversation.$locals.retryRollback = retryRollback;
  return { conversation, duplicate: false, replaced: true };
};

async function acquireConversation({
  ownerFilter,
  ownerDocument,
  conversationTtlMs,
  conversationId,
  retryOfMessageId,
  requestKey,
  requestLookupKeys,
  message,
  image,
  structuredAction,
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
    structuredAction: structuredAction || null,
    timestamp,
  };

  if (conversationId && retryOfMessageId) {
    return acquireRetryConversation({
      ownerFilter,
      conversationTtlMs,
      conversationId,
      retryOfMessageId,
      requestKey,
      requestLookupKeys,
      message,
      image,
      structuredAction,
      context,
      streamId,
    });
  }

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

  const retryRollback = conversation.$locals?.retryRollback;
  if (retryRollback) {
    const restoreMessageCount = Math.max(
      0,
      Number(retryRollback.messageCount || 0),
    );
    const retryTail = Array.isArray(retryRollback.removedTail)
      ? retryRollback.removedTail
      : [];
    const activeContextFilter = retryRollback.activeContextExists
      ? { context: retryRollback.activeContext }
      : { context: { $exists: false } };
    const update = await ChatConversation.updateOne(
      {
        _id: conversation._id,
        ...ownerFilter,
        activeStreamId: streamId,
        recentRequestIds: requestKey,
        [`messages.${retryRollback.retainedMessageCount}._id`]: failedUserMessage._id,
        messages: { $size: retryRollback.activeMessagesLength },
        messageCount: retryRollback.activeMessageCount,
        workingMemory: retryRollback.activeWorkingMemory,
        ...activeContextFilter,
        lastMessagePreview: retryRollback.activeLastMessagePreview,
        lastMessageAt: retryRollback.activeLastMessageAt,
      },
      [
        {
          $set: {
            messages: {
              $concatArrays: [
                { $slice: ["$messages", retryRollback.retainedMessageCount] },
                retryTail,
              ],
            },
            messageCount: restoreMessageCount,
            activeStreamId: null,
            activeStreamStartedAt: null,
            lastMessagePreview: retryRollback.lastMessagePreview,
            lastMessageAt: retryRollback.lastMessageAt,
            context: retryRollback.context,
            workingMemory: retryRollback.workingMemory,
            expiresAt: retryRollback.expiresAt,
            recentRequestIds: {
              $filter: {
                input: "$recentRequestIds",
                as: "recentRequestId",
                cond: { $ne: ["$$recentRequestId", requestKey] },
              },
            },
          },
        },
      ],
      { updatePipeline: true, runValidators: true },
    );
    return update.modifiedCount === 1;
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
  const {
    message,
    conversationId,
    retryOfMessageId,
    context,
    image,
    requestId,
    structuredAction,
  } = parsed.value;
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
      retryOfMessageId,
      requestKey: requestKeyContract.writeKey,
      requestLookupKeys: requestKeyContract.lookupKeys,
      message,
      image,
      structuredAction,
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
      res.setHeader("X-AI-Conversation-Id", String(conversation._id));
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
  res.setHeader("X-AI-Conversation-Id", String(conversation._id));
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
  let webSearchOutcome = "not_called";
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
          webSearchUsed: webSearchOutcome !== "not_called",
          webSearchOutcome,
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
  const equipmentLimitFallback =
    "Mình chưa thể tạo lịch tập đáp ứng chắc chắn giới hạn thiết bị này. Bạn thử lại và giữ yêu cầu chỉ dùng tạ đơn, dây kháng lực hoặc bodyweight nhé.";
  const genericToolFallback =
    "Mình chưa thể hoàn tất yêu cầu này. Bạn thử diễn đạt lại ngắn gọn hơn nhé.";
  const guardToolFallbackForDelivery = (candidate) => {
    const guarded = sanitizeAssistantOutput(candidate);
    if (guarded.protocolLeak || !guarded.content) return genericToolFallback;
    return validateWorkoutEquipmentOutput(message, guarded.content).valid
      ? guarded.content
      : equipmentLimitFallback;
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

    if (
      routingDecision.preferredTool === "calculate_tdee" &&
      !structuredAction
    ) {
      const intake = buildTdeeIntakeResponse(message);
      incrementMetric("provider.gemini_chat_not_required");
      responseModel = "server_tdee_intake_v1";
      aiLogger.chatStart(actorId, conversation._id);
      res.write(
        `data: ${JSON.stringify({ type: "ui_card", ...intake.uiCard })}\n\n`,
      );
      fullResponse = await deliverAssistantResponse(intake.text);
      generatedMessages.push({
        role: "assistant",
        content: fullResponse,
        uiCard: intake.uiCard,
        answerTrace: buildAnswerTrace(),
        timestamp: new Date(),
      });
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
    const rememberedTdeeResult = !compoundTdeeMeal &&
      canReuseTdeeForMealFollowUp(message) &&
      conversationMemory.lastTdee?.result
      ? { uiCard: { cardType: "tdee", data: conversationMemory.lastTdee.result } }
      : null;
    let completedTdeeResult = null;
    let completedCompoundMeal = false;
    const routedRequiredToolName = resolveRequiredReadOnlyToolName(
      routingDecision.preferredTool,
      routedTools,
    );
    const mixedWorkoutMealRequest =
      routingDecision.reasonCodes.includes("workout_creation") &&
      routedRequiredToolName === "suggest_meal";
    const mixedWorkoutMealInstruction =
      "Thực đơn từ công cụ là dữ liệu chuẩn và đã được hiển thị. Không viết lại hoặc thay đổi món, định lượng, macro hay tổng kcal; chỉ bổ sung giáo án tập luyện bằng văn bản theo đúng số ngày và thiết bị user yêu cầu.";
    let requiredToolConsumed = false;
    const getRequiredToolNameForIteration = () => {
      if (compoundTdeeMeal) {
        return completedTdeeResult && !completedCompoundMeal &&
          !requiredToolConsumed
          ? resolveRequiredReadOnlyToolName("suggest_meal", routedTools)
          : null;
      }
      return requiredToolConsumed ? null : routedRequiredToolName;
    };
    const getIterationTools = () => {
      if (routingDecision.webSearchRequired &&
          webSearchAttemptCount >= routingDecision.maxWebSearchCalls) return [];
      if (compoundTdeeMeal) {
        const nextToolName = completedCompoundMeal
          ? null
          : completedTdeeResult ? "suggest_meal" : "calculate_tdee";
        return routedTools.filter((tool) => tool?.function?.name === nextToolName);
      }
      if (routedRequiredToolName && requiredToolConsumed) return [];
      return routedTools;
    };
    let lastSuccessfulReadOnlyToolResult = null;
    let canonicalMixedWorkoutMealText = "";
    let mixedWorkoutRetryCount = 0;
    let equipmentRetryCount = 0;
    let scopeRetryCount = 0;
    const scopePreservationRequest = parseScopePreservationRequest(message);

    const executeServerRequiredTool = async (toolName, args) => {
      const call = {
        id: `server-${toolName}-${toolCallCount + 1}`,
        name: toolName,
        args,
      };
      res.write(`data: ${JSON.stringify({ type: "tool_start" })}\n\n`);
      const startedAt = Date.now();
      let toolResult = await executeTool(toolName, args, {
        userId,
        signal: abortController.signal,
        timeoutMs: TOOL_TIMEOUT_MS,
        allowedToolNames: [toolName],
        allowedPublicPersonNames,
        previousMealPlan: conversationMemory.lastMeal?.plan || null,
      });
      const durationMs = Date.now() - startedAt;
      const safeToolText = normalizePublicToolText(toolResult.text);
      const toolStatus = resolveToolResultStatus(toolResult);
      const toolSucceeded = isSuccessfulToolResult(toolResult);
      toolCallCount += 1;
      aiLogger.toolCall(actorId, toolName, durationMs, toolSucceeded);
      if (toolSucceeded) {
        toolResult = attachMealIdentity(toolName, toolResult);
        conversationMemory = updateConversationMemory(
          conversationMemory,
          toolName,
          args,
          toolResult,
        );
        if (
          toolRegistry[toolName]?.readOnly === true &&
          toolRegistry[toolName]?.requiresConfirmation !== true &&
          safeToolText
        ) {
          lastSuccessfulReadOnlyToolResult = {
            toolName,
            text: safeToolText,
          };
        }
      }
      res.write(`data: ${JSON.stringify({ type: "tool_result" })}\n\n`);
      if (toolResult.uiCard) {
        res.write(
          `data: ${JSON.stringify({ type: "ui_card", ...toolResult.uiCard })}\n\n`,
        );
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
          toolName,
          toolCallId: call.id,
          toolStatus,
          uiCard: toolResult.uiCard || null,
          timestamp: new Date(),
        },
      );
      return { call, toolResult, safeToolText, toolSucceeded };
    };

    // === AGENT LOOP (Pattern từ Dify fc_agent_runner.py) ===
    let iteration = 0;
    let protocolRetryCount = 0;
    aiLogger.chatStart(actorId, conversation._id);

    if (structuredAction?.type === "calculate_tdee") {
      const directTdee = await executeServerRequiredTool(
        "calculate_tdee",
        structuredAction.payload,
      );
      responseModel = "server_tdee_v1";
      requiredToolConsumed = true;
      const guardedTdee = sanitizeAssistantOutput(directTdee.safeToolText);
      fullResponse = await deliverAssistantResponse(
        guardedTdee.content || requiredToolMissingResponse("calculate_tdee").text,
      );
    } else if (routedRequiredToolName === "search_knowledge") {
      webSearchAttemptCount = 1;
      webSearchExecutionCount = 1;
      const directSearch = await executeServerRequiredTool(
        "search_knowledge",
        { query: externalKnowledgeQuery.query },
      );
      webSearchOutcome = [
        "not_called",
        "provider_error",
        "no_supported_source",
        "grounded",
      ].includes(directSearch.toolResult.meta?.searchOutcome)
        ? directSearch.toolResult.meta.searchOutcome
        : "provider_error";
      webSearchSources = Array.isArray(directSearch.toolResult.meta?.sources)
        ? directSearch.toolResult.meta.sources
        : [];
      webSearchEvidenceAvailable =
        directSearch.toolResult.meta?.evidenceAvailable === true &&
        webSearchSources.length > 0;
      responseModel = String(
        process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash",
      ).slice(0, 100);
      fullResponse = await deliverAssistantResponse(
        enforceEvidenceBoundary(directSearch.safeToolText),
      );
      requiredToolConsumed = true;
    } else if (!compoundTdeeMeal && routedRequiredToolName === "suggest_meal") {
      const rememberedMealArgs = rememberedTdeeResult
        ? canonicalCompoundMealArgs(
            rememberedTdeeResult,
            {},
            requestedDietPlan,
          )
        : {};
      const directMealRequest = buildCanonicalMealToolRequest(
        message,
        rememberedMealArgs || {},
        conversationMemory.lastMeal,
      );
      if (hasCompleteCanonicalMealArgs(directMealRequest.args)) {
        const directMeal = await executeServerRequiredTool(
          "suggest_meal",
          directMealRequest.args,
        );
        const guardedMeal = sanitizeAssistantOutput(directMeal.safeToolText);
        const mealContent = guardedMeal.protocolLeak || !guardedMeal.content
          ? requiredToolMissingResponse("suggest_meal").text
          : guardedMeal.content;
        requiredToolConsumed = true;
        if (mixedWorkoutMealRequest) {
          canonicalMixedWorkoutMealText = mealContent;
          llmMessages.push(
            {
              role: "assistant",
              content: "",
              tool_calls: [directMeal.call],
            },
            {
              role: "tool",
              content: serializeToolResultForModel({
                toolName: "suggest_meal",
                text: directMeal.safeToolText,
                status: resolveToolResultStatus(directMeal.toolResult),
              }),
              name: "suggest_meal",
              id: directMeal.call.id,
              toolResultEnvelope: true,
            },
            { role: "user", content: mixedWorkoutMealInstruction },
          );
        } else {
          responseModel = "server_meal_v1";
          fullResponse = await deliverAssistantResponse(mealContent);
        }
      }
    }

    let needsToolCall = !fullResponse;

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
      let iterationCanonicalMealText = "";
      const iterationRequiredToolName = getRequiredToolNameForIteration();
      const iterationTools = iterationRequiredToolName
        ? routedTools.filter(
            (tool) => tool?.function?.name === iterationRequiredToolName,
          )
        : getIterationTools();
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
        : llmStream(llmMessages, iterationTools, {
            signal: abortController.signal,
            requiredToolName: iterationRequiredToolName,
          });
      try {
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
            if (!iterationRequiredToolName) iterationText += chunk.content;
            break;

          case "tool_call":
            {
            // Mọi text phát trước function call chỉ là draft. Bỏ ngay cả khi
            // function call bị runtime policy từ chối để không lộ protocol nháp.
            iterationText = "";
            fullResponse = "";
            const requiredCandidates = iterationRequiredToolName
              ? chunk.toolCalls
                  .filter((call) => call.name === iterationRequiredToolName)
                  .slice(0, 1)
              : chunk.toolCalls;
            const runtimeBoundedToolCalls = boundAiToolCalls(
              requiredCandidates,
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
              .map((call) => {
                if (call.name === "search_knowledge") {
                  return {
                    ...call,
                    args: { query: externalKnowledgeQuery.query },
                  };
                }
                if (call.name === "search_exercises") {
                  return {
                    ...call,
                    args: canonicalExerciseArgs(message, call.args),
                  };
                }
                if (call.name === "suggest_meal") {
                  const compoundArgs =
                    (compoundTdeeMeal || rememberedTdeeResult)
                      ? canonicalCompoundMealArgs(
                          completedTdeeResult || rememberedTdeeResult,
                          call.args,
                          requestedDietPlan,
                        )
                      : call.args;
                  if (!compoundArgs) return { ...call, args: null };
                  return {
                    ...call,
                    args: buildCanonicalMealToolRequest(
                      message,
                      compoundArgs,
                      conversationMemory.lastMeal,
                    ).args,
                  };
                }
                return call;
              });
            const boundedToolCalls = compoundTdeeMeal
              ? eligibleToolCalls.slice(0, 1).filter((call) => call.args)
              : eligibleToolCalls.filter((call) =>
                  call.name !== "suggest_meal" || !rememberedTdeeResult || call.args,
                );
            if (boundedToolCalls.length === 0) {
              needsToolCall = false;
              if (!iterationRequiredToolName) {
                iterationText +=
                  "Mình đã đạt giới hạn xử lý công cụ cho yêu cầu này. Bạn hãy thử lại với một yêu cầu ngắn gọn hơn.";
              }
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
            if (iterationRequiredToolName) requiredToolConsumed = true;

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
                previousMealPlan: conversationMemory.lastMeal?.plan || null,
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
                        searchOutcome: "not_called",
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
              const safeToolText = normalizePublicToolText(toolResult.text);
              const modelToolContent = serializeToolResultForModel({
                toolName: call.name,
                text: safeToolText,
                status: resolveToolResultStatus(toolResult),
              });
              const toolStatus = resolveToolResultStatus(toolResult);
              if (call.name === "suggest_meal") {
                iterationCanonicalMealText = safeToolText ||
                  requiredToolMissingResponse("suggest_meal").text;
              }
              if (call.name === "search_knowledge") {
                iterationCompletedWebSearch = true;
                webSearchOutcome = [
                  "not_called",
                  "provider_error",
                  "no_supported_source",
                  "grounded",
                ].includes(toolResult.meta?.searchOutcome)
                  ? toolResult.meta.searchOutcome
                  : "provider_error";
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
                toolResult = attachMealIdentity(call.name, toolResult);
                conversationMemory = updateConversationMemory(
                  conversationMemory,
                  call.name,
                  call.args,
                  toolResult,
                );
                if (
                  toolRegistry[call.name]?.readOnly === true &&
                  toolRegistry[call.name]?.requiresConfirmation !== true &&
                  safeToolText
                ) {
                  lastSuccessfulReadOnlyToolResult = {
                    toolName: call.name,
                    text: safeToolText,
                  };
                }
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
              // Lưu tool call vào conversation
              completedToolMessages.push({
                role: "tool",
                content: safeToolText,
                toolName: call.name,
                toolCallId: call.id,
                toolStatus,
                uiCard: toolResult.uiCard,
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
      } catch (providerError) {
        if (
          scopeRetryCount > 0 &&
          !abortController.signal.aborted &&
          !deadlineExceeded
        ) {
          fullResponse = await deliverAssistantResponse(
            enforceEvidenceBoundary(
              buildScopePreservationFallback(scopePreservationRequest),
            ),
          );
          needsToolCall = false;
          break;
        }
        if (
          mixedWorkoutRetryCount > 0 &&
          canonicalMixedWorkoutMealText &&
          !abortController.signal.aborted &&
          !deadlineExceeded
        ) {
          fullResponse = await deliverAssistantResponse(
            enforceEvidenceBoundary(
              `${canonicalMixedWorkoutMealText}\n\n${MIXED_WORKOUT_FALLBACK}`,
            ),
          );
          needsToolCall = false;
          break;
        }
        if (
          lastSuccessfulReadOnlyToolResult &&
          !abortController.signal.aborted &&
          !deadlineExceeded
        ) {
          const safeFallback = guardToolFallbackForDelivery(
            lastSuccessfulReadOnlyToolResult.text,
          );
          fullResponse = await deliverAssistantResponse(
            enforceEvidenceBoundary(safeFallback),
          );
          needsToolCall = false;
          break;
        }
        if (
          equipmentRetryCount > 0 &&
          !abortController.signal.aborted &&
          !deadlineExceeded
        ) {
          fullResponse = await deliverAssistantResponse(
            enforceEvidenceBoundary(equipmentLimitFallback),
          );
          needsToolCall = false;
          break;
        }
        if (
          iterationRequiredToolName &&
          !iterationCalledTool &&
          !abortController.signal.aborted &&
          !deadlineExceeded
        ) {
          const missing = requiredToolMissingResponse(iterationRequiredToolName);
          if (missing.uiCard) {
            res.write(
              `data: ${JSON.stringify({ type: "ui_card", ...missing.uiCard })}\n\n`,
            );
          }
          fullResponse = await deliverAssistantResponse(
            enforceEvidenceBoundary(missing.text),
          );
          needsToolCall = false;
          break;
        }
        throw providerError;
      }

      if (abortController.signal.aborted) break;
      if (iterationCalledTool && iterationCanonicalMealText) {
        if (mixedWorkoutMealRequest) {
          canonicalMixedWorkoutMealText = iterationCanonicalMealText;
          llmMessages.push({
            role: "user",
            content: mixedWorkoutMealInstruction,
          });
          needsToolCall = true;
          continue;
        }
        const guardedMeal = sanitizeAssistantOutput(
          iterationCanonicalMealText,
        );
        fullResponse = await deliverAssistantResponse(
          guardedMeal.protocolLeak || !guardedMeal.content
            ? requiredToolMissingResponse("suggest_meal").text
            : guardedMeal.content,
        );
        needsToolCall = false;
        break;
      }
      if (iterationRequiredToolName && !iterationCalledTool) {
        const missing = requiredToolMissingResponse(iterationRequiredToolName);
        if (missing.uiCard) {
          res.write(
            `data: ${JSON.stringify({ type: "ui_card", ...missing.uiCard })}\n\n`,
          );
        }
        fullResponse = await deliverAssistantResponse(
          enforceEvidenceBoundary(missing.text),
        );
        needsToolCall = false;
        break;
      }
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

        const modelCandidateContent = guarded.content ||
          "Mình chưa thể hoàn tất yêu cầu này. Bạn thử diễn đạt lại ngắn gọn hơn nhé.";
        if (canonicalMixedWorkoutMealText) {
          const mixedWorkoutCheck = validateMixedWorkoutSupplementOutput(
            modelCandidateContent,
          );
          if (!mixedWorkoutCheck.valid) {
            if (mixedWorkoutRetryCount < 1) {
              mixedWorkoutRetryCount += 1;
              llmMessages.push({ role: "assistant", content: iterationText });
              llmMessages.push({
                role: "user",
                content: MIXED_WORKOUT_CORRECTION_INSTRUCTION,
              });
              needsToolCall = true;
              continue;
            }
            fullResponse = await deliverAssistantResponse(
              enforceEvidenceBoundary(
                `${canonicalMixedWorkoutMealText}\n\n${MIXED_WORKOUT_FALLBACK}`,
              ),
            );
            needsToolCall = false;
            break;
          }
        }
        const candidateContent = canonicalMixedWorkoutMealText
          ? `${canonicalMixedWorkoutMealText}\n\n${modelCandidateContent}`
          : modelCandidateContent;
        const scopeCheck = validateScopePreservationOutput(
          scopePreservationRequest,
          candidateContent,
        );
        if (!scopeCheck.valid) {
          if (scopeRetryCount < 1) {
            scopeRetryCount += 1;
            llmMessages.push({ role: "assistant", content: iterationText });
            llmMessages.push({
              role: "user",
              content: buildScopeCorrectionInstruction(
                scopePreservationRequest,
              ),
            });
            needsToolCall = true;
            continue;
          }
          fullResponse = await deliverAssistantResponse(
            enforceEvidenceBoundary(
              buildScopePreservationFallback(scopePreservationRequest),
            ),
          );
          needsToolCall = false;
          break;
        }
        const equipmentCheck = validateWorkoutEquipmentOutput(
          message,
          candidateContent,
        );
        if (!equipmentCheck.valid) {
          if (equipmentRetryCount < 1) {
            equipmentRetryCount += 1;
            llmMessages.push({ role: "assistant", content: iterationText });
            llmMessages.push({
              role: "user",
              content: EQUIPMENT_CORRECTION_INSTRUCTION,
            });
            needsToolCall = true;
            continue;
          }
          const safeEquipmentFallback =
            lastSuccessfulReadOnlyToolResult?.toolName === "search_exercises"
              ? guardToolFallbackForDelivery(
                  lastSuccessfulReadOnlyToolResult.text,
                )
              : equipmentLimitFallback;
          fullResponse = await deliverAssistantResponse(
            enforceEvidenceBoundary(safeEquipmentFallback),
          );
          needsToolCall = false;
          break;
        }
        const finalContent = enforceEvidenceBoundary(candidateContent);
        fullResponse = await deliverAssistantResponse(finalContent);
      }
    }

    if (
      !abortController.signal.aborted &&
      !fullResponse &&
      mixedWorkoutRetryCount > 0 &&
      canonicalMixedWorkoutMealText
    ) {
      fullResponse = await deliverAssistantResponse(
        enforceEvidenceBoundary(
          `${canonicalMixedWorkoutMealText}\n\n${MIXED_WORKOUT_FALLBACK}`,
        ),
      );
    }

    if (
      !abortController.signal.aborted &&
      !fullResponse &&
      scopeRetryCount > 0
    ) {
      fullResponse = await deliverAssistantResponse(
        enforceEvidenceBoundary(
          buildScopePreservationFallback(scopePreservationRequest),
        ),
      );
    }

    if (
      !abortController.signal.aborted &&
      !fullResponse &&
      equipmentRetryCount > 0
    ) {
      fullResponse = await deliverAssistantResponse(
        enforceEvidenceBoundary(equipmentLimitFallback),
      );
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
      lastSuccessfulReadOnlyToolResult?.text
    ) {
      safeLog.warn(
        "ai.tool_result_fallback",
        "Provider returned no text after tool call",
      );
      const guardedFallback = sanitizeAssistantOutput(
        lastSuccessfulReadOnlyToolResult.text,
      );
      if (guardedFallback.protocolLeak) {
        safeLog.warn(
          "ai.tool_result_fallback_blocked",
          "Tool fallback contained assistant protocol text",
        );
      }
      const fallbackContent = enforceEvidenceBoundary(
        guardToolFallbackForDelivery(lastSuccessfulReadOnlyToolResult.text),
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
        conversationId: conversation._id,
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
