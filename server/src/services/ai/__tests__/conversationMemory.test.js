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

describe("AI conversation working memory", () => {
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

  it("rebuilds memory from persisted tool history for old documents", () => {
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

    expect(memory.lastMeal.mealsPerDay).toBe(4);
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
