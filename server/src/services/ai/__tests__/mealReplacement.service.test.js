import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../../__tests__/setup.js";
import ChatConversation from "../../../models/ChatConversation.js";
import Food from "../../../models/Food.js";
import { replaceConversationMealItem } from "../mealReplacement.service.js";

const OLD_MEAL_PLAN_ID = "11111111-1111-4111-8111-111111111111";
const CURRENT_MEAL_PLAN_ID = "22222222-2222-4222-8222-222222222222";
const REPLACEMENT_OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const NEXT_REPLACEMENT_OPERATION_ID = "44444444-4444-4444-8444-444444444444";

const reviewedProfile = () => ({
  reviewStatus: "reviewed",
  contains: [],
  mayContain: [],
  reviewedScopes: [],
  specificContains: [],
  sourceType: "official_database",
  sourceUrl: "https://fdc.nal.usda.gov/food-search/",
  reviewedAt: new Date("2026-09-01"),
});

beforeAll(setupTestDB);
afterEach(clearCollections);
afterAll(teardownTestDB);

describe("AI meal replacement persistence", () => {
  it("atomically updates only the owned current card and rejects stale revisions", async () => {
    const { user } = await createTestUser();
    const { user: otherUser } = await createTestUser({
      email: "meal-owner-other@example.test",
    });
    const [chicken, rice, oil, turkey] = await Food.insertMany([
      {
        label: "Ức gà replacement",
        protein: 31,
        carb: 0,
        fat: 3.6,
        calories: 156.4,
        allergenProfile: reviewedProfile(),
      },
      {
        label: "Cơm replacement",
        protein: 2.7,
        carb: 28,
        fat: 0.3,
        calories: 125.5,
        allergenProfile: reviewedProfile(),
      },
      {
        label: "Dầu replacement",
        protein: 0,
        carb: 0,
        fat: 100,
        calories: 900,
        allergenProfile: reviewedProfile(),
      },
      {
        label: "Ức gà tây replacement",
        protein: 31,
        carb: 0,
        fat: 3.6,
        calories: 156.4,
        allergenProfile: reviewedProfile(),
      },
    ]);
    const makeMeal = (index) => ({
      label: `Bữa ${index + 1}`,
      foods: [
        {
          foodId: String(chicken._id),
          name: chicken.label,
          amountGrams: 100,
          macros: { protein: 31, carb: 0, fat: 3.6 },
          calories: 156.4,
        },
        {
          foodId: String(rice._id),
          name: rice.label,
          amountGrams: 100,
          macros: { protein: 2.7, carb: 28, fat: 0.3 },
          calories: 125.5,
        },
        {
          foodId: String(oil._id),
          name: oil.label,
          amountGrams: 10,
          macros: { protein: 0, carb: 0, fat: 10 },
          calories: 90,
        },
      ],
      totals: { protein: 33.7, carb: 28, fat: 13.9, calories: 371.9 },
    });
    const plan = {
      status: "complete",
      targetCalories: 1500,
      targetToleranceCalories: 100,
      nutritionMethod: "server_calculated_4p_4c_9f",
      meals: Array.from({ length: 4 }, (_, index) => makeMeal(index)),
      totals: { protein: 134.8, carb: 112, fat: 55.6, calories: 1487.6 },
      targets: { minimumProteinGrams: 130 },
      mealPlanId: CURRENT_MEAL_PLAN_ID,
      mealRevision: 1,
    };
    const oldPlan = {
      ...plan,
      mealPlanId: OLD_MEAL_PLAN_ID,
      targetCalories: 1600,
    };
    const conversation = await ChatConversation.create({
      userId: user._id,
      messages: [
        {
          role: "tool",
          toolName: "suggest_meal",
          content: "Thực đơn cũ",
          uiCard: { cardType: "meal", data: oldPlan },
        },
        { role: "user", content: "Tính lại TDEE rồi tạo thực đơn mới" },
        {
          role: "tool",
          toolName: "suggest_meal",
          content: "Thực đơn đã tính",
          uiCard: { cardType: "meal", data: plan },
        },
      ],
      workingMemory: {
        lastMeal: {
          targetCalories: 1500,
          proteinGrams: 135,
          carbGrams: 112,
          fatGrams: 56,
          mealsPerDay: 4,
          targetToleranceCalories: 100,
          minimumProteinGrams: 130,
          plan,
          mealPlanId: CURRENT_MEAL_PLAN_ID,
          revision: 1,
        },
      },
    });

    await expect(
      replaceConversationMealItem({
        conversationId: conversation._id,
        ownerFilter: { userId: otherUser._id },
        operationId: REPLACEMENT_OPERATION_ID,
        mealPlanId: CURRENT_MEAL_PLAN_ID,
        expectedRevision: 1,
        mealIndex: 1,
        foodIndex: 0,
      }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      replaceConversationMealItem({
        conversationId: conversation._id,
        ownerFilter: { userId: user._id },
        operationId: REPLACEMENT_OPERATION_ID,
        mealPlanId: OLD_MEAL_PLAN_ID,
        expectedRevision: 1,
        mealIndex: 1,
        foodIndex: 0,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "AI_MEAL_REVISION_CONFLICT",
    });
    const untouched = await ChatConversation.findById(conversation._id).lean();
    expect(untouched.messages[0].uiCard.data.mealPlanId).toBe(OLD_MEAL_PLAN_ID);
    expect(untouched.messages[2].uiCard.data.mealPlanId).toBe(
      CURRENT_MEAL_PLAN_ID,
    );

    const replacementRequest = {
      conversationId: conversation._id,
      ownerFilter: { userId: user._id },
      operationId: REPLACEMENT_OPERATION_ID,
      mealPlanId: CURRENT_MEAL_PLAN_ID,
      expectedRevision: 1,
      mealIndex: 1,
      foodIndex: 0,
    };
    const concurrentResults = await Promise.all([
      replaceConversationMealItem(replacementRequest),
      replaceConversationMealItem(replacementRequest),
    ]);
    const result = concurrentResults.find((entry) => !entry.replayed);

    expect(result.card.data).toMatchObject({
      mealPlanId: CURRENT_MEAL_PLAN_ID,
      mealRevision: 2,
      replacement: {
        mealIndex: 1,
        foodIndex: 0,
        after: { foodId: String(turkey._id) },
      },
    });
    expect(concurrentResults.filter((entry) => entry.replayed)).toHaveLength(1);
    const persisted = await ChatConversation.findById(conversation._id).lean();
    expect(persisted.workingMemory.lastMeal.revision).toBe(2);
    expect(persisted.workingMemory.lastMeal.lastReplacementOperation).toEqual({
      operationId: REPLACEMENT_OPERATION_ID,
      mealPlanId: CURRENT_MEAL_PLAN_ID,
      expectedRevision: 1,
      mealIndex: 1,
      foodIndex: 0,
    });
    expect(persisted.messages[2].uiCard.data.mealRevision).toBe(2);
    expect(persisted.messages[2].uiCard.data.meals[0].foods[0].foodId)
      .toBe(String(chicken._id));
    expect(persisted.messages[2].uiCard.data.meals[1].foods[0].foodId)
      .toBe(String(turkey._id));

    const replayed = await replaceConversationMealItem({
      conversationId: conversation._id,
      ownerFilter: { userId: user._id },
      operationId: REPLACEMENT_OPERATION_ID,
      mealPlanId: CURRENT_MEAL_PLAN_ID,
      expectedRevision: 1,
      mealIndex: 1,
      foodIndex: 0,
    });
    expect(replayed).toMatchObject({
      replayed: true,
      card: { data: { mealRevision: 2 } },
    });

    await expect(
      replaceConversationMealItem({
        conversationId: conversation._id,
        ownerFilter: { userId: user._id },
        operationId: REPLACEMENT_OPERATION_ID,
        mealPlanId: CURRENT_MEAL_PLAN_ID,
        expectedRevision: 1,
        mealIndex: 2,
        foodIndex: 0,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "AI_MEAL_OPERATION_CONFLICT",
    });

    await expect(
      replaceConversationMealItem({
        conversationId: conversation._id,
        ownerFilter: { userId: user._id },
        operationId: NEXT_REPLACEMENT_OPERATION_ID,
        mealPlanId: CURRENT_MEAL_PLAN_ID,
        expectedRevision: 1,
        mealIndex: 1,
        foodIndex: 0,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "AI_MEAL_REVISION_CONFLICT",
      data: { card: { data: { mealRevision: 2 } } },
    });

  });
});
