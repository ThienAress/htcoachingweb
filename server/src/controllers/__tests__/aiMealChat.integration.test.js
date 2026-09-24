import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../services/ai/providers/index.js", () => ({
  llmStream: vi.fn(async function* hallucinatedMeal() {
    yield { type: "text", content: "| Món | kcal |\n|---|---|\n| Whey | 2500 |" };
  }),
}));

import {
  clearCollections,
  createTestApp,
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import Food from "../../models/Food.js";
import { llmStream } from "../../services/ai/providers/index.js";

let app;

const reviewed = (contains = []) => ({
  reviewStatus: "reviewed",
  contains,
  mayContain: [],
  reviewedScopes: [],
  specificContains: [],
  sourceType: "official_database",
  sourceUrl: "https://fdc.nal.usda.gov/food-search/",
  reviewedAt: new Date("2026-09-01"),
});

const parseEvents = (body) => [...body.matchAll(/^data: (\{.*\})$/gm)]
  .map((match) => JSON.parse(match[1]));

beforeAll(async () => {
  await setupTestDB();
  const { default: aiRoutes } = await import("../../routes/ai.routes.js");
  app = createTestApp();
  app.use("/api/ai", aiRoutes);
});

afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
});

afterAll(teardownTestDB);

describe("POST /api/ai/chat meal request", () => {
  it("fails closed for a guest public-person routine claim instead of using model memory", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Cookie", ["csrfToken=test-csrf-token"])
      .set("X-CSRF-Token", "test-csrf-token")
      .send({ message: "Ronaldo thường tập những bài gì?" });

    expect(response.status).toBe(200);
    expect(response.text).toContain("chưa thể xác minh thông tin mới nhất này trong chế độ khách");
    expect(response.text).not.toContain("Tôi là HT Assistant");
  });

  it("returns structured missing-data instead of provider prose when meal constraints are incomplete", async () => {
    const response = await request(app)
      .post("/api/ai/chat")
      .set("Cookie", ["csrfToken=test-csrf-token"])
      .set("X-CSRF-Token", "test-csrf-token")
      .send({ message: "Gợi ý thực đơn cho tôi" });

    const events = parseEvents(response.text);
    const card = events.find((event) => event.type === "ui_card" && event.cardType === "meal");
    expect(response.status).toBe(200);
    expect(card?.data).toMatchObject({ status: "missing_data", reason: "incomplete_constraints" });
    expect(events.some((event) => event.type === "text" && event.content.includes("| Whey |"))).toBe(false);
    expect(llmStream).not.toHaveBeenCalled();
  });

  it("routes Q4 through a server-calculated meal card instead of provider prose", async () => {
    await Food.create([
      { label: "Ức gà", protein: 31, carb: 0, fat: 3.6, calories: 156, allergenProfile: reviewed() },
      { label: "Cơm trắng", protein: 2.7, carb: 28, fat: 0.3, calories: 125, allergenProfile: reviewed() },
      { label: "Dầu ô liu", protein: 0, carb: 0, fat: 100, calories: 900, allergenProfile: reviewed() },
      { label: "Whey protein", protein: 80, carb: 8, fat: 6, calories: 406, allergenProfile: reviewed(["milk"]) },
      { label: "Đậu phộng", protein: 26, carb: 16, fat: 49, calories: 609, allergenProfile: reviewed(["peanut"]) },
    ]);

    const response = await request(app)
      .post("/api/ai/chat")
      .set("Cookie", ["csrfToken=test-csrf-token"])
      .set("X-CSRF-Token", "test-csrf-token")
      .send({
        message: "Tôi muốn một thực đơn món Việt trong 1 ngày khoảng 2.500 kcal, ít nhất 170g protein, chia 4 bữa. Tôi không dùng whey, không dung nạp lactose, dị ứng đậu phộng. Ghi khối lượng từng món và tổng macro trong card.",
      });

    const events = parseEvents(response.text);
    const card = events.find((event) => event.type === "ui_card" && event.cardType === "meal");
    expect(response.status).toBe(200);
    expect(card?.data?.status).toBe("complete");
    expect(card.data.targetCalories).toBe(2500);
    expect(card.data.targetToleranceCalories).toBe(100);
    expect(card.data.targets.minimumProteinGrams).toBe(170);
    expect(card.data.meals).toHaveLength(4);
    expect(card.data.totals.protein).toBeGreaterThanOrEqual(170);
    expect(Math.abs(card.data.totals.calories - 2500)).toBeLessThanOrEqual(100);
    expect(card.data.totals.calories).toBeCloseTo(
      4 * card.data.totals.protein + 4 * card.data.totals.carb + 9 * card.data.totals.fat,
      1,
    );
    expect(card.data.meals.flatMap((meal) => meal.foods.map((food) => food.name)))
      .not.toEqual(expect.arrayContaining(["Whey protein", "Đậu phộng"]));
    expect(events.some((event) => event.type === "text" && event.content.includes("| Whey |")))
      .toBe(false);
    expect(llmStream).not.toHaveBeenCalled();
  });
});
