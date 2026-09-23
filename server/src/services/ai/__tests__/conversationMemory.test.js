import { describe, expect, it } from "vitest";

import {
  deriveConversationMemory,
  updateConversationMemory,
} from "../conversationMemory.js";
import { buildSystemPrompt } from "../systemPrompt.js";

const tdeeArgs = {
  gender: "male",
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: "moderate",
  dailyMovement: "mostly_seated",
  steps: "under_5000",
  trainingFrequency: "five_plus",
  trainingDuration: "between_45_60",
  trainingIntensity: "moderate",
  goal: "fat_loss",
};

const tdeeCard = {
  cardType: "tdee",
  data: {
    bmr: 1699,
    tdee: 2633,
    targetCalories: 2333,
    adjustment: -300,
    macros: {
      "Moderate-carb": { protein: 175, carb: 204, fat: 91 },
    },
  },
};

const mealArgs = {
  targetCalories: 2500,
  proteinGrams: 170,
  carbGrams: 280,
  fatGrams: 78,
  mealsPerDay: 4,
  targetToleranceCalories: 100,
  minimumProteinGrams: 170,
  excludedFoods: ["whey"],
  excludedAllergens: ["peanut"],
  lactoseFree: true,
  requirePackageLabelSafety: true,
  budgetVndPerDay: 150000,
};
const MEAL_PLAN_ID = "11111111-1111-4111-8111-111111111111";
const NEXT_MEAL_PLAN_ID = "22222222-2222-4222-8222-222222222222";

const mealCard = {
  cardType: "meal",
  data: {
    status: "complete",
    mealPlanId: MEAL_PLAN_ID,
    mealRevision: 1,
    targetCalories: 2500,
    targetToleranceCalories: 100,
    nutritionMethod: "server_calculated_4p_4c_9f",
    targets: { minimumProteinGrams: 170 },
    meals: [{
      label: "Bữa sáng",
      foods: [
        {
          foodId: "chicken",
          name: "Ức gà",
          amountGrams: 137.5,
          macros: { protein: 42.6, carb: 0, fat: 5 },
          calories: 215.4,
        },
      ],
      totals: { protein: 42.6, carb: 0, fat: 5, calories: 215.4 },
    }],
    totals: { protein: 42.6, carb: 0, fat: 5, calories: 215.4 },
  },
};

describe("AI conversation working memory", () => {
  it("persists a validated single-meal calorie scope", () => {
    const oneMealArgs = { ...mealArgs, targetCalories: 650, mealsPerDay: 1, calorieScope: "per_meal" };
    const oneMealCard = {
      ...mealCard,
      data: { ...mealCard.data, targetCalories: 650, calorieScope: "per_meal" },
    };
    const memory = updateConversationMemory({}, "suggest_meal", oneMealArgs, { uiCard: oneMealCard });
    expect(memory.lastMeal).toMatchObject({ calorieScope: "per_meal", plan: { calorieScope: "per_meal", targetCalories: 650 } });
  });
  it("stores validated TDEE inputs and structured results", () => {
    const memory = updateConversationMemory(
      {},
      "calculate_tdee",
      tdeeArgs,
      { uiCard: tdeeCard },
    );

    expect(memory.lastTdee).toMatchObject({
      input: tdeeArgs,
      result: {
        tdee: 2633,
        targetCalories: 2333,
        macros: tdeeCard.data.macros,
      },
    });
  });

  it("does not trust legacy meal history without a complete structured card", () => {
    const memory = deriveConversationMemory([
      {
        role: "assistant",
        toolCalls: [{ name: "calculate_tdee", args: tdeeArgs }],
      },
      { role: "tool", toolName: "calculate_tdee", uiCard: tdeeCard },
      {
        role: "assistant",
        toolCalls: [{
          name: "suggest_meal",
          args: {
            targetCalories: 2333,
            proteinGrams: 175,
            carbGrams: 204,
            fatGrams: 91,
            mealsPerDay: 4,
          },
        }],
      },
      { role: "tool", toolName: "suggest_meal", content: "Thực đơn 4 bữa" },
    ]);

    expect(memory.lastMeal).toBeUndefined();
  });

  it("stores a bounded structured meal plan for scoped follow-ups", () => {
    const memory = updateConversationMemory(
      {},
      "suggest_meal",
      mealArgs,
      { uiCard: mealCard },
    );

    expect(memory.lastMeal).toMatchObject({
      ...mealArgs,
      plan: {
        status: "complete",
        nutritionMethod: "server_calculated_4p_4c_9f",
        meals: [{
          foods: [{ foodId: "chicken", amountGrams: 137.5 }],
        }],
      },
      mealPlanId: MEAL_PLAN_ID,
      revision: 1,
    });
  });

  it("replays a persisted meal card without incrementing its revision", () => {
    const stored = updateConversationMemory(
      {},
      "suggest_meal",
      mealArgs,
      { uiCard: mealCard },
    );
    const rebuilt = deriveConversationMemory(
      [
        {
          role: "assistant",
          toolCalls: [{ id: "meal-current", name: "suggest_meal", args: mealArgs }],
        },
        {
          role: "tool",
          toolName: "suggest_meal",
          toolCallId: "meal-current",
          uiCard: mealCard,
        },
        { role: "user", content: "Cảm ơn nhé" },
      ],
      stored,
    );

    expect(rebuilt.lastMeal).toMatchObject({
      mealPlanId: MEAL_PLAN_ID,
      revision: 1,
    });
  });

  it("reconstructs the latest meal identity after TDEE invalidates an older plan", () => {
    const nextMealCard = {
      ...mealCard,
      data: {
        ...mealCard.data,
        mealPlanId: NEXT_MEAL_PLAN_ID,
        mealRevision: 1,
        targetCalories: 2333,
      },
    };
    const nextMealArgs = { ...mealArgs, targetCalories: 2333 };
    const rebuilt = deriveConversationMemory([
      {
        role: "assistant",
        toolCalls: [{ id: "meal-old", name: "suggest_meal", args: mealArgs }],
      },
      {
        role: "tool",
        toolName: "suggest_meal",
        toolCallId: "meal-old",
        uiCard: mealCard,
      },
      {
        role: "assistant",
        toolCalls: [{ id: "tdee-new", name: "calculate_tdee", args: tdeeArgs }],
      },
      {
        role: "tool",
        toolName: "calculate_tdee",
        toolCallId: "tdee-new",
        uiCard: tdeeCard,
      },
      {
        role: "assistant",
        toolCalls: [{ id: "meal-new", name: "suggest_meal", args: nextMealArgs }],
      },
      {
        role: "tool",
        toolName: "suggest_meal",
        toolCallId: "meal-new",
        uiCard: nextMealCard,
      },
    ]);

    expect(rebuilt.lastMeal).toMatchObject({
      mealPlanId: NEXT_MEAL_PLAN_ID,
      revision: 1,
      targetCalories: 2333,
    });
  });

  it("drops malformed structured meal data instead of trusting persisted Mixed fields", () => {
    const memory = deriveConversationMemory([], {
      lastMeal: {
        ...mealArgs,
        plan: {
          ...mealCard.data,
          meals: [{
            ...mealCard.data.meals[0],
            foods: [{
              ...mealCard.data.meals[0].foods[0],
              amountGrams: Number.POSITIVE_INFINITY,
            }],
          }],
        },
      },
    });

    expect(memory.lastMeal.plan).toBeUndefined();
    expect(memory.lastMeal.targetCalories).toBe(2500);
  });

  it("keeps the previous complete meal when a later attempt returns missing_data", () => {
    const completeMemory = updateConversationMemory(
      {},
      "suggest_meal",
      mealArgs,
      { uiCard: mealCard },
    );
    const afterFailure = updateConversationMemory(
      completeMemory,
      "suggest_meal",
      { ...mealArgs, targetCalories: 2200 },
      {
        uiCard: {
          cardType: "meal",
          data: { status: "missing_data", meals: [], totals: null },
        },
      },
    );

    expect(afterFailure.lastMeal).toEqual(completeMemory.lastMeal);
  });

  it("pairs persisted meal results by tool call id before a same-name legacy call", () => {
    const memory = deriveConversationMemory([
      {
        role: "assistant",
        toolCalls: [
          { id: "meal-old", name: "suggest_meal", args: { ...mealArgs, targetCalories: 1800 } },
          { id: "meal-current", name: "suggest_meal", args: mealArgs },
        ],
      },
      {
        role: "tool",
        toolName: "suggest_meal",
        toolCallId: "meal-current",
        uiCard: mealCard,
      },
    ]);

    expect(memory.lastMeal).toMatchObject({
      targetCalories: 2500,
      plan: { targetCalories: 2500 },
    });
  });

  it("injects confirmed TDEE state so follow-ups do not ask again", () => {
    const memory = updateConversationMemory(
      {},
      "calculate_tdee",
      tdeeArgs,
      { uiCard: tdeeCard },
    );
    const prompt = buildSystemPrompt({ conversationMemory: memory });

    expect(prompt).toContain("Calo mục tiêu đã xác nhận: 2333 kcal/ngày");
    expect(prompt).toContain("không hỏi lại các thông số trên");
  });

  it("retains all activity evidence for follow-up after tool history is truncated", () => {
    const memory = updateConversationMemory(
      {},
      "calculate_tdee",
      tdeeArgs,
      { uiCard: tdeeCard },
    );
    const recentHistoryWithoutToolCall = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Tin nhắn gần đây ${index + 1}`,
    }));
    const rebuilt = deriveConversationMemory(recentHistoryWithoutToolCall, memory);
    const prompt = buildSystemPrompt({ conversationMemory: rebuilt });

    expect([
      "dailyMovement=mostly_seated",
      "steps=under_5000",
      "trainingFrequency=five_plus",
      "trainingDuration=between_45_60",
      "trainingIntensity=moderate",
    ].every((evidence) => prompt.includes(evidence))).toBe(true);
  });

  it("invalidates legacy TDEE memory that lacks activity evidence", () => {
    const legacyMemory = {
      lastTdee: {
        input: {
          gender: "male",
          age: 30,
          heightCm: 175,
          weightKg: 75,
          activityLevel: "moderate",
          goal: "fat_loss",
        },
        result: tdeeCard.data,
      },
    };

    const rebuilt = deriveConversationMemory([], legacyMemory);
    const prompt = buildSystemPrompt({ conversationMemory: rebuilt });

    expect({
      lastTdee: rebuilt.lastTdee,
      containsUndefined: prompt.includes("undefined"),
      reusesUnconfirmedState: prompt.includes("không hỏi lại các thông số trên"),
    }).toEqual({
      lastTdee: undefined,
      containsUndefined: false,
      reusesUnconfirmedState: false,
    });
  });

  it("describes the current anonymous Meal Scan quota", () => {
    const prompt = buildSystemPrompt({ page: "/quet-mon-an" });

    expect(prompt).toContain("guest có 1 lượt dùng thử");
    expect(prompt).toContain("đăng nhập để nhận thêm 1 lượt");
    expect(prompt).toContain("khách coaching có 10 lượt/ngày + 300 lượt/30 ngày");
    expect(prompt).toContain("HLV có 20 lượt/ngày + 600 lượt/30 ngày");
    expect(prompt).not.toContain("cần đăng nhập và luôn kiểm tra lại khẩu phần");
  });

  it("uses a transparent common interpretation for a stable person identity", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("Nếu bạn đang nói Lisa của BLACKPINK");
    expect(prompt).toContain("chỉ hỏi lại khi có nhiều cách hiểu ngang nhau");
  });

  it("answers safe general questions while preserving the one-message quota rule", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("câu hỏi kiến thức chung an toàn và ổn định");
    expect(prompt).toMatch(/tin nhắn này vẫn được tính vào hạn mức/i);
    expect(prompt).toContain("dưới ô nhập");
    expect(prompt).not.toContain("cạnh tên HT Assistant");
    expect(prompt).toMatch(/không tự nêu số lượt AI Chat còn lại/i);
    expect(prompt).not.toContain("Mình tập trung vào tập luyện");
  });

  it("invalidates an old meal plan after TDEE is recalculated", () => {
    const memoryWithMeal = updateConversationMemory(
      {},
      "suggest_meal",
      {
        targetCalories: 2000,
        proteinGrams: 150,
        carbGrams: 180,
        fatGrams: 75,
        mealsPerDay: 4,
      },
    );

    const recalculated = updateConversationMemory(
      memoryWithMeal,
      "calculate_tdee",
      tdeeArgs,
      { uiCard: tdeeCard },
    );

    expect(recalculated.lastMeal).toBeUndefined();
  });
});
