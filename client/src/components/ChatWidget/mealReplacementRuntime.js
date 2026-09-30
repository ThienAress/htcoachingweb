const INTENT_FIELDS = [
  "mealPlanId",
  "expectedRevision",
  "mealIndex",
  "foodIndex",
];

const sameIntent = (left, right) =>
  INTENT_FIELDS.every((field) => left?.[field] === right?.[field]);

export const resolveMealReplacementAttempt = ({
  intent,
  pendingAttempt,
  createOperationId = () => globalThis.crypto.randomUUID(),
}) => {
  if (sameIntent(intent, pendingAttempt)) return pendingAttempt;
  return { ...intent, operationId: createOperationId() };
};

export const getReconciledMealData = (error, intent) => {
  const card = error?.response?.data?.data?.card;
  const data = card?.data;
  if (
    card?.cardType !== "meal" ||
    data?.mealPlanId !== intent.mealPlanId ||
    !Number.isSafeInteger(data?.mealRevision) ||
    data.mealRevision <= intent.expectedRevision ||
    !Array.isArray(data?.meals) ||
    data.meals.length === 0
  ) {
    return null;
  }
  return data;
};
