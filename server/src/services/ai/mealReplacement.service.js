import ChatConversation from "../../models/ChatConversation.js";
import { deriveConversationMemory } from "./conversationMemory.js";
import { replaceMealFood } from "./tools/suggestMeal.tool.js";

const operationalError = (status, code, message, data) =>
  Object.assign(new Error(message), {
    status,
    code,
    isOperational: true,
    ...(data && { data }),
  });

const replacementOperationMatches = (stored, requested) =>
  stored?.operationId === requested.operationId &&
  stored?.mealPlanId === requested.mealPlanId &&
  stored?.expectedRevision === requested.expectedRevision &&
  stored?.mealIndex === requested.mealIndex &&
  stored?.foodIndex === requested.foodIndex;

const findMealCard = (conversation, mealPlanId, revision) =>
  [...(conversation.messages || [])]
    .reverse()
    .find(
      (message) =>
        message.uiCard?.cardType === "meal" &&
        message.uiCard?.data?.mealPlanId === mealPlanId &&
        Number(message.uiCard?.data?.mealRevision) === revision,
    )?.uiCard || null;

const currentCardData = (conversation, currentMeal, requestedMealPlanId) => {
  if (
    !currentMeal?.plan ||
    currentMeal.mealPlanId !== requestedMealPlanId ||
    !Number.isInteger(currentMeal.revision)
  ) {
    return null;
  }
  const card = findMealCard(
    conversation,
    currentMeal.mealPlanId,
    currentMeal.revision,
  );
  return card ? { card } : null;
};

const replayCommittedOperation = (conversation, currentMeal, requested) => {
  const stored = currentMeal?.lastReplacementOperation;
  if (stored?.operationId !== requested.operationId) return null;
  const data = currentCardData(
    conversation,
    currentMeal,
    requested.mealPlanId,
  );
  if (!replacementOperationMatches(stored, requested)) {
    throw operationalError(
      409,
      "AI_MEAL_OPERATION_CONFLICT",
      "Mã thao tác này đã được dùng cho một yêu cầu đổi món khác.",
      data,
    );
  }
  if (!data?.card) return null;
  return {
    card: data.card,
    replacement: data.card.data.replacement,
    replayed: true,
  };
};

export async function replaceConversationMealItem({
  conversationId,
  ownerFilter,
  operationId,
  mealPlanId,
  expectedRevision,
  mealIndex,
  foodIndex,
}) {
  const conversation = await ChatConversation.findOne({
    _id: conversationId,
    ...ownerFilter,
  })
    .select("workingMemory messages._id messages.uiCard +activeStreamId")
    .lean();
  if (!conversation) {
    throw operationalError(
      404,
      "AI_MEAL_CONVERSATION_NOT_FOUND",
      "Không tìm thấy cuộc trò chuyện chứa thực đơn này.",
    );
  }
  if (conversation.activeStreamId) {
    throw operationalError(
      409,
      "AI_MEAL_CONVERSATION_BUSY",
      "Cuộc trò chuyện đang xử lý yêu cầu khác. Bạn thử lại sau một chút nhé.",
    );
  }

  const memory = deriveConversationMemory([], conversation.workingMemory);
  const currentMeal = memory.lastMeal;
  const requestedOperation = {
    operationId,
    mealPlanId,
    expectedRevision,
    mealIndex,
    foodIndex,
  };
  const replayed = replayCommittedOperation(
    conversation,
    currentMeal,
    requestedOperation,
  );
  if (replayed) return replayed;
  if (
    !currentMeal?.plan ||
    currentMeal.mealPlanId !== mealPlanId ||
    currentMeal.revision !== expectedRevision
  ) {
    throw operationalError(
      409,
      "AI_MEAL_REVISION_CONFLICT",
      "Thực đơn đã thay đổi. Hãy đồng bộ cuộc trò chuyện rồi chọn lại món.",
      currentCardData(conversation, currentMeal, mealPlanId),
    );
  }

  const messageIndex = [...(conversation.messages || [])]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) =>
      message.uiCard?.cardType === "meal" &&
      message.uiCard?.data?.mealPlanId === mealPlanId &&
      Number(message.uiCard?.data?.mealRevision) === expectedRevision)
    ?.index;
  if (messageIndex === undefined) {
    throw operationalError(
      409,
      "AI_MEAL_CARD_STALE",
      "Thẻ thực đơn này chưa hỗ trợ đổi món. Hãy tạo lại thực đơn mới nhé.",
    );
  }

  const replacement = await replaceMealFood(currentMeal, {
    previousMealPlan: currentMeal.plan,
    mealIndex,
    foodIndex,
  });
  if (replacement.uiCard?.data?.status !== "complete") {
    throw operationalError(
      422,
      "AI_MEAL_REPLACEMENT_UNAVAILABLE",
      replacement.text ||
        "Chưa tìm thấy món tương đương an toàn và đủ sát mục tiêu dinh dưỡng.",
    );
  }

  const nextRevision = expectedRevision + 1;
  const nextCard = {
    ...replacement.uiCard,
    data: {
      ...replacement.uiCard.data,
      mealPlanId,
      mealRevision: nextRevision,
    },
  };
  const targetMessage = conversation.messages[messageIndex];
  const update = await ChatConversation.updateOne(
    {
      _id: conversationId,
      ...ownerFilter,
      "workingMemory.lastMeal.mealPlanId": mealPlanId,
      "workingMemory.lastMeal.revision": expectedRevision,
      [`messages.${messageIndex}._id`]: targetMessage._id,
      [`messages.${messageIndex}.uiCard.data.mealPlanId`]: mealPlanId,
      [`messages.${messageIndex}.uiCard.data.mealRevision`]: expectedRevision,
      $or: [
        { activeStreamId: null },
        { activeStreamId: "" },
        { activeStreamId: { $exists: false } },
      ],
    },
    {
      $set: {
        "workingMemory.lastMeal": {
          ...currentMeal,
          plan: nextCard.data,
          revision: nextRevision,
          lastReplacementOperation: requestedOperation,
          updatedAt: new Date(),
        },
        [`messages.${messageIndex}.uiCard`]: nextCard,
      },
    },
    { runValidators: true },
  );
  if (update.modifiedCount !== 1) {
    const latestConversation = await ChatConversation.findOne({
      _id: conversationId,
      ...ownerFilter,
    })
      .select("workingMemory messages._id messages.uiCard +activeStreamId")
      .lean();
    const latestMemory = deriveConversationMemory(
      [],
      latestConversation?.workingMemory,
    );
    const concurrentReplay = latestConversation
      ? replayCommittedOperation(
          latestConversation,
          latestMemory.lastMeal,
          requestedOperation,
        )
      : null;
    if (concurrentReplay) return concurrentReplay;
    throw operationalError(
      409,
      "AI_MEAL_REVISION_CONFLICT",
      "Thực đơn vừa được cập nhật ở nơi khác. Hãy đồng bộ rồi thử lại.",
      latestConversation
        ? currentCardData(
            latestConversation,
            latestMemory.lastMeal,
            mealPlanId,
          )
        : null,
    );
  }

  return {
    card: nextCard,
    replacement: nextCard.data.replacement,
  };
}
