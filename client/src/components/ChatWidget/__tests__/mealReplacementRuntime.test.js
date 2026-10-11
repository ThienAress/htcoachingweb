import { describe, expect, it } from "vitest";

import {
  getReconciledMealData,
  resolveMealReplacementAttempt,
} from "../mealReplacementRuntime";

const intent = {
  mealPlanId: "11111111-1111-4111-8111-111111111111",
  expectedRevision: 1,
  mealIndex: 0,
  foodIndex: 1,
};

describe("meal replacement runtime", () => {
  it("reuses an operation id only while retrying the same intent", () => {
    const ids = [
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    const createOperationId = () => ids.shift();

    const first = resolveMealReplacementAttempt({
      intent,
      createOperationId,
    });
    const retry = resolveMealReplacementAttempt({
      intent,
      pendingAttempt: first,
      createOperationId,
    });
    const changedSelection = resolveMealReplacementAttempt({
      intent: { ...intent, foodIndex: 2 },
      pendingAttempt: first,
      createOperationId,
    });

    expect(retry.operationId).toBe(first.operationId);
    expect(changedSelection.operationId).not.toBe(first.operationId);
  });

  it("accepts only a newer owner-scoped card for the requested meal plan", () => {
    const currentData = {
      mealPlanId: intent.mealPlanId,
      mealRevision: 2,
      meals: [{ label: "Bữa sáng", foods: [{ name: "Ức gà tây" }] }],
    };
    const error = {
      response: {
        data: {
          data: { card: { cardType: "meal", data: currentData } },
        },
      },
    };

    expect(getReconciledMealData(error, intent)).toEqual(currentData);
    expect(
      getReconciledMealData(error, {
        ...intent,
        mealPlanId: "44444444-4444-4444-8444-444444444444",
      }),
    ).toBeNull();
  });
});
