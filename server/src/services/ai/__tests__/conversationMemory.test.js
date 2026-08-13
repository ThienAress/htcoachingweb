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

    expect(prompt).toContain("guest có 2 lượt/24 giờ");
    expect(prompt).toContain("2 lượt/24 giờ");
    expect(prompt).toContain("user thường 3 lượt/24 giờ");
    expect(prompt).toContain("user có gói/HLV 10 lượt/24 giờ");
    expect(prompt).not.toContain("cần đăng nhập và luôn kiểm tra lại khẩu phần");
  });

  it("asks one clarifying question when a person name may be fitness-related", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain(
      "Nếu tên người hoặc chủ thể còn mơ hồ (ví dụ: \"Lisa là ai?\")",
    );
    expect(prompt).toContain("hỏi lại đúng 1 câu ngắn");
  });

  it("refuses clearly off-topic requests and points to quota below the input", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("thẩm mỹ viện này ở đâu");
    expect(prompt).toMatch(/tin nhắn này vẫn được tính vào hạn mức/i);
    expect(prompt).toContain("dưới ô nhập");
    expect(prompt).not.toContain("cạnh tên HT Assistant");
    expect(prompt).toMatch(/không tự nêu số lượt AI Chat còn lại/i);
    expect(prompt).toContain("lịch tập, tính TDEE hoặc gợi ý bữa ăn");
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
