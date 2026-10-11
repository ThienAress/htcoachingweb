import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";

const { llmStreamMock } = vi.hoisted(() => ({
  llmStreamMock: vi.fn(),
}));

vi.mock("../../services/ai/providers/index.js", () => ({
  llmStream: llmStreamMock,
}));

vi.mock("../../utils/safeLogger.js", () => ({
  safeLog: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { toolRegistry } from "../../services/ai/tools/toolRegistry.js";

let app;
const originalSuggestMealExecute = toolRegistry.suggest_meal.execute;

beforeAll(async () => {
  await setupTestDB();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
});

afterEach(async () => {
  toolRegistry.suggest_meal.execute = originalSuggestMealExecute;
  llmStreamMock.mockReset();
  vi.clearAllMocks();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("POST /api/ai/chat required foods", () => {
  it("carries a raw required food through the direct meal path and returns typed missing data", async () => {
    const { accessToken } = await createTestUser();
    toolRegistry.suggest_meal.execute = vi.fn().mockResolvedValue({
      text: "Chưa tìm thấy thực phẩm bắt buộc \"đậu phụ\" trong catalog phù hợp; mình không tự thay bằng món khác.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "missing_data",
          reason: "required_food_unavailable",
          meals: [],
          totals: null,
        },
      },
    });
    llmStreamMock.mockImplementation(() => {
      throw new Error("chat model must not run for a complete canonical meal request");
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Lập cho tôi thực đơn món Việt trong 1 ngày khoảng 2.200 kcal, ít nhất 140g protein, có cơm, cá, rau và đậu phụ; ghi grams và tổng macro.",
      requestId: "fca1e53f-635c-4c99-8c35-4d2b2119a1b4",
    });

    const capturedArgs = toolRegistry.suggest_meal.execute.mock.calls[0]?.[0];
    const streamedText = response.text.split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)))
      .filter((event) => event.type === "text")
      .map((event) => event.content || "")
      .join("");
    expect({
      status: response.status,
      providerCalls: llmStreamMock.mock.calls.length,
      requiredFoods: capturedArgs?.requiredFoods,
      streamedTypedReason: response.text.includes("required_food_unavailable"),
      streamedMissingText: streamedText.includes("Chưa tìm thấy thực phẩm bắt buộc"),
    }).toEqual({
      status: 200,
      providerCalls: 0,
      requiredFoods: ["com", "ca", "rau", "dau phu"],
      streamedTypedReason: true,
      streamedMissingText: true,
    });
  });

  it("preserves provider required foods through canonicalization before tool execution", async () => {
    const { accessToken } = await createTestUser();
    toolRegistry.suggest_meal.execute = vi.fn().mockResolvedValue({
      text: "Chưa tìm thấy thực phẩm bắt buộc \"cá hồi\" trong catalog phù hợp; mình không tự thay bằng món khác.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "missing_data",
          reason: "required_food_unavailable",
          meals: [],
          totals: null,
        },
      },
    });
    llmStreamMock.mockImplementation(async function* requiredFoodToolCall() {
      yield {
        type: "tool_call",
        toolCalls: [{
          id: "required-food-meal",
          name: "suggest_meal",
          args: {
            targetCalories: 2200,
            proteinGrams: 140,
            carbGrams: 250,
            fatGrams: 71.1,
            mealsPerDay: 3,
            requiredFoods: ["cá hồi"],
          },
        }],
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Gợi ý thực đơn theo mục tiêu của tôi.",
      requestId: "42810d7b-6f7e-4ea8-a7d0-777e31e95cc7",
    });

    expect({
      status: response.status,
      providerCalls: llmStreamMock.mock.calls.length,
      requiredFoods: toolRegistry.suggest_meal.execute.mock.calls[0]?.[0]
        ?.requiredFoods,
      streamedTypedReason: response.text.includes("required_food_unavailable"),
    }).toEqual({
      status: 200,
      providerCalls: 1,
      requiredFoods: ["ca hoi"],
      streamedTypedReason: true,
    });
  });
});
