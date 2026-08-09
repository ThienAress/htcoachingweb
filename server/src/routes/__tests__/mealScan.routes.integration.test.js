import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import WalletTransaction from "../../models/WalletTransaction.js";
import mealScanRoutes from "../mealScan.routes.js";
import { analyzeMealImage } from "../../services/mealScan.service.js";

vi.mock("../../services/mealScan.service.js", () => ({
  analyzeMealImage: vi.fn(),
}));

const VALID_IMAGE = "data:image/jpeg;base64,YQ==";
const TEST_CSRF = "a".repeat(64);

const anonymousScan = (app, ip, body = {}) =>
  request(app)
    .post("/api/meal-scans/analyze")
    .set("X-Forwarded-For", ip)
    .set("Cookie", [`csrfToken=${TEST_CSRF}`])
    .set("X-CSRF-Token", TEST_CSRF)
    .send({
      image: VALID_IMAGE,
      locale: "vi",
      providerDataUseAccepted: true,
      ...body,
    });
const RESULT = {
  mealName: "Cơm gà",
  confidence: "medium",
  confidenceReasons: ["Khẩu phần chỉ được ước tính từ một góc ảnh."],
  total: {
    calories: { min: 400, estimate: 500, max: 600 },
    protein: { min: 25, estimate: 30, max: 35 },
    carb: { min: 45, estimate: 55, max: 65 },
    fat: { min: 10, estimate: 14, max: 18 },
  },
  items: [],
  questions: ["Món có thêm dầu hoặc sốt không?"],
  disclaimer: "Kết quả chỉ là ước tính.",
};

describe("POST /api/meal-scans/analyze", () => {
  let app;
  let originalUnpaidDataUseAccepted;

  beforeAll(async () => {
    originalUnpaidDataUseAccepted =
      process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED;
    process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED = "true";
    await setupTestDB();
    app = createTestApp({ jsonLimit: "2mb" });
    app.set("trust proxy", 1);
    app.use("/api/meal-scans", mealScanRoutes);
  });

  afterEach(async () => {
    vi.resetAllMocks();
    await clearCollections();
  });

  afterAll(async () => {
    if (originalUnpaidDataUseAccepted === undefined) {
      delete process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED;
    } else {
      process.env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED =
        originalUnpaidDataUseAccepted;
    }
    await teardownTestDB();
  });

  test("returns a private no-store estimate for an authenticated user", async () => {
    const { accessToken } = await createTestUser();
    analyzeMealImage.mockResolvedValueOnce(RESULT);

    const response = await withAuth(
      request(app).post("/api/meal-scans/analyze"),
      accessToken,
    ).send({
      image: VALID_IMAGE,
      locale: "vi",
      declaredIngredients: [{ name: "  Dầu ô liu  ", grams: 15 }],
      providerDataUseAccepted: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toMatchObject({
      success: true,
      data: RESULT,
      meta: {
        quota: {
          serviceKey: "meal_scan",
          tier: "user",
          limit: 3,
          remaining: 2,
          resetAt: expect.any(String),
        },
      },
    });
    expect(analyzeMealImage).toHaveBeenCalledWith({
      mimeType: "image/jpeg",
      base64: "YQ==",
      locale: "vi",
      declaredIngredients: [{ name: "Dầu ô liu", grams: 15 }],
    });
  });

  test("limits a regular authenticated user to three scans per 24 hours without debiting wallet", async () => {
    const { accessToken } = await createTestUser();
    analyzeMealImage.mockResolvedValue(RESULT);
    const statuses = [];
    let limitedResponse;

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await withAuth(
        request(app).post("/api/meal-scans/analyze"),
        accessToken,
      ).send({
        image: VALID_IMAGE,
        locale: "vi",
        declaredIngredients: [{ name: "  Dầu ô liu  ", grams: 15 }],
        providerDataUseAccepted: true,
      });
      statuses.push(response.status);
      if (attempt === 4) limitedResponse = response;
    }

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(limitedResponse.headers["ratelimit-policy"]).toMatch(/3;w=86400/);
    expect(limitedResponse.body).toMatchObject({
      success: false,
      code: "MEAL_SCAN_RATE_LIMITED",
      meta: { quota: { tier: "user", limit: 3, remaining: 0 } },
    });
    expect(analyzeMealImage).toHaveBeenCalledTimes(3);
    expect(await WalletTransaction.countDocuments()).toBe(0);
  });

  test("allows an anonymous scan with matching CSRF", async () => {
    analyzeMealImage.mockResolvedValueOnce(RESULT);

    const response = await anonymousScan(app, "198.51.100.10");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toMatchObject({
      success: true,
      data: RESULT,
      meta: { quota: { tier: "guest", limit: 2, remaining: 1 } },
    });
  });

  test("keeps CSRF mandatory for anonymous scans", async () => {
    const response = await request(app)
      .post("/api/meal-scans/analyze")
      .set("X-Forwarded-For", "198.51.100.11")
      .send({ image: VALID_IMAGE });

    expect(response.status).toBe(403);
    expect(analyzeMealImage).not.toHaveBeenCalled();
  });

  test("requires explicit provider data-use consent before quota or provider", async () => {
    const response = await anonymousScan(app, "198.51.100.15", {
      providerDataUseAccepted: undefined,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      code: "MEAL_SCAN_DATA_USE_CONSENT_REQUIRED",
    });
    expect(analyzeMealImage).not.toHaveBeenCalled();
  });

  test("limits anonymous provider-bound scans to two per 24 hours", async () => {
    analyzeMealImage.mockResolvedValue(RESULT);

    const first = await anonymousScan(app, "198.51.100.12");
    const second = await anonymousScan(app, "198.51.100.12");
    const third = await anonymousScan(app, "198.51.100.12");

    expect([first.status, second.status, third.status]).toEqual([200, 200, 429]);
    expect(third.body).toMatchObject({
      success: false,
      code: "MEAL_SCAN_ANONYMOUS_LIMITED",
    });
    expect(analyzeMealImage).toHaveBeenCalledTimes(2);
  });

  test("rejects a missing CSRF token", async () => {
    const { accessToken } = await createTestUser();
    const response = await request(app)
      .post("/api/meal-scans/analyze")
      .set("Cookie", [`accessToken=${accessToken}`])
      .send({ image: VALID_IMAGE });

    expect(response.status).toBe(403);
    expect(analyzeMealImage).not.toHaveBeenCalled();
  });


  test("rejects malformed declared ingredients before calling the provider", async () => {
    const response = await anonymousScan(app, "198.51.100.14", {
      image: VALID_IMAGE,
      locale: "vi",
      declaredIngredients: [{ name: "Dầu", grams: 0 }],
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      code: "MEAL_SCAN_DECLARED_INGREDIENTS_INVALID",
    });
    expect(analyzeMealImage).not.toHaveBeenCalled();
  });
  test("rejects an oversized compressed image", async () => {
    const { accessToken } = await createTestUser();
    const base64 = Buffer.alloc(300 * 1024 + 1).toString("base64");
    const response = await withAuth(
      request(app).post("/api/meal-scans/analyze"),
      accessToken,
    ).send({
      image: `data:image/jpeg;base64,${base64}`,
      providerDataUseAccepted: true,
    });

    expect(response.status).toBe(413);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(analyzeMealImage).not.toHaveBeenCalled();
  });

  test("rejects invalid anonymous image data without spending quota", async () => {
    const ip = "198.51.100.13";
    const invalid = await anonymousScan(app, ip, {
      image: "data:image/gif;base64,YQ==",
    });
    analyzeMealImage.mockResolvedValue(RESULT);
    const firstValid = await anonymousScan(app, ip);
    const secondValid = await anonymousScan(app, ip);

    expect(invalid.status).toBe(400);
    expect([firstValid.status, secondValid.status]).toEqual([200, 200]);
    expect(analyzeMealImage).toHaveBeenCalledTimes(2);
  });

  test("returns a localized retake action for a non-food image", async () => {
    const { accessToken } = await createTestUser();
    analyzeMealImage.mockRejectedValueOnce(
      Object.assign(new Error("No food"), {
        code: "MEAL_SCAN_NO_FOOD",
        status: 422,
      }),
    );

    const response = await withAuth(
      request(app).post("/api/meal-scans/analyze"),
      accessToken,
    ).send({
      image: VALID_IMAGE,
      locale: "en",
      providerDataUseAccepted: true,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      code: "MEAL_SCAN_NO_FOOD",
      message: expect.stringMatching(/food/i),
    });
  });
});
