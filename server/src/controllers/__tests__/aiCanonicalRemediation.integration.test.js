import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const { llmMock, memoryMock } = vi.hoisted(() => ({ llmMock: vi.fn(), memoryMock: vi.fn() }));
vi.mock("../../services/ai/providers/index.js", () => ({ llmStream: llmMock }));
vi.mock("../../services/ai/embedding.service.js", () => ({ searchKnowledgeBase: vi.fn(async () => []) }));
vi.mock("../../services/aiMemory.service.js", () => ({ getAiMemoryContext: memoryMock }));
vi.mock("../../utils/safeLogger.js", () => ({ safeLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { clearCollections, createTestApp, createTestUser, setupTestDB, teardownTestDB, withAuth } from "../../__tests__/setup.js";
import ChatConversation from "../../models/ChatConversation.js";
import { toolRegistry } from "../../services/ai/tools/toolRegistry.js";
import { suggestMeal } from "../../services/ai/tools/suggestMeal.tool.js";

let app;
const originalMeal = toolRegistry.suggest_meal.execute;
const profile = (contains = [], specificContains = []) => ({
  reviewStatus: "reviewed", contains, mayContain: [], reviewedScopes: ["specific_foods"], specificContains,
  sourceType: "official_database", sourceUrl: "https://fdc.nal.usda.gov/food-search/", reviewedAt: new Date("2026-09-01"),
});
const catalog = [
  { _id: "rice", label: "Cơm trắng", protein: 2.7, carb: 28, fat: 0.3, allergenProfile: profile() },
  { _id: "oil", label: "Dầu ô liu", protein: 0, carb: 0, fat: 100, allergenProfile: profile() },
  { _id: "fish", label: "Cá basa", protein: 22, carb: 0, fat: 4, allergenProfile: profile(["fish"]) },
  { _id: "tofu", label: "Đậu phụ", protein: 12, carb: 2, fat: 7, allergenProfile: profile(["soy"]) },
  { _id: "vegetable", label: "Rau muống", protein: 3, carb: 4, fat: 0, allergenProfile: profile() },
  { _id: "chicken", label: "Ức gà", protein: 31, carb: 0, fat: 3.6, allergenProfile: profile([], ["chicken"]) },
  { _id: "beef", label: "Thịt bò nạc", protein: 26, carb: 0, fat: 5, allergenProfile: profile([], ["beef"]) },
  { _id: "potato", label: "Khoai tây", protein: 2, carb: 17, fat: 0.1, allergenProfile: profile() },
];
const events = (response) => response.text.split("\n\n").filter((item) => item.startsWith("data: ")).map((item) => JSON.parse(item.slice(6)));
const mealCard = (response) => events(response).find((item) => item.cardType === "meal")?.data;
const submit = (accessToken, message, conversationId) => withAuth(request(app).post("/api/ai/chat"), accessToken)
  .send({ message, ...(conversationId && { conversationId }) });

beforeAll(async () => {
  await setupTestDB();
  const { default: routes } = await import("../../routes/ai.routes.js");
  app = createTestApp(); app.use("/api/ai", routes);
});
beforeEach(() => {
  memoryMock.mockReset(); memoryMock.mockResolvedValue([]);
  llmMock.mockReset(); llmMock.mockImplementation(() => { throw new Error("provider must not rewrite canonical results"); });
  toolRegistry.suggest_meal.execute = vi.fn((args, context) => suggestMeal(args, {
    ...context, findFoods: async () => catalog, getPriceMap: async () => new Map(),
  }));
});
afterEach(async () => { toolRegistry.suggest_meal.execute = originalMeal; vi.clearAllMocks(); await clearCollections(); });
afterAll(async () => { await teardownTestDB(); });

describe("canonical remediation at the chat route", () => {
  it("serves the 600 kcal excluded-chicken case as one server-calculated meal", async () => {
    const { accessToken } = await createTestUser();
    const response = await submit(accessToken, "Tạo một bữa ăn khoảng 600 kcal món Việt, không ăn thịt gà; hãy thay bằng nguồn đạm khác và ghi rõ từng món, grams, tổng kcal và protein.");
    const card = mealCard(response);
    expect(response.status).toBe(200);
    expect(card).toMatchObject({ status: "complete", calorieScope: "per_meal", nutritionMethod: "server_calculated_4p_4c_9f" });
    expect(card.meals).toHaveLength(1);
    expect(Math.abs(card.totals.calories - 600)).toBeLessThanOrEqual(100);
    expect(card.meals[0].foods.every((food) => food.amountGrams > 0 && food.foodId !== "chicken")).toBe(true);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("replaces tofu with fish in the same chat while preserving every other food and recalculating totals", async () => {
    const { user, accessToken } = await createTestUser();
    const first = await submit(accessToken, "Lập cho tôi thực đơn món Việt trong 1 ngày khoảng 2.200 kcal, ít nhất 140g protein, có cơm, cá, rau và đậu phụ; ghi grams và tổng macro.");
    const before = mealCard(first);
    expect(before.status).toBe("complete");
    const conversationId = events(first).find((item) => item.type === "done").conversationId;
    const second = await submit(accessToken, "Giữ nguyên thực đơn vừa lập, chỉ thay phần đậu phụ bằng cá. Giữ tổng năng lượng khoảng 2.200 kcal và ít nhất 140g protein; ghi rõ món và khối lượng trước/sau, tính lại tổng macro, không đổi các món còn lại.", conversationId);
    const after = mealCard(second);
    expect(after.status).toBe("complete");
    expect(after.replacement).toMatchObject({ before: { foodId: "tofu" }, after: { foodId: "fish" } });
    expect(after.replacements).toHaveLength(2);
    expect(after.replacements.every((item) => item.before.foodId === "tofu" && item.after.foodId === "fish")).toBe(true);
    before.meals.forEach((meal, mealIndex) => meal.foods.forEach((food, foodIndex) => {
      if (!after.replacements.some((item) => item.mealIndex === mealIndex && item.foodIndex === foodIndex)) {
        expect(after.meals[mealIndex].foods[foodIndex]).toEqual(food);
      }
    }));
    expect(Math.abs(after.totals.calories - 2200)).toBeLessThanOrEqual(100);
    expect(after.totals.protein).toBeGreaterThanOrEqual(140);
    expect(after.totals.calories).toBeCloseTo(4 * after.totals.protein + 4 * after.totals.carb + 9 * after.totals.fat, 0);
    const context = toolRegistry.suggest_meal.execute.mock.calls[1][1];
    expect(context.signal).toBeInstanceOf(AbortSignal);
    expect(context.scopedSubstitution.status).toBe("ready");
    const persisted = await ChatConversation.findOne({ userId: user._id }).lean();
    expect(persisted.workingMemory.lastMeal.plan.meals).toEqual(after.meals);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("does not substitute an absent food by creating an unrelated new plan", async () => {
    const { accessToken } = await createTestUser();
    const first = await submit(accessToken, "Tạo một bữa ăn 600 kcal, ít nhất 30g protein, có cơm, cá và rau.");
    const conversationId = events(first).find((item) => item.type === "done").conversationId;
    const second = await submit(accessToken, "Giữ nguyên bữa ăn, chỉ thay đậu phụ bằng cá, khoảng 600 kcal.", conversationId);
    expect(mealCard(second)).toMatchObject({ status: "missing_data", reason: "replacement_source_absent" });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("delivers the constrained four-day workout and detailed seven-day example without provider rewrites or citations", async () => {
    const { user, accessToken } = await createTestUser();
    for (const message of [
      "Tạo lịch tập tăng cơ 4 ngày/tuần cho người mới, chỉ có đôi tạ đơn điều chỉnh và dây kháng lực; mỗi buổi tối đa 60 phút, kèm deload.",
      "Lập kế hoạch ăn uống và tập luyện chi tiết trong 7 ngày cho người mới muốn giảm mỡ.",
    ]) {
      const response = await submit(accessToken, message);
      expect(response.status).toBe(200);
      expect(events(response).filter((item) => item.cardType === "webSources")).toEqual([]);
      const answer = events(response).filter((item) => item.type === "text").map((item) => item.content).join("");
      expect(answer).toMatch(/tham khảo|minh họa/iu);
      expect(answer).toMatch(message.includes("7 ngày") ? /Ngày 7[\s\S]*nghỉ hoàn toàn/iu : /Buổi 4[\s\S]*giảm khoảng 30% volume/iu);
    }
    expect(await ChatConversation.countDocuments({ userId: user._id })).toBe(2);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it.each(["không ăn tôm", "tránh tôm", "không ăn nấm"])("keeps a first-turn food restriction out of the fixed template: %s", async (restriction) => {
    const { user, accessToken } = await createTestUser();
    llmMock.mockImplementation(async function* (messages) {
      expect(messages.some((item) => item.role === "user" && item.content.includes(restriction))).toBe(true);
      yield { type: "text", content: "Kế hoạch tham khảo cần giữ ràng buộc thực phẩm bạn vừa nêu." };
    });
    const response = await submit(accessToken, `Lập kế hoạch ăn uống và tập luyện chi tiết trong 7 ngày cho người mới muốn giảm mỡ, ${restriction}.`);
    expect(response.status).toBe(200);
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(response.text).not.toContain("tôm 140 g");
    const saved = await ChatConversation.findOne({ userId: user._id }).lean();
    expect(saved.messages.at(-1).answerTrace.model).not.toBe("static_seven_day_plan_v1");
  });

  it("keeps earlier dietary constraints in model context rather than bypassing them with a static plan", async () => {
    const { user, accessToken } = await createTestUser();
    const conversation = await ChatConversation.create({ userId: user._id, title: "Synthetic allergy constraint",
      messages: [{ role: "user", content: "Tôi dị ứng tôm. Không dùng tôm trong kế hoạch." },
        { role: "assistant", content: "Mình đã ghi nhận cần tránh tôm." }], messageCount: 2,
    });
    llmMock.mockImplementation(async function* (messages) {
      expect(messages.some((item) => item.role === "user" && item.content.includes("dị ứng tôm"))).toBe(true);
      yield { type: "text", content: "Mình sẽ giữ ràng buộc tránh tôm và cần thêm dữ liệu để cá nhân hóa kế hoạch." };
    });
    const response = await submit(accessToken, "Lập kế hoạch ăn uống và tập luyện chi tiết trong 7 ngày cho người mới muốn giảm mỡ.", String(conversation._id));
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(response.text).not.toContain("tôm 140 g");
    const saved = await ChatConversation.findById(conversation._id).lean();
    expect(saved.messages.at(-1).answerTrace.model).not.toBe("static_seven_day_plan_v1");
  });

  it("keeps persisted vegan preferences in model context instead of generating animal foods from the static template", async () => {
    const { accessToken } = await createTestUser();
    memoryMock.mockResolvedValue([{ kind: "dietary_style", value: "vegan" }]);
    llmMock.mockImplementation(async function* (messages) {
      expect(messages[0].content).toContain("Ưu tiên món thuần chay");
      yield { type: "text", content: "Mình sẽ giữ chế độ ăn thuần chay trong kế hoạch tham khảo." };
    });
    const response = await submit(accessToken, "Lập kế hoạch ăn uống và tập luyện chi tiết trong 7 ngày cho người mới muốn giảm mỡ.");
    expect(llmMock).toHaveBeenCalledTimes(1);
    expect(response.text).not.toMatch(/ức gà|tôm 140 g/iu);
  });
});
