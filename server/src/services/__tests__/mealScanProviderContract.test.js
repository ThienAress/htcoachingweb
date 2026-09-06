import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fetchMealScanEstimate } from "../mealScan.provider.js";
import {
  getMetricsSnapshot,
  resetMetricsForTests,
} from "../../observability/metrics.js";

describe("meal scan provider calibration contract", () => {
  beforeEach(() => {
    resetMetricsForTests();
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-model";
    process.env.GEMINI_PAID_SERVICE_CONFIRMED = "true";
    process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED = "false";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_PAID_SERVICE_CONFIRMED;
    delete process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("does not send customer images until provider data use is approved", async () => {
    process.env.GEMINI_PAID_SERVICE_CONFIRMED = "false";
    process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED = "false";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      fetchMealScanEstimate({
        mimeType: "image/jpeg",
        base64: "YQ==",
        locale: "vi",
      }),
    ).rejects.toMatchObject({
      code: "MEAL_SCAN_PROVIDER_NOT_CONFIGURED",
      status: 503,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("allows an explicitly accepted unpaid Gemini Meal Scan request", async () => {
    process.env.GEMINI_PAID_SERVICE_CONFIRMED = "false";
    process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED = "true";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ mealName: "Bun bo" }) }],
          },
        }],
        usageMetadata: {
          promptTokenCount: 80,
          candidatesTokenCount: 12,
          totalTokenCount: 92,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      fetchMealScanEstimate({
        mimeType: "image/jpeg",
        base64: "YQ==",
        locale: "vi",
      }),
    ).resolves.toMatchObject({ mealName: "Bun bo" });
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_meal_scan_requests": 1,
      "provider.gemini_meal_scan_succeeded": 1,
      "provider.gemini_meal_scan_prompt_tokens": 80,
      "provider.gemini_meal_scan_output_tokens": 12,
      "provider.gemini_meal_scan_total_tokens": 92,
    });
  });

  test("asks Gemini for scale evidence and explicit confidence discipline", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                mealName: "Rice",
                confidence: "low",
                confidenceReasons: ["No size reference."],
                scaleReferenceVisible: false,
                items: [],
                questions: [],
              }),
            }],
          },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchMealScanEstimate({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "en",
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect({
      required: body.generationConfig.responseJsonSchema.required,
      prompt: body.contents[0].parts[0].text,
      highPolicy: body.contents[0].parts[0].text,
    }).toMatchObject({
      required: expect.arrayContaining([
        "analysisStatus",
        "imageAssessment",
        "scaleReferenceVisible",
      ]),
      prompt: expect.stringMatching(/known-size|size reference/i),
      highPolicy: expect.stringMatching(/never use high/i),
    });
  });

  test("requires Vietnamese in every user-visible field without restricting cuisine", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                analysisStatus: "ok",
                imageAssessment: {
                  foodVisible: true,
                  quality: "usable",
                  scenario: "dessert",
                  servingsVisible: 1,
                  nutritionLabelVisible: false,
                  barcodeVisible: false,
                  issues: [],
                },
                mealName: "Bánh sừng bò",
                confidence: "low",
                confidenceReasons: ["Không thấy phần nhân bên trong."],
                scaleReferenceVisible: false,
                items: [],
                questions: [],
              }),
            }],
          },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchMealScanEstimate({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "vi",
    });

    const prompt = JSON.parse(fetchSpy.mock.calls[0][1].body)
      .contents[0].parts[0].text;
    expect(prompt).toMatch(/mọi trường văn bản.*tiếng Việt/i);
    expect(prompt).toMatch(/mọi nền ẩm thực|all cuisines/i);
    expect(prompt).toMatch(/desserts and bakery.*separate visibly distinct/i);
  });


  test("labels declared ingredients as fallible user context in the prompt", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ mealName: "Salad" }) }],
          },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchMealScanEstimate({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "vi",
      declaredIngredients: [{ name: "Dầu ô liu", grams: 15 }],
    });

    const prompt = JSON.parse(fetchSpy.mock.calls[0][1].body)
      .contents[0].parts[0].text;
    expect(prompt).toMatch(/Dầu ô liu.*"grams":15/i);
    expect(prompt).toMatch(/người dùng khai báo|user-provided/i);
    expect(prompt).toMatch(/không phải.*bằng chứng|not.*evidence/i);
    expect(prompt).toMatch(/không.*trùng|do not.*duplicate/i);
  });
  test("retries one transient HTTP failure within the same provider deadline", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify({ mealName: "Tiramisu" }) }],
            },
          }],
        }),
      });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      fetchMealScanEstimate({
        mimeType: "image/jpeg",
        base64: "YQ==",
        locale: "vi",
      }),
    ).resolves.toMatchObject({ mealName: "Tiramisu" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_meal_scan_requests": 2,
      "provider.gemini_meal_scan_failed": 1,
      "provider.gemini_meal_scan_succeeded": 1,
    });
  });

  test("retries one network failure but not a permanent HTTP failure", async () => {
    const successResponse = {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify({ mealName: "Bibimbap" }) }],
          },
        }],
      }),
    };
    const networkFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(successResponse);
    vi.stubGlobal("fetch", networkFetch);

    await expect(
      fetchMealScanEstimate({
        mimeType: "image/jpeg",
        base64: "YQ==",
        locale: "vi",
      }),
    ).resolves.toMatchObject({ mealName: "Bibimbap" });
    expect(networkFetch).toHaveBeenCalledTimes(2);

    const permanentFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal("fetch", permanentFetch);
    await expect(
      fetchMealScanEstimate({
        mimeType: "image/jpeg",
        base64: "YQ==",
        locale: "vi",
      }),
    ).rejects.toMatchObject({ code: "MEAL_SCAN_PROVIDER_FAILED" });
    expect(permanentFetch).toHaveBeenCalledTimes(1);
    expect(getMetricsSnapshot().counters).toMatchObject({
      "provider.gemini_meal_scan_requests": 3,
      "provider.gemini_meal_scan_failed": 2,
      "provider.gemini_meal_scan_succeeded": 1,
    });
  });
});
