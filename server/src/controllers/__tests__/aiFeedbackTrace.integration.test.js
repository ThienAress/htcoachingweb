import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import request from "supertest";
import mongoose from "mongoose";

const { llmStreamMock, searchKnowledgeBaseMock } = vi.hoisted(() => ({
  llmStreamMock: vi.fn(),
  searchKnowledgeBaseMock: vi.fn(async () => []),
}));

vi.mock("../../services/ai/providers/index.js", () => ({
  llmStream: llmStreamMock,
}));

vi.mock("../../services/ai/embedding.service.js", () => ({
  searchKnowledgeBase: searchKnowledgeBaseMock,
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
import ChatConversation from "../../models/ChatConversation.js";
import Exercise from "../../models/Exercise.js";
import { toolRegistry } from "../../services/ai/tools/toolRegistry.js";
import { chatStream } from "../ai.controller.js";

let app;
const originalSuggestMealExecute = toolRegistry.suggest_meal.execute;
const originalSearchExercisesExecute = toolRegistry.search_exercises.execute;

beforeAll(async () => {
  await setupTestDB();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
});

beforeEach(() => {
  llmStreamMock.mockReset();
  searchKnowledgeBaseMock.mockReset();
  searchKnowledgeBaseMock.mockResolvedValue([]);
  llmStreamMock.mockImplementation(async function* streamMockResponse() {
    yield {
      type: "text",
      content:
        "Nếu bạn đang hỏi Lisa của BLACKPINK, cô ấy là một thành viên của nhóm.",
    };
  });
});

afterEach(async () => {
  toolRegistry.suggest_meal.execute = originalSuggestMealExecute;
  toolRegistry.search_exercises.execute = originalSearchExercisesExecute;
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await clearCollections();
});

afterAll(async () => {
  await teardownTestDB();
});

describe("AI answer trace and feedback review", () => {
  it("treats a complete meal tool result as the final answer authority", async () => {
    const { user, accessToken } = await createTestUser();
    toolRegistry.suggest_meal.execute = vi.fn().mockResolvedValue({
      text: "SERVER_CANONICAL_MEAL: 2500 kcal.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "complete",
          targetCalories: 2500,
          targetToleranceCalories: 100,
          nutritionMethod: "server_calculated_4p_4c_9f",
          targets: { minimumProteinGrams: 170 },
          meals: [{
            label: "Bữa sáng",
            foods: [{
              foodId: "synthetic-food",
              name: "Món kiểm thử",
              amountGrams: 100,
              macros: { protein: 170, carb: 250, fat: 91.1 },
              calories: 2499.9,
            }],
            totals: { protein: 170, carb: 250, fat: 91.1, calories: 2499.9 },
          }],
          totals: { protein: 170, carb: 250, fat: 91.1, calories: 2499.9 },
        },
      },
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* mealThenRewrite() {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "canonical-meal",
            name: "suggest_meal",
            args: {
              targetCalories: 2500,
              proteinGrams: 170,
              carbGrams: 250,
              fatGrams: 91.1,
              mealsPerDay: 4,
            },
          }],
        };
        return;
      }
      yield { type: "text", content: "MODEL_REWRITE: 3200 kcal và món khác." };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Gợi ý thực đơn cho tôi",
      requestId: "164ff640-9fd0-4be6-bcd8-d1e9342de101",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect({ status: response.status, providerTurn, answer: answer.content }).toEqual({
      status: 200,
      providerTurn: 1,
      answer: "SERVER_CANONICAL_MEAL: 2500 kcal.",
    });
    expect(response.text).not.toContain("MODEL_REWRITE");
  });

  it("renders meal missing_data directly instead of allowing a model workaround", async () => {
    const { user, accessToken } = await createTestUser();
    toolRegistry.suggest_meal.execute = vi.fn().mockResolvedValue({
      text: "SERVER_MEAL_MISSING: chưa đủ metadata dị ứng.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "missing_data",
          reason: "safety_metadata_missing",
          meals: [],
          totals: null,
        },
      },
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* missingThenUnsafeMeal() {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "missing-meal",
            name: "suggest_meal",
            args: {
              targetCalories: 2500,
              proteinGrams: 170,
              carbGrams: 250,
              fatGrams: 91.1,
            },
          }],
        };
        return;
      }
      yield { type: "text", content: "MODEL_UNSAFE_MEAL: cứ dùng sữa và đậu phộng." };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Gợi ý thực đơn cho tôi, tôi dị ứng sữa và đậu phộng",
      requestId: "164ff640-9fd0-4be6-bcd8-d1e9342de102",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect({ status: response.status, providerTurn, answer: answer.content }).toEqual({
      status: 200,
      providerTurn: 1,
      answer: "SERVER_MEAL_MISSING: chưa đủ metadata dị ứng.",
    });
    expect(response.text).not.toContain("MODEL_UNSAFE_MEAL");
  });

  it("executes a complete explicit meal request without calling the chat model", async () => {
    const { accessToken } = await createTestUser();
    toolRegistry.suggest_meal.execute = vi.fn().mockResolvedValue({
      text: "SERVER_DIRECT_MEAL: 2500 kcal, 4 bữa, 170g protein.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "missing_data",
          reason: "synthetic_direct_test",
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
      message:
        "Lập thực đơn 2.500 kcal, sai số tối đa 100 kcal, ít nhất 170g protein, chia 4 bữa.",
      requestId: "164ff640-9fd0-4be6-bcd8-d1e9342de103",
    });

    expect(response.status).toBe(200);
    expect(llmStreamMock).not.toHaveBeenCalled();
    expect(toolRegistry.suggest_meal.execute).toHaveBeenCalledTimes(1);
    const streamedText = response.text
      .split("\n\n")
      .filter((event) => event.startsWith("data: "))
      .map((event) => JSON.parse(event.slice(6)))
      .filter((event) => event.type === "text")
      .map((event) => event.content)
      .join("");
    expect(streamedText).toContain("SERVER_DIRECT_MEAL");
  });

  it("does not accept prose in place of the mandatory TDEE tool", async () => {
    const { user, accessToken } = await createTestUser();
    let requiredToolName;
    llmStreamMock.mockImplementationOnce(async function* inventedTdee(
      _messages,
      _tools,
      options,
    ) {
      requiredToolName = options.requiredToolName;
      yield { type: "text", content: "TDEE của bạn chắc chắn là 2500 kcal." };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tính TDEE của tôi",
      requestId: "164ff640-9fd0-4be6-bcd8-d1e9342de104",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(requiredToolName).toBe("calculate_tdee");
    expect(answer.content).toMatch(/TDEE là một ước tính.*chưa đủ dữ liệu/is);
    expect(answer.content).toMatch(/tối đa 5 nhóm/i);
    expect(answer.content).not.toMatch(/TDEE chính xác/i);
    expect(answer.content).not.toContain("2500");
    expect(response.status).toBe(200);
  });

  it.each(["provider_error", "double_invalid", "empty_final"])(
    "guards an unsafe workout draft at the final delivery boundary: %s",
    async (scenario) => {
      const { user, accessToken } = await createTestUser();
      toolRegistry.search_exercises.execute = vi.fn();
      let providerTurn = 0;
      llmStreamMock.mockImplementation(async function* unsafeFallbackFlow() {
        providerTurn += 1;
        if (providerTurn === 1) {
          yield {
            type: "text",
            content: "Dumbbell Chest Press trên ghế và Cable Chest Fly — 4 hiệp.",
          };
          return;
        }
        if (scenario === "provider_error") {
          throw Object.assign(new Error("synthetic provider outage"), { status: 503 });
        }
        if (scenario === "double_invalid" && providerTurn <= 3) {
          yield { type: "text", content: "Dumbbell Chest Press — 4 hiệp." };
        }
      });

      const response = await withAuth(
        request(app).post("/api/ai/chat"),
        accessToken,
      ).send({
        message:
          "Tạo lịch tăng cơ 4 ngày/tuần, chỉ có tạ đơn và dây kháng lực.",
        requestId: {
          provider_error: "164ff640-9fd0-4be6-bcd8-d1e9342de105",
          double_invalid: "164ff640-9fd0-4be6-bcd8-d1e9342de106",
          empty_final: "164ff640-9fd0-4be6-bcd8-d1e9342de107",
        }[scenario],
      });
      const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
      const answer = conversation.messages.find(
        (item) => item.role === "assistant" && item.content,
      );

      expect(response.status).toBe(200);
      expect(toolRegistry.search_exercises.execute).not.toHaveBeenCalled();
      expect(response.text).not.toContain('"type":"ui_card"');
      expect(answer.content).not.toContain("Dumbbell Chest Press");
      expect(answer.content).toMatch(/chưa thể tạo lịch tập.*giới hạn thiết bị/i);
    },
  );

  it("answers stable general knowledge without Knowledge Base retrieval and stores bounded trace", async () => {
    const { user, accessToken } = await createTestUser();

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Lisa là ai?",
      requestId: "bfa5d0a6-a3b7-4d9e-9109-bf15df156f91",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );

    expect(response.status).toBe(200);
    expect(response.text.match(/"type":"text"/g)?.length).toBeGreaterThan(1);
    expect(searchKnowledgeBaseMock).not.toHaveBeenCalled();
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "general",
      evidenceMode: "model_prior",
      kbEntryIds: [],
      webSearchUsed: false,
    });
    expect(answer.answerTrace.model).toMatch(/flash-lite/);
    expect(answer.answerTrace.promptVersion).toMatch(/^2026-/);
    expect(JSON.stringify(answer.answerTrace)).not.toContain("Lisa");
  });

  it("exposes only TDEE before a compound meal request has canonical results", async () => {
    const { accessToken } = await createTestUser();
    let exposedTools = [];
    llmStreamMock.mockImplementationOnce(async function* compoundToolResponse(
      _messages,
      tools,
    ) {
      exposedTools = tools.map((tool) => tool.function.name);
      yield {
        type: "text",
        content: "Mình cần số đo của bạn để tính TDEE trước khi gợi ý thực đơn.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tính TDEE rồi gợi ý thực đơn cho tôi",
      requestId: "bfa5d0a6-a3b7-4d9e-9109-bf15df156f92",
    });

    expect({ status: response.status, exposedTools }).toEqual({
      status: 200,
      exposedTools: ["calculate_tdee"],
    });
  });

  it("runs a compound meal only after successful TDEE and replaces invented macros", async () => {
    const { user, accessToken } = await createTestUser();
    const toolNamesByTurn = [];
    const validTdeeArgs = {
      gender: "male",
      age: 30,
      heightCm: 180,
      weightKg: 80,
      goal: "maintenance",
      dailyMovement: "mostly_seated",
      steps: "under_5000",
      trainingFrequency: "none",
      trainingDuration: "none",
      trainingIntensity: "none",
    };
    llmStreamMock.mockImplementation(async function* compoundResponse(_messages, tools) {
      toolNamesByTurn.push(tools.map((tool) => tool.function.name));
      if (toolNamesByTurn.length === 1) {
        yield {
          type: "tool_call",
          toolCalls: [
            { id: "tdee-1", name: "calculate_tdee", args: validTdeeArgs },
            {
              id: "premature-meal",
              name: "suggest_meal",
              args: { targetCalories: 6000, proteinGrams: 500, carbGrams: 1000, fatGrams: 300 },
            },
          ],
        };
      } else if (toolNamesByTurn.length === 2) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "meal-1",
            name: "suggest_meal",
            args: { targetCalories: 6000, proteinGrams: 500, carbGrams: 1000, fatGrams: 300, mealsPerDay: 4 },
          }],
        };
      } else {
        yield { type: "text", content: "TDEE và thực đơn đã được tính theo số liệu chuẩn." };
      }
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tính TDEE rồi gợi ý thực đơn cho tôi",
      requestId: "bfa5d0a6-a3b7-4d9e-9109-bf15df156f93",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const tdeeCard = conversation.messages.find((message) =>
      message.role === "tool" && message.toolName === "calculate_tdee",
    )?.uiCard;
    const mealCall = conversation.messages.flatMap((message) => message.toolCalls || [])
      .find((call) => call.name === "suggest_meal");
    const moderateMacros = tdeeCard?.data?.macros?.["Moderate-carb"];

    expect({
      status: response.status,
      toolNamesByTurn,
      mealCalls: conversation.messages.flatMap((message) => message.toolCalls || [])
        .filter((call) => call.name === "suggest_meal").length,
      mealArgs: mealCall?.args,
    }).toEqual({
      status: 200,
      toolNamesByTurn: [["calculate_tdee"], ["suggest_meal"]],
      mealCalls: 1,
      mealArgs: {
        targetCalories: tdeeCard?.data?.targetCalories,
        proteinGrams: moderateMacros?.protein,
        carbGrams: moderateMacros?.carb,
        fatGrams: moderateMacros?.fat,
        mealsPerDay: 4,
      },
    });
  });

  it.each([
    {
      plan: "Low-carb",
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b1",
      expectedMacros: { proteinGrams: 214, carbGrams: 107, fatGrams: 95 },
    },
    {
      plan: "High-carb",
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b2",
      expectedMacros: { proteinGrams: 160, carbGrams: 267, fatGrams: 47 },
    },
    {
      plan: "negated Low-carb",
      message: "Tính TDEE rồi gợi ý thực đơn, không Low-carb cho tôi",
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b3",
      expectedMacros: { proteinGrams: 160, carbGrams: 187, fatGrams: 83 },
    },
    {
      plan: "negated Low-carb in a longer clause",
      message: "Tính TDEE rồi gợi ý thực đơn, tôi không muốn chế độ ăn Low-carb",
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b7",
      expectedMacros: { proteinGrams: 160, carbGrams: 187, fatGrams: 83 },
    },
    {
      plan: "quoted Low-carb example",
      message: 'Tính TDEE rồi gợi ý thực đơn, "Low-carb" chỉ là ví dụ',
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b4",
      expectedMacros: { proteinGrams: 160, carbGrams: 187, fatGrams: 83 },
    },
    {
      plan: "affirmative quoted Low-carb",
      message: 'Tính TDEE rồi gợi ý thực đơn "Low-carb" cho tôi',
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b6",
      expectedMacros: { proteinGrams: 214, carbGrams: 107, fatGrams: 95 },
    },
    {
      plan: "High-carb after negated Low-carb",
      message: "Tính TDEE rồi gợi ý thực đơn, không Low-carb mà High-carb cho tôi",
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b5",
      expectedMacros: { proteinGrams: 160, carbGrams: 267, fatGrams: 47 },
    },
    {
      plan: "High-carb after rejecting Low-carb",
      message: "Tính TDEE rồi gợi ý thực đơn: Low-carb không phù hợp, hãy chọn High-carb",
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b8",
      expectedMacros: { proteinGrams: 160, carbGrams: 267, fatGrams: 47 },
    },
    {
      plan: "High-carb instead of Low-carb",
      message: "Tính TDEE rồi gợi ý thực đơn High-carb thay vì Low-carb",
      requestId: "7ef20414-8c01-47d4-b339-e8b5db8463b9",
      expectedMacros: { proteinGrams: 160, carbGrams: 267, fatGrams: 47 },
    },
  ])("keeps explicit $plan preference when model invents meal macros", async ({
    plan,
    message,
    requestId,
    expectedMacros,
  }) => {
    const { user, accessToken } = await createTestUser();
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* compoundResponse() {
      providerTurn++;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "tdee-1",
            name: "calculate_tdee",
            args: {
              gender: "male",
              age: 30,
              heightCm: 180,
              weightKg: 80,
              goal: "maintenance",
              dailyMovement: "mostly_seated",
              steps: "under_5000",
              trainingFrequency: "none",
              trainingDuration: "none",
              trainingIntensity: "none",
            },
          }],
        };
      } else if (providerTurn === 2) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "meal-1",
            name: "suggest_meal",
            args: {
              targetCalories: 6000,
              proteinGrams: 500,
              carbGrams: 1000,
              fatGrams: 300,
              mealsPerDay: 4,
            },
          }],
        };
      } else {
        yield { type: "text", content: "Đã tạo thực đơn theo TDEE." };
      }
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: message || `Tính TDEE rồi gợi ý thực đơn ${plan} cho tôi`,
      requestId,
    });
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const mealCall = conversation.messages.flatMap((item) => item.toolCalls || [])
      .find((call) => call.name === "suggest_meal");

    expect({ status: response.status, providerTurn, mealArgs: mealCall?.args }).toEqual({
      status: 200,
      providerTurn: 2,
      mealArgs: { targetCalories: 2136, ...expectedMacros, mealsPerDay: 4 },
    });
  });

  it("never unlocks a compound meal after TDEE validation fails", async () => {
    const { user, accessToken } = await createTestUser();
    const toolNamesByTurn = [];
    llmStreamMock.mockImplementation(async function* invalidTdeeResponse(_messages, tools) {
      toolNamesByTurn.push(tools.map((tool) => tool.function.name));
      if (toolNamesByTurn.length === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{ id: "invalid-tdee", name: "calculate_tdee", args: {} }],
        };
      } else {
        yield { type: "text", content: "Mình cần đủ số đo và mức vận động trước." };
      }
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tính TDEE rồi gợi ý thực đơn Low-carb cho tôi",
      requestId: "bfa5d0a6-a3b7-4d9e-9109-bf15df156f94",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();

    expect({
      status: response.status,
      toolNamesByTurn,
      mealCalls: conversation.messages.flatMap((message) => message.toolCalls || [])
        .filter((call) => call.name === "suggest_meal").length,
    }).toEqual({
      status: 200,
      toolNamesByTurn: [["calculate_tdee"], ["calculate_tdee"]],
      mealCalls: 0,
    });
  });

  it("uses stored canonical TDEE macros for an explicit High-carb meal follow-up", async () => {
    const { user, accessToken } = await createTestUser();
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* twoTurnMealResponse() {
      providerTurn++;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "initial-tdee",
            name: "calculate_tdee",
            args: {
              gender: "male",
              age: 30,
              heightCm: 180,
              weightKg: 80,
              goal: "maintenance",
              dailyMovement: "mostly_seated",
              steps: "under_5000",
              trainingFrequency: "none",
              trainingDuration: "none",
              trainingIntensity: "none",
            },
          }],
        };
      } else if (providerTurn === 3) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "follow-up-meal",
            name: "suggest_meal",
            args: {
              targetCalories: 6000,
              proteinGrams: 500,
              carbGrams: 1000,
              fatGrams: 300,
              mealsPerDay: 4,
            },
          }],
        };
      } else {
        yield { type: "text", content: "Đã tính xong." };
      }
    });

    await withAuth(request(app).post("/api/ai/chat"), accessToken).send({
      message: "Tính TDEE cho tôi",
      requestId: "d4acfe6d-a083-46e4-9479-b84cc7601301",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken).send({
      message: "Gợi ý thực đơn High-carb cho tôi với 4 bữa",
      conversationId: conversation._id,
      requestId: "d4acfe6d-a083-46e4-9479-b84cc7601302",
    });
    const updated = await ChatConversation.findById(conversation._id).lean();
    const mealCall = updated.messages.flatMap((item) => item.toolCalls || [])
      .find((call) => call.name === "suggest_meal");

    expect({ status: response.status, providerTurn, mealArgs: mealCall?.args }).toEqual({
      status: 200,
      providerTurn: 2,
      mealArgs: {
        targetCalories: 2136,
        proteinGrams: 160,
        carbGrams: 267,
        fatGrams: 47,
        mealsPerDay: 4,
      },
    });
  });

  it.each([
    {
      scenario: "missing TDEE memory",
      requestId: "d4acfe6d-a083-46e4-9479-b84cc7601303",
      workingMemory: {},
    },
    {
      scenario: "invalid TDEE memory",
      requestId: "d4acfe6d-a083-46e4-9479-b84cc7601304",
      workingMemory: {
        lastTdee: {
          input: {
            gender: "male",
            age: 30,
            heightCm: 180,
            weightKg: 80,
            activityLevel: "sedentary",
            goal: "maintenance",
            dailyMovement: "mostly_seated",
            steps: "under_5000",
            trainingFrequency: "none",
            trainingDuration: "none",
            trainingIntensity: "none",
          },
          result: {
            bmr: 1780,
            tdee: 2136,
            targetCalories: 7000,
            adjustment: 0,
            macros: { "High-carb": { protein: 160, carb: 267, fat: 47 } },
          },
        },
      },
    },
    {
      scenario: "new weight and calorie target despite valid TDEE memory",
      requestId: "d4acfe6d-a083-46e4-9479-b84cc7601305",
      message: "Tôi giờ nặng 90kg, gợi ý thực đơn High-carb 1200 calo",
      workingMemory: {
        lastTdee: {
          input: {
            gender: "male",
            age: 30,
            heightCm: 180,
            weightKg: 80,
            activityLevel: "sedentary",
            goal: "maintenance",
            dailyMovement: "mostly_seated",
            steps: "under_5000",
            trainingFrequency: "none",
            trainingDuration: "none",
            trainingIntensity: "none",
          },
          result: {
            bmr: 1780,
            tdee: 2136,
            targetCalories: 2136,
            adjustment: 0,
            macros: { "High-carb": { protein: 160, carb: 267, fat: 47 } },
          },
        },
      },
      toolArgs: {
        targetCalories: 1200,
        proteinGrams: 90,
        carbGrams: 150,
        fatGrams: 27,
        mealsPerDay: 3,
      },
    },
  ])("leaves standalone meal arguments unchanged with $scenario", async ({
    requestId,
    message = "Gợi ý thực đơn High-carb cho tôi",
    workingMemory,
    toolArgs = {
      targetCalories: 1800,
      proteinGrams: 100,
      carbGrams: 200,
      fatGrams: 67,
      mealsPerDay: 3,
    },
  }) => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Meal without trusted TDEE",
      messages: [],
      messageCount: 0,
      workingMemory,
    });
    llmStreamMock.mockImplementationOnce(async function* standaloneMealResponse() {
      yield {
        type: "tool_call",
        toolCalls: [{
          id: "standalone-meal",
          name: "suggest_meal",
          args: toolArgs,
        }],
      };
    }).mockImplementationOnce(async function* standaloneMealAnswer() {
      yield { type: "text", content: "Đây là thực đơn gợi ý." };
    });

    const response = await withAuth(request(app).post("/api/ai/chat"), accessToken).send({
      message,
      conversationId: conversation._id,
      requestId,
    });
    const updated = await ChatConversation.findById(conversation._id).lean();
    const mealCall = updated.messages.flatMap((item) => item.toolCalls || [])
      .find((call) => call.name === "suggest_meal");
    expect({ status: response.status, mealArgs: mealCall?.args }).toEqual({
      status: 200,
      mealArgs: toolArgs,
    });
  });

  it("stores only the sanitized frames emitted before a client Stop", async () => {
    const { user } = await createTestUser();
    const finalAnswer =
      "Đây là câu trả lời đã sanitize đủ dài để được chia thành nhiều nhịp hiển thị, nhưng client sẽ dừng ngay sau nhịp đầu tiên.";
    llmStreamMock.mockImplementationOnce(async function* stoppedResponse() {
      yield { type: "text", content: finalAnswer };
    });
    const writes = [];
    let closeHandler = null;
    const response = {
      writableEnded: false,
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      on: vi.fn((event, handler) => {
        if (event === "close") closeHandler = handler;
      }),
      write: vi.fn((value) => {
        const serialized = String(value);
        writes.push(serialized);
        if (serialized.includes('"type":"text"')) closeHandler?.();
        return true;
      }),
      end: vi.fn(function end() {
        this.writableEnded = true;
      }),
      status: vi.fn(function status() {
        return this;
      }),
      json: vi.fn(function json() {
        this.writableEnded = true;
        return this;
      }),
    };

    await chatStream(
      {
        user: { id: String(user._id) },
        aiActor: { userId: String(user._id) },
        aiChatRequest: {
          value: {
            message: "Lisa là ai?",
            conversationId: null,
            context: {},
            image: null,
            requestId: "c28b7888-1474-48b9-982d-17ef8b90fda2",
          },
        },
      },
      response,
    );

    const textFrames = writes
      .flatMap((value) => value.split("\n\n"))
      .filter((event) => event.startsWith("data: "))
      .map((event) => JSON.parse(event.slice(6)))
      .filter((event) => event.type === "text");
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );

    expect(textFrames).toHaveLength(1);
    expect(answer.content).toBe(textFrames[0].content);
    expect(answer.content.length).toBeLessThan(finalAnswer.length);
    expect(writes.join("")).not.toContain('"type":"done"');
  });

  it("does not expose provider draft text before a runtime-rejected tool call", async () => {
    const { accessToken } = await createTestUser();
    llmStreamMock.mockImplementation(async function* rejectedToolDraft() {
      yield { type: "text", content: "RAW PROVIDER DRAFT MUST NOT LEAK" };
      yield {
        type: "tool_call",
        toolCalls: [
          {
            id: "forbidden-search",
            name: "search_knowledge",
            args: { query: "Lisa" },
          },
        ],
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Lisa là ai?",
      requestId: "3dde2ed9-99ae-4fc3-9147-94b44e93918e",
    });

    const streamedText = response.text
      .split("\n\n")
      .filter((event) => event.startsWith("data: "))
      .map((event) => JSON.parse(event.slice(6)))
      .filter((event) => event.type === "text")
      .map((event) => event.content)
      .join("");
    expect(response.status).toBe(200);
    expect(streamedText).not.toContain("RAW PROVIDER DRAFT MUST NOT LEAK");
    expect(streamedText).toContain("giới hạn xử lý công cụ");
  });

  it("retrieves internal evidence for exercise technique and stores only entry IDs", async () => {
    const { user, accessToken } = await createTestUser();
    let exposedTools = [];
    llmStreamMock.mockImplementationOnce(async function* routedExerciseResponse(
      _messages,
      tools,
    ) {
      exposedTools = tools.map((tool) => tool.function.name);
      yield { type: "text", content: "Giữ cột sống trung lập khi squat." };
    });
    const entryId = "507f191e810c19729de860ea";
    searchKnowledgeBaseMock.mockResolvedValueOnce([
      {
        _id: entryId,
        question: "Cách squat đúng kỹ thuật?",
        answer: "Giữ cột sống trung lập và kiểm soát biên độ phù hợp.",
        category: "training",
        similarity: 0.91,
      },
    ]);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Cách squat đúng kỹ thuật là gì?",
      requestId: "0ca66a61-4768-4cf7-862b-ce43154426aa",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    expect(response.status).toBe(200);
    expect(exposedTools).toEqual(["search_exercises"]);
    expect(searchKnowledgeBaseMock).toHaveBeenCalledWith(
      "Cách squat đúng kỹ thuật là gì?",
      { limit: 3, threshold: 0.75 },
    );
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "internal_kb",
      webSearchUsed: false,
    });
    expect(answer.answerTrace.kbEntryIds.map(String)).toEqual([entryId]);
    expect(JSON.stringify(answer.answerTrace)).not.toContain("cột sống");
  });

  it("appends a reviewed public KB citation when the provider omits its link", async () => {
    const { user, accessToken } = await createTestUser();
    const sourceUrl = "https://example.org/research/squat-technique";
    llmStreamMock.mockImplementationOnce(async function* responseWithoutCitation() {
      yield { type: "text", content: "Giữ cột sống trung lập khi squat." };
    });
    searchKnowledgeBaseMock.mockResolvedValueOnce([
      {
        _id: "507f191e810c19729de860ed",
        question: "Cách squat đúng kỹ thuật?",
        answer: "Giữ cột sống trung lập và kiểm soát biên độ phù hợp.",
        category: "training",
        similarity: 0.93,
        status: "published",
        evidenceLevel: "source_backed",
        reviewStatus: "reviewed",
        freshnessClass: "stable",
        reviewDueAt: "2099-01-01T00:00:00.000Z",
        sources: [
          {
            type: "research",
            title: "Synthetic squat technique reference",
            publisher: "Synthetic Sports Science Journal",
            url: sourceUrl,
            evidenceTier: "primary",
          },
        ],
      },
    ]);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Cách squat đúng kỹ thuật là gì?",
      requestId: "0ca66a61-4768-4cf7-862b-ce43154426ab",
    });

    const streamedText = response.text
      .split("\n\n")
      .filter((event) => event.startsWith("data: "))
      .map((event) => JSON.parse(event.slice(6)))
      .filter((event) => event.type === "text")
      .map((event) => event.content)
      .join("");
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );

    expect({
      status: response.status,
      streamedText,
      storedAnswer: answer.content,
    }).toEqual({
      status: 200,
      streamedText: expect.stringContaining(sourceUrl),
      storedAnswer: expect.stringContaining(sourceUrl),
    });
  });

  it("uses the previous user topic for a short Knowledge Base follow-up", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Contextual retrieval",
      messages: [
        { role: "user", content: "Tôi muốn tìm bài tập ngực với tạ đơn." },
        {
          role: "assistant",
          content: "Bạn có thể thử dumbbell bench press.",
        },
      ],
      messageCount: 2,
    });
    searchKnowledgeBaseMock.mockResolvedValueOnce([
      {
        _id: "507f191e810c19729de860ec",
        question: "Bài tập ngực với tạ đơn",
        answer: "Dumbbell fly là một lựa chọn bổ sung.",
        category: "training",
        similarity: 0.9,
      },
    ]);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Còn bài nào khác?",
      conversationId: conversation._id,
      requestId: "71c12536-fce0-44f0-8603-4fd06066f6bd",
    });

    expect(response.status).toBe(200);
    expect(searchKnowledgeBaseMock).toHaveBeenCalledWith(
      "Tôi muốn tìm bài tập ngực với tạ đơn.\nCòn bài nào khác?",
      { limit: 3, threshold: 0.75 },
    );
  });

  it("uses safe model-prior advice when a low-risk exercise lookup has no hit", async () => {
    const { user, accessToken } = await createTestUser();
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* emptyExerciseLookup(
      _messages,
      tools,
    ) {
      providerTurn += 1;
      if (providerTurn === 1) {
        expect(tools.map((tool) => tool.function.name)).toContain(
          "search_exercises",
        );
        yield {
          type: "tool_call",
          toolCalls: [
            {
              id: "empty-exercise-lookup",
              name: "search_exercises",
              args: { searchQuery: "bài chưa tồn tại", limit: 1 },
            },
          ],
        };
        return;
      }
      yield {
        type: "text",
        content: "Bản nháp model-prior không có bằng chứng nội bộ.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Cách tập đúng kỹ thuật với bài chưa có trong thư viện?",
      requestId: "26496538-8c69-48b1-865a-a0d74c547a73",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    expect(response.status).toBe(200);
    expect(providerTurn).toBe(2);
    expect(answer.content).toBe(
      "Bản nháp model-prior không có bằng chứng nội bộ.",
    );
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "model_prior",
      kbEntryIds: [],
      webSearchUsed: false,
    });
  });

  it("adjusts a structured 2.500 kcal meal to 2.200 using only rice and oil", async () => {
    const { user, accessToken } = await createTestUser();
    const plan = {
      status: "complete",
      targetCalories: 2500,
      targetToleranceCalories: 100,
      nutritionMethod: "server_calculated_4p_4c_9f",
      targets: { minimumProteinGrams: 170 },
      meals: Array.from({ length: 4 }, (_, index) => ({
        label: `Bữa ${index + 1}`,
        foods: [
          { foodId: "chicken", name: "Ức gà", amountGrams: 137.5, macros: { protein: 42.6, carb: 0, fat: 5 }, calories: 215.4 },
          { foodId: "rice", name: "Cơm trắng", amountGrams: 250, macros: { protein: 6.8, carb: 70, fat: 0.8 }, calories: 314.4 },
          { foodId: "oil", name: "Dầu ô liu", amountGrams: 12.5, macros: { protein: 0, carb: 0, fat: 12.5 }, calories: 112.5 },
        ],
        totals: { protein: 49.4, carb: 70, fat: 18.3, calories: 642.3 },
      })),
      totals: { protein: 197.6, carb: 280, fat: 73.2, calories: 2569.2 },
    };
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Structured meal follow-up",
      messages: [],
      messageCount: 0,
      workingMemory: {
        lastMeal: {
          targetCalories: 2500,
          proteinGrams: 170,
          carbGrams: 280,
          fatGrams: 78,
          mealsPerDay: 4,
          plan,
          revision: 1,
        },
      },
    });
    const reviewed = {
      reviewStatus: "reviewed",
      contains: [],
      mayContain: [],
      sourceType: "official_database",
      reviewedAt: new Date("2026-09-01"),
    };
    toolRegistry.suggest_meal.execute = vi.fn((params, context) =>
      originalSuggestMealExecute(params, {
        ...context,
        findFoods: async () => [
          { _id: "chicken", label: "Ức gà", protein: 31, carb: 0, fat: 3.6, allergenProfile: reviewed },
          { _id: "rice", label: "Cơm trắng", protein: 2.7, carb: 28, fat: 0.3, allergenProfile: reviewed },
          { _id: "oil", label: "Dầu ô liu", protein: 0, carb: 0, fat: 100, allergenProfile: reviewed },
        ],
      }));

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message:
        "Giữ nguyên các món và ít nhất 170g protein của thực đơn vừa rồi, nhưng hạ tổng xuống khoảng 2.200 kcal chỉ bằng cách đổi lượng cơm và dầu.",
      conversationId: conversation._id,
      requestId: "2edcc05d-dcbd-4b7a-99bc-50545c96139d",
    });
    const updated = await ChatConversation.findById(conversation._id).lean();
    const capturedArgs = toolRegistry.suggest_meal.execute.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(llmStreamMock).not.toHaveBeenCalled();
    expect(capturedArgs).toMatchObject({
      targetCalories: 2200,
      minimumProteinGrams: 170,
      allowedAdjustmentFoodIds: ["rice", "oil"],
      allowedAdjustmentFoodNames: ["Cơm trắng", "Dầu ô liu"],
    });
    expect(capturedArgs.allowedAdjustmentFoodIds).not.toContain("chicken");
    expect(updated.workingMemory.lastMeal.plan.meals.flatMap(
      (meal) => meal.foods,
    ).filter((food) => food.foodId === "chicken").every(
      (food) => food.amountGrams === 137.5,
    )).toBe(true);
  });

  it("keeps internal evidence attribution when the exercise catalog returns a hit", async () => {
    const { user, accessToken } = await createTestUser();
    await Exercise.create({
      name: "Incline Push Up",
      muscleGroup: "Cơ ngực",
      description: "Biến thể chống đẩy phù hợp để bắt đầu.",
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* catalogBackedAnswer() {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "exercise-catalog-hit",
            name: "search_exercises",
            args: { muscleGroup: "ngực", limit: 5 },
          }],
        };
        return;
      }
      yield {
        type: "text",
        content: "Bạn có thể bắt đầu với Incline Push Up.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tìm bài tập ngực cho người mới",
      requestId: "26496538-8c69-48b1-865a-a0d74c547a75",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    expect(response.status).toBe(200);
    expect(providerTurn).toBe(2);
    expect(answer.content).toMatch(/Incline Push Up/);
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "internal_kb",
      kbEntryIds: [],
      webSearchUsed: false,
    });
  });

  it("creates a constrained workout as text without emitting a flat exercise card", async () => {
    const { user, accessToken } = await createTestUser();
    toolRegistry.search_exercises.execute = vi.fn();
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* constrainedWorkout(
      messages,
      tools,
      options,
    ) {
      providerTurn += 1;
      if (providerTurn === 1) {
        expect(options.requiredToolName).toBeNull();
        expect(tools).toEqual([]);
        yield {
          type: "text",
          content: "Buổi 1: Barbell Bench Press và Cable Chest Fly.",
        };
        return;
      }
      expect(messages.at(-1).content).toMatch(/chỉ dùng tạ đơn.*dây kháng lực/i);
      yield {
        type: "text",
        content:
          "Buổi 1: Dumbbell Floor Press trên sàn. Buổi 2: Goblet Squat. Buổi 3: Resistance Band Row. Buổi 4: Dumbbell Romanian Deadlift.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message:
        "Tạo lịch tăng cơ 4 ngày/tuần cho người mới, chỉ có đôi tạ đơn điều chỉnh và dây kháng lực.",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29f4",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(providerTurn).toBe(2);
    expect(toolRegistry.search_exercises.execute).not.toHaveBeenCalled();
    expect(response.text).not.toContain('"type":"ui_card"');
    expect(conversation.messages.some((item) =>
      item.role === "tool" || item.toolCalls?.length > 0,
    )).toBe(false);
    expect(answer.content).toContain("Dumbbell Floor Press");
    expect(answer.content).not.toMatch(/barbell|cable/i);
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "model_prior",
      webSearchUsed: false,
    });
  });

  it("rejects meal rewrites and retries for a workout-only supplement in a mixed planning request", async () => {
    const { user, accessToken } = await createTestUser();
    toolRegistry.suggest_meal.execute = vi.fn().mockResolvedValue({
      text: "SERVER_CANONICAL_MEAL: tổng 2500 kcal.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "complete",
          targetCalories: 2500,
          meals: [],
          totals: { protein: 170, carb: 300, fat: 69, calories: 2501 },
        },
      },
      meta: { evidenceAvailable: true },
    });
    toolRegistry.search_exercises.execute = vi.fn();
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* mixedMealWorkout(
      messages,
      tools,
    ) {
      providerTurn += 1;
      if (providerTurn === 1) {
        expect(tools.map((tool) => tool.function.name)).toEqual([
          "suggest_meal",
        ]);
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "mixed-plan-meal",
            name: "suggest_meal",
            args: {
              targetCalories: 2500,
              proteinGrams: 170,
              carbGrams: 300,
              fatGrams: 69,
              mealsPerDay: 4,
            },
          }],
        };
        return;
      }
      if (providerTurn === 2) {
        expect(tools).toEqual([]);
        expect(messages.at(-1).content).toMatch(/chỉ bổ sung giáo án/i);
        yield {
          type: "text",
          content:
            "Bạn nên ăn mỗi ngày 2700. Giáo án 4 ngày: Buổi 1 Dumbbell Floor Press; Buổi 2 Goblet Squat.",
        };
        return;
      }
      expect(tools).toEqual([]);
      expect(messages.at(-1).content).toMatch(/không nhắc lại.*thực đơn|workout-only/iu);
      yield {
        type: "text",
        content:
          "Giáo án 4 ngày: Buổi 1 Dumbbell Floor Press; Buổi 2 Goblet Squat; Buổi 3 One-arm Dumbbell Row; Buổi 4 Dumbbell Romanian Deadlift.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tạo thực đơn 2500 kcal và lịch tập 4 ngày với tạ đơn",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29f9",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(providerTurn).toBe(3);
    expect(toolRegistry.suggest_meal.execute).toHaveBeenCalledTimes(1);
    expect(toolRegistry.search_exercises.execute).not.toHaveBeenCalled();
    expect(answer.content).toContain("SERVER_CANONICAL_MEAL");
    expect(answer.content).toContain("Giáo án 4 ngày");
    expect(answer.content).not.toMatch(/ăn mỗi ngày 2700/i);
    expect(response.text).toContain('"cardType":"meal"');
    expect(response.text).not.toContain('"cardType":"exercise"');
  });

  it.each(["invalid_retry", "provider_error"])(
    "falls back without model-authored meal numbers when a mixed-request workout supplement ends with %s",
    async (scenario) => {
    const { user, accessToken } = await createTestUser();
    toolRegistry.suggest_meal.execute = vi.fn().mockResolvedValue({
      text: "SERVER_CANONICAL_MEAL: tổng 2500 kcal.",
      uiCard: {
        cardType: "meal",
        data: {
          status: "complete",
          targetCalories: 2500,
          meals: [],
          totals: { protein: 170, carb: 300, fat: 69, calories: 2501 },
        },
      },
      meta: { evidenceAvailable: true },
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* invalidMixedSupplement() {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "mixed-plan-fallback",
            name: "suggest_meal",
            args: {
              targetCalories: 2500,
              proteinGrams: 170,
              carbGrams: 300,
              fatGrams: 69,
              mealsPerDay: 4,
            },
          }],
        };
        return;
      }
      if (providerTurn === 3 && scenario === "provider_error") {
        const error = new Error("Gemini temporarily unavailable");
        error.status = 503;
        throw error;
      }
      yield {
        type: "text",
        content: providerTurn === 2
          ? "Mức nạp mỗi ngày là 2700. Lịch tập 4 ngày với Dumbbell Floor Press."
          : "Ăn mỗi ngày 2800. Lịch tập 4 ngày với Goblet Squat.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tạo thực đơn 2500 kcal và lịch tập 4 ngày với tạ đơn",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29fa",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(providerTurn).toBe(3);
    expect(answer.content).toContain("SERVER_CANONICAL_MEAL");
    expect(answer.content).not.toMatch(/2700|2800/i);
    expect(answer.content).toMatch(/chưa thể bổ sung giáo án|yêu cầu riêng phần lịch tập/iu);
    },
  );

  it("retries a deficit-only follow-up that silently changes the workout plan", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Scoped deficit update",
      messages: [
        {
          role: "user",
          content: "Lập kế hoạch giảm mỡ với mức thâm hụt 300 kcal.",
        },
        {
          role: "assistant",
          content:
            "Mức thâm hụt là 300 kcal. Lịch tập giữ ở 4 buổi mỗi tuần.",
        },
      ],
      messageCount: 2,
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* scopedDeficitFollowUp(
      messages,
    ) {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "text",
          content:
            "Đã đổi mức thâm hụt thành 700 kcal và giảm lịch tập từ 4 buổi xuống 3 buổi.",
        };
        return;
      }
      expect(messages.at(-1).content).toMatch(
        /chỉ thay đổi mức thâm hụt.*không viết lại lịch tập/iu,
      );
      yield {
        type: "text",
        content:
          "Đã đổi mức thâm hụt từ 300 kcal thành 700 kcal. Chỉ mức thâm hụt thay đổi; lịch tập và mọi phần khác giữ nguyên. Mức thâm hụt sâu có thể ảnh hưởng phục hồi; nếu bạn muốn, mình sẽ đánh giá riêng trước khi đổi lịch tập.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      conversationId: conversation._id.toString(),
      message:
        "Giữ nguyên toàn bộ kế hoạch vừa rồi nhưng đổi mức thâm hụt từ 300 kcal thành 700 kcal. Giải thích phần nào đã thay đổi.",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29f6",
    });
    const updated = await ChatConversation.findById(conversation._id).lean();
    const answer = updated.messages.at(-1);

    expect(response.status).toBe(200);
    expect(providerTurn).toBe(2);
    expect(answer.content).toMatch(/chỉ mức thâm hụt thay đổi/iu);
    expect(answer.content).toMatch(/lịch tập.*giữ nguyên/iu);
    expect(answer.content).not.toMatch(/giảm lịch tập từ 4 buổi xuống 3 buổi/iu);
  });

  it("enforces a generic keep-everything-else invariant outside deficit changes", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Scoped training frequency update",
      messages: [
        {
          role: "user",
          content: "Lập lịch tập 4 buổi mỗi tuần và giữ nguyên thực đơn hiện tại.",
        },
        {
          role: "assistant",
          content: "Lịch tập hiện có 4 buổi mỗi tuần; thực đơn và macro đã chốt.",
        },
      ],
      messageCount: 2,
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* scopedFrequencyFollowUp(
      messages,
    ) {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "text",
          content:
            "Đã giảm số buổi tập từ 4 xuống 3 và giảm protein 20g mỗi ngày.",
        };
        return;
      }
      expect(messages.at(-1).content).toMatch(
        /chỉ thay đổi số buổi tập từ 4 thành 3.*mọi phần khác giữ nguyên/iu,
      );
      yield {
        type: "text",
        content:
          "Đã đổi số buổi tập từ 4 thành 3. Chỉ số buổi tập thay đổi; mọi phần khác trong kế hoạch giữ nguyên.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      conversationId: conversation._id.toString(),
      message:
        "Giữ nguyên toàn bộ kế hoạch vừa rồi, chỉ giảm số buổi tập từ 4 xuống 3.",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29f8",
    });
    const updated = await ChatConversation.findById(conversation._id).lean();
    const answer = updated.messages.at(-1);

    expect(response.status).toBe(200);
    expect(providerTurn).toBe(2);
    expect(answer.content).toMatch(/chỉ số buổi tập thay đổi/iu);
    expect(answer.content).not.toMatch(/giảm protein/iu);
  });

  it("uses a bounded scope-preserving fallback when the correction retry loses the provider", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Scoped deficit provider fallback",
      messages: [
        { role: "user", content: "Lập kế hoạch với thâm hụt 300 kcal." },
        { role: "assistant", content: "Lịch tập 4 buổi, thâm hụt 300 kcal." },
      ],
      messageCount: 2,
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* failedScopeCorrection() {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "text",
          content:
            "Đã đổi thành 700 kcal và giảm lịch tập từ 4 buổi xuống 3 buổi.",
        };
        return;
      }
      throw Object.assign(new Error("provider unavailable"), {
        code: "GEMINI_HTTP_ERROR",
        status: 503,
      });
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      conversationId: conversation._id.toString(),
      message:
        "Giữ nguyên toàn bộ kế hoạch vừa rồi nhưng đổi mức thâm hụt từ 300 kcal thành 700 kcal. Giải thích phần nào đã thay đổi.",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29f7",
    });
    const updated = await ChatConversation.findById(conversation._id).lean();
    const answer = updated.messages.at(-1);

    expect(response.status).toBe(200);
    expect(response.text).toContain('"type":"done"');
    expect(response.text).not.toContain('"type":"error"');
    expect(providerTurn).toBe(2);
    expect(answer.content).toMatch(/chỉ mức thâm hụt thay đổi/iu);
    expect(answer.content).toMatch(/lịch tập.*giữ nguyên/iu);
    expect(answer.content).not.toMatch(/giảm lịch tập từ 4 buổi xuống 3 buổi/iu);
  });

  it("uses the successful read-only tool result when final synthesis fails", async () => {
    const { user, accessToken } = await createTestUser();
    await Exercise.create({
      name: "Incline Push Up",
      muscleGroup: "Cơ ngực",
      description: "Biến thể chống đẩy cho người mới.",
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* toolThenFailure() {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "tool-backed-fallback",
            name: "search_exercises",
            args: { muscleGroup: "ngực", limit: 5 },
          }],
        };
        return;
      }
      throw Object.assign(new Error("provider unavailable"), {
        code: "GEMINI_HTTP_ERROR",
        status: 503,
      });
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tìm 5 bài tập ngực cho người mới",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29f5",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(response.text).toContain('"type":"done"');
    expect(response.text).not.toContain('"type":"error"');
    expect(answer.content).toContain("Incline Push Up");
  });

  it("keeps a safe exercise tool result when equipment correction then loses the provider", async () => {
    const { user, accessToken } = await createTestUser();
    toolRegistry.search_exercises.execute = vi.fn().mockResolvedValue({
      text: "Tìm thấy 1 bài tập:\n1. Dumbbell Floor Press (Cơ ngực) — Nằm trên sàn và dùng tạ đơn.",
      uiCard: null,
      meta: { evidenceAvailable: true },
    });
    let providerTurn = 0;
    llmStreamMock.mockImplementation(async function* toolCorrectionThenFailure() {
      providerTurn += 1;
      if (providerTurn === 1) {
        yield {
          type: "tool_call",
          toolCalls: [{
            id: "safe-exercise-before-correction",
            name: "search_exercises",
            args: { muscleGroup: "ngực", limit: 1 },
          }],
        };
        return;
      }
      if (providerTurn === 2) {
        yield {
          type: "text",
          content: "Hãy tập Barbell Bench Press và Cable Chest Fly.",
        };
        return;
      }
      throw Object.assign(new Error("provider unavailable"), {
        code: "GEMINI_HTTP_ERROR",
        status: 503,
      });
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tìm bài tập ngực, tôi chỉ có tạ đơn và dây kháng lực",
      requestId: "d56e4315-1e7f-4743-a813-b05ae08f29f8",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(response.headers["x-ai-conversation-id"]).toBe(
      String(conversation._id),
    );
    expect(providerTurn).toBe(3);
    expect(answer.content).toContain("Dumbbell Floor Press");
    expect(answer.content).not.toMatch(/chưa thể tạo lịch tập/i);
  });

  it("rejects prose when a canonical exercise lookup skips the required tool", async () => {
    const { user, accessToken } = await createTestUser();
    let exposedTools = [];
    llmStreamMock.mockImplementationOnce(async function* directExerciseAnswer(
      _messages,
      tools,
    ) {
      exposedTools = tools.map((tool) => tool.function.name);
      yield {
        type: "text",
        content: "Bạn có thể bắt đầu với chống đẩy tường và chống đẩy gối.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tìm 5 bài tập ngực cho người mới",
      requestId: "26496538-8c69-48b1-865a-a0d74c547a74",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    expect(response.status).toBe(200);
    expect(exposedTools).toContain("search_exercises");
    expect(answer.content).toMatch(/chưa thể đối chiếu thư viện bài tập/i);
    expect(answer.content).not.toMatch(/chống đẩy tường/i);
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "internal_kb",
      kbEntryIds: [],
      webSearchUsed: false,
      webSearchOutcome: "not_called",
    });
  });

  it("keeps a low-risk fitness KB miss on the answer-first model path", async () => {
    const { user, accessToken } = await createTestUser();
    let exposedTools = [];
    llmStreamMock.mockImplementationOnce(async function* noHitResponse(
      _messages,
      tools,
    ) {
      exposedTools = tools.map((tool) => tool.function.name);
      yield { type: "text", content: "Unsupported model-prior draft." };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Tăng cơ hiệu quả thì nên tập luyện thế nào?",
      requestId: "9825011d-339e-425f-b4a5-f8427ed94d87",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    expect(response.status).toBe(200);
    expect(exposedTools).toEqual([]);
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "model_prior",
      webSearchUsed: false,
    });
    expect(answer.content).toBe("Unsupported model-prior draft.");
  });

  it("keeps a high-stakes fitness KB miss off web search and returns bounded education", async () => {
    const { user, accessToken } = await createTestUser();
    let exposedTools = [];
    llmStreamMock.mockImplementationOnce(async function* highStakesResponse(
      _messages,
      tools,
    ) {
      exposedTools = tools.map((tool) => tool.function.name);
      yield {
        type: "text",
        content:
          "Đây là thông tin giáo dục chung; bạn nên trao đổi với bác sĩ trước khi đổi chương trình tập.",
      };
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "HIV tập gì?",
      requestId: "a67e68dc-1379-4858-a7f0-32f7575ba528",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    expect(response.status).toBe(200);
    expect(exposedTools).toEqual([]);
    expect(searchKnowledgeBaseMock).not.toHaveBeenCalled();
    expect(answer.content).toMatch(/thông tin giáo dục chung/i);
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "model_prior",
      kbEntryIds: [],
      webSearchUsed: false,
    });
  });

  it.each([
    {
      message: "học viên Lan đang dùng Ozempic, nên tập cardio thế nào?",
      requestId: "45d16ba1-d582-4e77-8e3c-bb744c2abbe5",
    },
    {
      message: "client Jane has SpO2 88% and wants cardio advice",
      requestId: "45d16ba1-d582-4e77-8e3c-bb744c2abbe6",
    },
    {
      message: "học viên Lan được kê Ozempic, nên tập cardio thế nào?",
      requestId: "45d16ba1-d582-4e77-8e3c-bb744c2abbe7",
    },
    {
      message: "SpO2 của client Jane là 88%, latest research nói gì?",
      requestId: "45d16ba1-d582-4e77-8e3c-bb744c2abbe8",
    },
  ])("keeps structurally private clinical records out of embedding and web sinks: $message", async ({
    message,
    requestId,
  }) => {
    const { user, accessToken } = await createTestUser();
    let exposedTools = [];
    llmStreamMock.mockImplementationOnce(async function* privateRecordResponse(
      _messages,
      tools,
    ) {
      exposedTools = tools.map((tool) => tool.function.name);
      yield {
        type: "text",
        content:
          "Đây chỉ là thông tin giáo dục chung; hãy trao đổi với bác sĩ điều trị trước khi đổi chương trình tập.",
      };
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({ message, requestId });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );
    expect(response.status).toBe(200);
    expect(exposedTools).toEqual([]);
    expect(searchKnowledgeBaseMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(answer.answerTrace).toMatchObject({
      evidenceMode: "model_prior",
      kbEntryIds: [],
      webSearchUsed: false,
    });
  });

  it.each([
    {
      message: "Tôi đang đau ngực và khó thở, có nên tập tiếp không?",
      requestId: "1cc1f4ae-d82f-4e23-8588-d1c51d131fd4",
      expected: /dừng tập ngay[\s\S]*cấp cứu/i,
    },
    {
      message: "I am going to hurt myself.",
      requestId: "68d9cefd-c93b-4bbd-9434-0ff7d23439b5",
      expected: /(?:đừng|không) ở một mình[\s\S]*cấp cứu/i,
    },
  ])("short-circuits every external AI dependency for urgent safety: $message", async ({
    message,
    requestId,
    expected,
  }) => {
    const { user, accessToken } = await createTestUser();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message,
      requestId,
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );
    expect(response.status).toBe(200);
    expect(llmStreamMock).not.toHaveBeenCalled();
    expect(searchKnowledgeBaseMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(answer.content).toMatch(expected);
    expect(answer.answerTrace).toMatchObject({
      evidenceMode: "model_prior",
      webSearchUsed: false,
      model: "static_safety_v1",
    });
  });

  it.each([
    {
      tail: "Tôi đang đau ngực và khó thở.",
      requestId: "66e245c9-7825-46a8-8ce0-43cb166a0b51",
      expected: /dừng tập ngay[\s\S]*cấp cứu/i,
    },
    {
      tail: "I plan to overdose tonight.",
      requestId: "7afc4488-ac77-4d95-bb53-b111a15c93e5",
      expected: /(?:đừng|không) ở một mình[\s\S]*cấp cứu/i,
    },
  ])("scans the safety tail across the full accepted 8,000-character message: $tail", async ({
    tail,
    requestId,
    expected,
  }) => {
    const { user, accessToken } = await createTestUser();
    const prefix = "Ronaldo routine "
      .repeat(600)
      .slice(0, 8_000 - tail.length - 1);
    const message = `${prefix} ${tail}`;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({ message, requestId });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );
    expect(message).toHaveLength(8_000);
    expect(response.status).toBe(200);
    expect(llmStreamMock).not.toHaveBeenCalled();
    expect(searchKnowledgeBaseMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(answer.content).toMatch(expected);
  });

  it("terminates SSE when the deadline expires during conversation finalization", async () => {
    const { user } = await createTestUser();
    const writes = [];
    const response = {
      writableEnded: false,
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      on: vi.fn(),
      write: vi.fn((value) => {
        writes.push(String(value));
        return true;
      }),
      end: vi.fn(function end() {
        this.writableEnded = true;
      }),
      status: vi.fn(function status() {
        return this;
      }),
      json: vi.fn(function json() {
        this.writableEnded = true;
        return this;
      }),
    };
    const nativeSetTimeout = globalThis.setTimeout;
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback, delay, ...args) =>
        nativeSetTimeout(callback, delay === 75_000 ? 250 : delay, ...args),
      );
    const originalUpdateOne = ChatConversation.updateOne.bind(ChatConversation);
    const updateSpy = vi
      .spyOn(ChatConversation, "updateOne")
      .mockImplementationOnce(async (...args) => {
        await new Promise((resolve) => nativeSetTimeout(resolve, 500));
        return originalUpdateOne(...args);
      });

    try {
      await chatStream(
        {
          user: { id: String(user._id) },
          aiActor: { userId: String(user._id) },
          aiChatRequest: {
            value: {
              message: "Lisa là ai?",
              conversationId: null,
              context: {},
              image: null,
              requestId: "6bb81674-a43c-4fc1-82da-f4a7ae526d4a",
            },
          },
        },
        response,
      );
    } finally {
      timeoutSpy.mockRestore();
      updateSpy.mockRestore();
    }

    expect(response.end).toHaveBeenCalledTimes(1);
    expect(writes.join("")).toMatch(/"type":"(?:error|done)"/);
  });

  it("does not persist a dangling function call when a tool batch is aborted", async () => {
    const { user } = await createTestUser();
    llmStreamMock.mockImplementationOnce(async function* abortedToolCall() {
      yield {
        type: "tool_call",
        toolCalls: [
          {
            id: "aborted-search-call",
            name: "search_knowledge",
            args: { query: "Ronaldo official training routine" },
          },
        ],
      };
    });
    vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options = {}) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(options.signal.reason || new Error("aborted")),
            { once: true },
          );
        }),
      ),
    );
    const response = {
      writableEnded: false,
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      on: vi.fn(),
      write: vi.fn(() => true),
      end: vi.fn(function end() {
        this.writableEnded = true;
      }),
      status: vi.fn(function status() {
        return this;
      }),
      json: vi.fn(function json() {
        this.writableEnded = true;
        return this;
      }),
    };
    const nativeSetTimeout = globalThis.setTimeout;
    const timeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback, delay, ...args) =>
        nativeSetTimeout(callback, delay === 75_000 ? 50 : delay, ...args),
      );

    try {
      await chatStream(
        {
          user: { id: String(user._id) },
          aiActor: { userId: String(user._id) },
          aiChatRequest: {
            value: {
              message: "Ronaldo thường tập những bài gì?",
              conversationId: null,
              context: {},
              image: null,
              requestId: "9baecbae-ed55-44fe-925c-c4c6dfce83f2",
            },
          },
        },
        response,
      );
    } finally {
      timeoutSpy.mockRestore();
    }

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const danglingCalls = conversation.messages.filter(
      (item) => item.role === "assistant" && Array.isArray(item.toolCalls),
    );
    expect(danglingCalls).toHaveLength(0);
  });

  it("fails closed when a real-person claim receives no web evidence", async () => {
    const { user, accessToken } = await createTestUser();

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Ronaldo thường tập những bài gì trong phòng gym?",
      requestId: "67b9c20c-da59-40a4-a002-3fba16351db4",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    expect(response.status).toBe(200);
    expect(searchKnowledgeBaseMock).not.toHaveBeenCalled();
    expect(answer.content).toMatch(/chưa thể xác minh.*nguồn đáng tin cậy/i);
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "web_required",
      webSearchUsed: true,
      webSearchOutcome: "provider_error",
    });
    expect(llmStreamMock).not.toHaveBeenCalled();
  });

  it("returns only grounded supported text without a chat-model turn", async () => {
    const { user, accessToken } = await createTestUser();
    llmStreamMock.mockImplementation(() => {
      throw new Error("chat model must not run before canonical web search");
    });
    vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text:
                    "Ronaldo tập sức mạnh và sức mạnh bùng nổ. Unsupported speculation: Ronaldo luôn bench press mỗi ngày.",
                },
              ],
            },
            groundingMetadata: {
              groundingSupports: [
                {
                  segment: {
                    text: "Ronaldo tập sức mạnh và sức mạnh bùng nổ.",
                  },
                  groundingChunkIndices: [0],
                },
              ],
              groundingChunks: [
                {
                  web: {
                    title: "Nguồn chính thức",
                    uri: "https://example.com/ronaldo-training",
                  },
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Ronaldo thường tập những bài gì trong phòng gym?",
      requestId: "f2b62bbf-6d47-4621-9da2-eef5ddd55126",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    const toolCallIndex = conversation.messages.findIndex(
      (message) =>
        message.role === "assistant" && Array.isArray(message.toolCalls),
    );
    const toolResultIndex = conversation.messages.findIndex(
      (message) => message.role === "tool",
    );
    expect(response.status).toBe(200);
    expect(llmStreamMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(answer.content).toContain(
      "Ronaldo tập sức mạnh và sức mạnh bùng nổ.",
    );
    expect(answer.content).not.toContain("Unsupported speculation");
    expect(answer.content).not.toContain("bench press mỗi ngày");
    expect(answer.content).toContain("https://example.com/ronaldo-training");
    expect(answer.answerTrace).toMatchObject({
      routeDomain: "fitness",
      evidenceMode: "web_required",
      webSearchUsed: true,
      webSearchOutcome: "grounded",
    });
    const callId = conversation.messages[toolCallIndex]?.toolCalls?.[0]?.id;
    expect({ toolCallIndex, toolResultIndex }).toEqual({
      toolCallIndex: 1,
      toolResultIndex: 2,
    });
    expect(callId).toMatch(/^server-search_knowledge-/);
    expect(conversation.messages[toolResultIndex]?.toolCallId).toBe(callId);
  });

  it("distinguishes a provider error from a source-free grounded search", async () => {
    const { user, accessToken } = await createTestUser();
    llmStreamMock.mockImplementationOnce(async function* requiredSearchCall(
      _messages,
      tools,
      options,
    ) {
      expect(tools.map((tool) => tool.function.name)).toEqual([
        "search_knowledge",
      ]);
      expect(options.requiredToolName).toBe("search_knowledge");
      yield {
        type: "tool_call",
        toolCalls: [{
          id: "search-provider-error",
          name: "search_knowledge",
          args: { query: "untrusted query" },
        }],
      };
    });
    vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 503 }),
    ));

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Ronaldo thường tập những bài gì trong phòng gym?",
      requestId: "3d98f7dd-92f3-49d2-8238-3ad0f378a461",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(answer.answerTrace).toMatchObject({
      webSearchUsed: true,
      webSearchOutcome: "provider_error",
    });
  });

  it("records no_supported_source after the canonical search was attempted", async () => {
    const { user, accessToken } = await createTestUser();
    llmStreamMock.mockImplementationOnce(async function* requiredSearchCall() {
      yield {
        type: "tool_call",
        toolCalls: [{
          id: "search-no-support",
          name: "search_knowledge",
          args: { query: "untrusted query" },
        }],
      };
    });
    vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        '{"candidates":[{"content":{"parts":[{"text":"Unsupported"}]}}]}',
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ));

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Ronaldo thường tập những bài gì trong phòng gym?",
      requestId: "3d98f7dd-92f3-49d2-8238-3ad0f378a462",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id })
      .lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(answer.answerTrace).toMatchObject({
      webSearchUsed: true,
      webSearchOutcome: "no_supported_source",
    });
  });

  it("executes and persists the canonical user query instead of model-generated PII", async () => {
    const { user, accessToken } = await createTestUser();
    const filler = " official evidence".repeat(30);
    const canonicalQuery =
      `Nghiên cứu mới nhất nói gì về bài tập của Ronaldo cho tôi, my name is zoraqx.${filler}`;
    const expectedSearchQuery =
      `Nghiên cứu mới nhất nói gì về bài tập của Ronaldo cho tôi, my name is [đã ẩn tên].${filler}`.slice(
        0,
        300,
      );
    const modelGeneratedPrivateQuery =
      "ronaldo official workout advice for hoang thien 170cm 80kg";
    llmStreamMock.mockImplementation(() => {
      throw new Error("chat model must not generate the external query");
    });
    vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text:
                    "Ronaldo từng sử dụng các bài tập sức mạnh và bùng nổ.",
                },
              ],
            },
            groundingMetadata: {
              groundingSupports: [
                {
                  segment: {
                    text:
                      "Ronaldo từng sử dụng các bài tập sức mạnh và bùng nổ.",
                  },
                  groundingChunkIndices: [0],
                },
              ],
              groundingChunks: [
                {
                  web: {
                    title: "Nguồn chính thức",
                    uri: "https://example.com/ronaldo-evidence",
                  },
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: canonicalQuery,
      requestId: "895e406c-47d0-4700-bf7b-253793e6538c",
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (message) => message.role === "assistant" && message.content,
    );
    const storedSearchCall = conversation.messages.find(
      (message) =>
        message.role === "assistant" &&
        message.toolCalls?.some((call) => call.name === "search_knowledge"),
    )?.toolCalls?.find((call) => call.name === "search_knowledge");
    const providerBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(response.status).toBe(200);
    expect(llmStreamMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(providerBody.contents[0].parts[0].text).toBe(expectedSearchQuery);
    expect(providerBody.contents[0].parts[0].text).toHaveLength(300);
    expect(JSON.stringify(providerBody)).not.toContain("zoraqx");
    expect(JSON.stringify(providerBody)).not.toContain(
      modelGeneratedPrivateQuery,
    );
    expect(storedSearchCall?.args).toEqual({ query: expectedSearchQuery });
    expect(JSON.stringify(conversation.messages)).not.toContain(
      modelGeneratedPrivateQuery,
    );
    expect(answer.content).toContain("https://example.com/ronaldo-evidence");
    expect(answer.answerTrace).toMatchObject({
      evidenceMode: "web_required",
      webSearchUsed: true,
    });
  });

  it.each([
    {
      message: "current workout recommendation for bob",
      requestId: "895e406c-47d0-4700-bf7b-253793e6538d",
    },
    {
      message: "latest routine for my friend mai",
      requestId: "895e406c-47d0-4700-bf7b-253793e6538e",
    },
    {
      message: "My friend Lisa Brown was born when?",
      requestId: "895e406c-47d0-4700-bf7b-253793e6538f",
    },
    {
      message: "zoraqx quux thường tập gì?",
      requestId: "895e406c-47d0-4700-bf7b-253793e6540a",
    },
    {
      message: "Ronaldo routine cho zoraqx",
      requestId: "895e406c-47d0-4700-bf7b-253793e6541b",
    },
    {
      message: "bài tập của zoraqx quux",
      requestId: "895e406c-47d0-4700-bf7b-253793e6544e",
    },
  ])(
    "does not expose or execute web search when the canonical query is private: $message",
    async ({ message, requestId }) => {
      const { user, accessToken } = await createTestUser();
      const exposedTools = [];
      llmStreamMock.mockImplementationOnce(
        async function* canonicalPrivacyBlockedResponse(_messages, tools) {
          exposedTools.push(
            ...tools.map((tool) => tool.function.name),
          );
          yield {
            type: "text",
            content: "Unsafe model-prior draft without required evidence.",
          };
        },
      );
      vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const response = await withAuth(
        request(app).post("/api/ai/chat"),
        accessToken,
      ).send({ message, requestId });

      const conversation = await ChatConversation.findOne({
        userId: user._id,
      }).lean();
      const answer = conversation.messages.find(
        (item) => item.role === "assistant" && item.content,
      );
      const persistedWebProtocol = conversation.messages.filter(
        (item) =>
          item.role === "tool" ||
          item.toolCalls?.some((call) => call.name === "search_knowledge"),
      );
      expect(response.status).toBe(200);
      expect(exposedTools).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(persistedWebProtocol).toHaveLength(0);
      expect(answer.content).toMatch(/chưa thể xác minh.*nguồn đáng tin cậy/i);
      expect(answer.content).not.toContain("Unsafe model-prior draft");
      expect(answer.answerTrace).toMatchObject({
        evidenceMode: "web_required",
        webSearchUsed: false,
      });
    },
  );

  it.each([
    {
      message: "Hiện tại ca sĩ Taylor Swift có tin gì mới?",
      requestId: "895e406c-47d0-4700-bf7b-253793e6542c",
    },
    {
      message: "Thời tiết Sài Gòn thế nào?",
      requestId: "895e406c-47d0-4700-bf7b-253793e6543d",
    },
  ])(
    "executes bounded web search directly for a privacy-safe changing fact: $message",
    async ({ message, requestId }) => {
      const { user, accessToken } = await createTestUser();
      vi.stubEnv("GEMINI_API_KEY", "");

      const response = await withAuth(
        request(app).post("/api/ai/chat"),
        accessToken,
      ).send({ message, requestId });
      const conversation = await ChatConversation.findOne({ userId: user._id })
        .lean();
      const answer = conversation.messages.find(
        (item) => item.role === "assistant" && item.content,
      );
      const searchCalls = conversation.messages.flatMap(
        (item) => item.toolCalls || [],
      ).filter((call) => call.name === "search_knowledge");

      expect(response.status).toBe(200);
      expect(llmStreamMock).not.toHaveBeenCalled();
      expect(searchCalls).toHaveLength(1);
      expect(answer.answerTrace).toMatchObject({
        webSearchUsed: true,
        webSearchOutcome: "provider_error",
      });
    },
  );

  it.each([
    {
      message: "Taylor Swift đang lưu diễn ở đâu?",
      person: "Taylor Swift",
      requestId: "895e406c-47d0-4700-bf7b-253793e6547a",
    },
    {
      message: "Kylian Mbappé chơi cho CLB nào?",
      person: "Kylian Mbappé",
      requestId: "895e406c-47d0-4700-bf7b-253793e6547b",
    },
  ])(
    "grounds a public-person changing fact with the exact canonical name: $person",
    async ({ message, person, requestId }) => {
      const { user, accessToken } = await createTestUser();
      llmStreamMock.mockImplementation(() => {
        throw new Error("chat model must not generate a public-person query");
      });
      vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: { parts: [{ text: `${person} — dữ kiện đã tra cứu.` }] },
            groundingMetadata: {
              groundingSupports: [{
                segment: { text: `${person} — dữ kiện đã tra cứu.` },
                groundingChunkIndices: [0],
              }],
              groundingChunks: [{
                web: {
                  title: "Nguồn công khai",
                  uri: "https://example.com/public-person-evidence",
                },
              }],
            },
          }],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const response = await withAuth(
        request(app).post("/api/ai/chat"),
        accessToken,
      ).send({ message, requestId });
      const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
      const storedSearchCall = conversation.messages.find(
        (item) => item.toolCalls?.some((call) => call.name === "search_knowledge"),
      )?.toolCalls?.[0];
      const answer = conversation.messages.find(
        (item) => item.role === "assistant" && item.content,
      );
      expect(response.status).toBe(200);
      expect(response.text).toContain('"type":"done"');
      expect(response.text).not.toContain('"type":"error"');
      expect(llmStreamMock).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const providerBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(providerBody.contents[0].parts[0].text).toBe(message);
      expect(storedSearchCall.args).toEqual({ query: message });
      expect(answer.content).toContain(person);
      expect(answer.content).toContain("https://example.com/public-person-evidence");
      expect(answer.answerTrace).toMatchObject({
        evidenceMode: "web_required",
        webSearchUsed: true,
      });
    },
  );

  it.each([
    "Nguyễn Văn An thường tập bài gì?",
    "John Smith thường tập bài gì?",
    "Mai thường tập gì?",
  ])("blocks web search for an ambiguous person identity: %s", async (message) => {
    const { user, accessToken } = await createTestUser();
    llmStreamMock.mockImplementation(async function* ambiguousPersonResponse(
      _messages,
      tools,
    ) {
      expect(tools).toEqual([]);
      yield { type: "text", content: "Không dùng bản nháp thiếu bằng chứng." };
    });
    vi.stubEnv("GEMINI_API_KEY", "synthetic-test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message,
      requestId: `7a83fbba-f0de-4479-a901-${message.startsWith("John") ? "000000000001" : "000000000002"}`,
    });

    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );
    const persistedWebProtocol = conversation.messages.filter(
      (item) =>
        item.role === "tool" ||
        item.toolCalls?.some((call) => call.name === "search_knowledge"),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(persistedWebProtocol).toHaveLength(0);
    expect(answer.content).toMatch(/chưa thể xác minh.*nguồn đáng tin cậy/i);
    expect(answer.answerTrace).toMatchObject({
      evidenceMode: "web_required",
      webSearchUsed: false,
    });
  });

  it("keeps a private person's injury question off web search under high-stakes routing", async () => {
    const { user, accessToken } = await createTestUser();
    llmStreamMock.mockImplementationOnce(async function* privateHealthResponse(
      _messages,
      tools,
    ) {
      expect(tools).toEqual([]);
      yield {
        type: "text",
        content: "Mình không thể xác minh tình trạng sức khỏe riêng của người này.",
      };
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Nam bị chấn thương gì?",
      requestId: "7a83fbba-f0de-4479-a901-000000000005",
    });
    const conversation = await ChatConversation.findOne({ userId: user._id }).lean();
    const answer = conversation.messages.find(
      (item) => item.role === "assistant" && item.content,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(conversation.messages.some(
      (item) => item.role === "tool" || item.toolCalls?.some(
        (call) => call.name === "search_knowledge",
      ),
    )).toBe(false);
    expect(answer.answerTrace).toMatchObject({
      evidenceMode: "model_prior",
      webSearchUsed: false,
    });
  });

  it("redacts an ambiguous one-word name before Knowledge Base embedding", async () => {
    const { accessToken } = await createTestUser();

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Mai muốn hỏi cách squat đúng?",
      requestId: "7a83fbba-f0de-4479-a901-000000000003",
    });

    expect(response.status).toBe(200);
    expect(searchKnowledgeBaseMock).toHaveBeenCalledTimes(1);
    expect(searchKnowledgeBaseMock.mock.calls[0][0]).not.toMatch(/\bMai\b/u);
  });

  it("redacts an unseen lowercase identity before KB embedding and blocks web fallback", async () => {
    const { accessToken } = await createTestUser();
    const exposedTools = [];
    llmStreamMock.mockImplementationOnce(
      async function* privateEmbeddingFallback(_messages, tools) {
        exposedTools.push(...tools.map((tool) => tool.function.name));
        yield { type: "text", content: "Synthetic bounded answer." };
      },
    );

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "What exercise should zoraqx quux do?",
      requestId: "7a83fbba-f0de-4479-a901-000000000004",
    });

    expect({
      status: response.status,
      embeddingQuery: searchKnowledgeBaseMock.mock.calls[0]?.[0],
      exposedTools,
    }).toEqual({
      status: 200,
      embeddingQuery: expect.not.stringMatching(/zoraqx quux/iu),
      exposedTools: [],
    });
  });

  it("sanitizes a tool-result fallback before it reaches the browser", async () => {
    const { accessToken } = await createTestUser();
    let providerTurn = 0;
    searchKnowledgeBaseMock.mockResolvedValueOnce([
      {
        _id: "507f191e810c19729de860eb",
        question: "Kỹ thuật bài tập tổng quát",
        answer: "Dùng thư viện bài tập nội bộ để tra cứu động tác.",
        category: "training",
        similarity: 0.9,
      },
    ]);
    llmStreamMock.mockImplementation(async function* unsafeToolFallback(
      _messages,
      tools,
    ) {
      providerTurn += 1;
      if (providerTurn === 1) {
        expect(tools.map((tool) => tool.function.name)).toContain(
          "search_exercises",
        );
        yield {
          type: "tool_call",
          toolCalls: [
            {
              id: "exercise-fallback",
              name: "search_exercises",
              args: {
                searchQuery: "function_call search_exercises action_input",
                limit: 1,
              },
            },
          ],
        };
      }
      // Turn 2 intentionally returns no text, forcing the tool-result fallback.
    });

    const response = await withAuth(
      request(app).post("/api/ai/chat"),
      accessToken,
    ).send({
      message: "Cách tập đúng kỹ thuật với bài chưa có trong thư viện?",
      requestId: "4fb18db6-c3eb-44ce-b717-d68376009141",
    });
    const streamedText = response.text
      .split("\n\n")
      .filter((event) => event.startsWith("data: "))
      .map((event) => JSON.parse(event.slice(6)))
      .filter((event) => event.type === "text")
      .map((event) => event.content)
      .join("");

    expect(response.status).toBe(200);
    expect(providerTurn).toBe(2);
    expect(response.text).not.toMatch(
      /search_exercises|function_call|action_input/i,
    );
    expect(streamedText).not.toMatch(/search_exercises|function_call|action_input/i);
    expect(streamedText).toBe(
      "Mình chưa thể hoàn tất yêu cầu này. Bạn thử diễn đạt lại ngắn gọn hơn nhé.",
    );
  });

  it("keeps internal answer trace and reviewer IDs out of customer conversation APIs", async () => {
    const { user, accessToken } = await createTestUser();
    const reviewerId = new mongoose.Types.ObjectId();
    const trace = {
      routeDomain: "fitness",
      evidenceMode: "internal_kb",
      kbEntryIds: [new mongoose.Types.ObjectId()],
      webSearchUsed: false,
      model: "internal-model-name",
      promptVersion: "internal-prompt-version",
    };
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Projection boundary",
      messages: [
        { role: "user", content: "Cách squat đúng?" },
        {
          role: "assistant",
          content: "Giữ cột sống trung lập.",
          feedback: "down",
          feedbackReview: {
            status: "resolved",
            reviewedBy: reviewerId,
            reviewedAt: new Date("2026-09-12T02:00:00.000Z"),
          },
          answerTrace: trace,
        },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "internal-call-id",
              name: "search_knowledge",
              args: { query: "INTERNAL_TOOL_QUERY_SENTINEL" },
            },
          ],
        },
        { role: "user", content: "Cho tôi hỏi tiếp." },
      ],
      messageCount: 4,
    });

    const detail = await withAuth(
      request(app).get(`/api/ai/conversations/${conversation._id}`),
      accessToken,
    );
    const history = await withAuth(
      request(app).get("/api/ai/history"),
      accessToken,
    );
    const branch = await withAuth(
      request(app).post(`/api/ai/conversations/${conversation._id}/fork`),
      accessToken,
    ).send({ messageId: conversation.messages.at(-1)._id });

    const serialized = JSON.stringify([
      detail.body.data?.messages,
      history.body.data?.messages,
      branch.body.data?.messages,
    ]);
    expect(detail.status).toBe(200);
    expect(history.status).toBe(200);
    expect(branch.status).toBe(201);
    expect(serialized).not.toMatch(
      /answerTrace|feedbackReview|internal-model-name|internal-prompt-version|INTERNAL_TOOL_QUERY_SENTINEL/i,
    );
    expect(serialized).not.toContain(reviewerId.toString());
    expect(serialized).toContain("Giữ cột sống trung lập.");
  });

  it("moves a downvoted assistant answer into the pending review queue", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Feedback review",
      messages: [{ role: "assistant", content: "Synthetic answer" }],
    });
    const messageId = conversation.messages[0]._id;

    const response = await withAuth(
      request(app).post(`/api/ai/conversations/${conversation._id}/feedback`),
      accessToken,
    ).send({ messageId, feedback: "down" });

    const updated = await ChatConversation.findById(conversation._id).lean();
    expect(response.status).toBe(200);
    expect(updated.messages[0]).toMatchObject({
      feedback: "down",
      feedbackReview: {
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
      },
    });
  });

  it("clears pending review when the user removes the downvote", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({
      userId: user._id,
      title: "Feedback reset",
      messages: [
        {
          role: "assistant",
          content: "Synthetic answer",
          feedback: "down",
          feedbackReview: { status: "pending" },
        },
      ],
    });
    const messageId = conversation.messages[0]._id;

    const response = await withAuth(
      request(app).post(`/api/ai/conversations/${conversation._id}/feedback`),
      accessToken,
    ).send({ messageId, feedback: null });

    const updated = await ChatConversation.findById(conversation._id).lean();
    expect(response.status).toBe(200);
    expect(updated.messages[0]).toMatchObject({
      feedback: null,
      feedbackReview: {
        status: "none",
        reviewedBy: null,
        reviewedAt: null,
      },
    });
  });
});
