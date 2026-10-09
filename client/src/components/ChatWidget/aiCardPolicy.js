export const ALLOWED_AI_UI_CARD_TYPES = new Set([
  "tdee",
  "tdeeForm",
  "exercise",
  "meal",
  "trainer",
  "wallet",
  "workoutPlan",
  "blogList",
  "webSources",
  "trainingSchedule",
  "checkinHistory",
  "gymInfo",
]);

export const isAllowedAiUiCard = (card) =>
  Boolean(
    card &&
      typeof card === "object" &&
      ALLOWED_AI_UI_CARD_TYPES.has(card.cardType) &&
      card.data &&
      typeof card.data === "object" &&
      !Array.isArray(card.data),
  );
