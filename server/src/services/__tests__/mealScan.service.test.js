import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  analyzeMealImage,
  normalizeMealScanResult,
} from "../mealScan.service.js";

const providerItem = {
  label: "Cơm trắng",
  portionGrams: { min: 90, estimate: 100, max: 120 },
  calories: { min: 117, estimate: 130, max: 156 },
  protein: { min: 2, estimate: 3, max: 4 },
  carb: { min: 25, estimate: 28, max: 34 },
  fat: { min: 0, estimate: 0, max: 1 },
  note: "Khó xác định chính xác khối lượng từ ảnh.",
  needsConfirmation: true,
};

describe("mealScan.service", () => {
  const originalEnv = {};

  beforeEach(() => {
    for (const key of [
      "NODE_ENV",
      "AI_PROVIDER",
      "MEAL_SCAN_PROVIDER",
      "GEMINI_API_KEY",
      "GEMINI_MODEL",
      "GEMINI_PAID_SERVICE_CONFIRMED",
    ]) {
      originalEnv[key] = process.env[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("normalizes ranges and derives totals from ingredient items", () => {
    const result = normalizeMealScanResult({
      mealName: "Cơm",
      confidence: "medium",
      confidenceReasons: ["Ảnh chỉ có một góc chụp."],
      items: [providerItem, { ...providerItem, label: "Ức gà" }],
      questions: ["Có thêm dầu không?"],
    });

    expect(result.total.calories).toEqual({
      min: 104,
      estimate: 260,
      max: 520,
    });
    expect(result.items[0].id).toBe("item-1");
    expect(result.disclaimer).toContain("ước tính");
  });

  test("returns deterministic data without a provider call in mock mode", async () => {
    process.env.AI_PROVIDER = "mock";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await analyzeMealImage({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "vi",
    });

    expect(result.mealName).toContain("Dữ liệu mẫu");
    expect(result.items.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("includes declared oil in deterministic mock totals", async () => {
    process.env.NODE_ENV = "development";
    process.env.MEAL_SCAN_PROVIDER = "mock";

    const result = await analyzeMealImage({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "vi",
      declaredIngredients: [{ name: "dầu", grams: 30 }],
    });

    expect(result.total.calories.estimate).toBe(895);
    expect(result.total.fat.estimate).toBe(44.6);
    expect(result.declaredIngredients).toEqual([
      expect.objectContaining({
        name: "dầu",
        includedInTotal: true,
        calories: { min: 270, estimate: 270, max: 270 },
      }),
    ]);
  });
  test("defaults Meal Scan to mock outside production even when the global provider is Gemini", async () => {
    process.env.NODE_ENV = "development";
    process.env.AI_PROVIDER = "gemini";
    delete process.env.MEAL_SCAN_PROVIDER;
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_PAID_SERVICE_CONFIRMED = "true";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await analyzeMealImage({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "vi",
    });

    expect(result.mealName).toContain("Dữ liệu mẫu");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("uses Gemini in production and ignores the development mock override", async () => {
    process.env.NODE_ENV = "production";
    process.env.AI_PROVIDER = "gemini";
    process.env.MEAL_SCAN_PROVIDER = "mock";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-model";
    process.env.GEMINI_PAID_SERVICE_CONFIRMED = "true";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                mealName: "Cơm trắng",
                confidence: "medium",
                confidenceReasons: ["Ảnh không có vật chuẩn kích thước."],
                items: [providerItem],
                questions: ["Khẩu phần thực tế khoảng bao nhiêu gram?"],
              }),
            }],
          },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await analyzeMealImage({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "vi",
      declaredIngredients: [{ name: "Dầu ô liu", grams: 15 }],
    });

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: "image/jpeg",
      data: "YQ==",
    });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.contents[0].parts[0].text).toMatch(/Dầu ô liu.*"grams":15/i);
    expect(result.total.calories.estimate).toBe(265);
    expect(result.total.fat.estimate).toBe(15);
  });

  test("fails closed when provider output has no valid ingredients", async () => {
    process.env.AI_PROVIDER = "gemini";
    process.env.MEAL_SCAN_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_PAID_SERVICE_CONFIRMED = "true";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "{}" }] } }],
      }),
    }));

    await expect(
      analyzeMealImage({
        mimeType: "image/jpeg",
        base64: "YQ==",
        locale: "vi",
      }),
    ).rejects.toMatchObject({
      code: "MEAL_SCAN_INVALID_OUTPUT",
      status: 502,
    });
  });

  test("fails closed with an actionable code when no food is visible", () => {
    expect(() =>
      normalizeMealScanResult({
        analysisStatus: "non_food",
        imageAssessment: {
          foodVisible: false,
          quality: "usable",
          scenario: "unknown",
        },
        items: [],
      }),
    ).toThrow(
      expect.objectContaining({ code: "MEAL_SCAN_NO_FOOD", status: 422 }),
    );
  });

  test("forces shared meals to low confidence and preserves nutrition-label source", () => {
    const result = normalizeMealScanResult({
      analysisStatus: "ok",
      imageAssessment: {
        foodVisible: true,
        quality: "good",
        scenario: "shared_meal",
        servingsVisible: 4,
        nutritionLabelVisible: true,
        barcodeVisible: false,
        issues: ["Multiple servings are visible."],
      },
      mealName: "Shared pizza",
      confidence: "medium",
      confidenceReasons: [],
      scaleReferenceVisible: true,
      items: [{
        ...providerItem,
        dataSource: "nutrition_label",
      }],
      questions: ["How many slices did you eat?"],
    }, "en");

    expect(result).toMatchObject({
      confidence: "low",
      imageAssessment: {
        scenario: "shared_meal",
        servingsVisible: 4,
      },
      items: [{ dataSource: "nutrition_label" }],
    });
  });
});
