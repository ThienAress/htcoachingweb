import { replaceConversationMealItem } from "../services/ai/mealReplacement.service.js";
import { safeLog } from "../utils/safeLogger.js";

export const replaceMealItem = async (req, res) => {
  const ownerFilter = req.user?.id
    ? { userId: req.user.id }
    : { guestKey: req.aiActor?.guestKey };
  if (!ownerFilter.userId && !ownerFilter.guestKey) {
    return res.status(401).json({
      success: false,
      code: "AI_ACTOR_REQUIRED",
      message: "Không thể xác định phiên trò chuyện.",
    });
  }

  try {
    const result = await replaceConversationMealItem({
      conversationId: req.params.id,
      ownerFilter,
      operationId: req.body.operationId,
      mealPlanId: req.body.mealPlanId,
      expectedRevision: req.body.expectedRevision,
      mealIndex: req.body.mealIndex,
      foodIndex: req.body.foodIndex,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    if (!error.isOperational) {
      safeLog.error("ai.meal_replacement_failed", error);
    }
    return res.status(error.status || 500).json({
      success: false,
      code: error.code || "AI_MEAL_REPLACEMENT_FAILED",
      message: error.isOperational
        ? error.message
        : "Không thể đổi món lúc này. Bạn vui lòng thử lại sau.",
      ...(error.isOperational && error.data && { data: error.data }),
    });
  }
};
