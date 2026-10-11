import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { replaceConversationMealItem } = vi.hoisted(() => ({
  replaceConversationMealItem: vi.fn(),
}));

vi.mock("../../services/ai/mealReplacement.service.js", () => ({
  replaceConversationMealItem,
}));

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import { replaceMealItem } from "../../controllers/aiMeal.controller.js";
import { ensureAiActor } from "../../middlewares/aiGuestSession.js";
import { csrfProtection } from "../../middlewares/csrf.js";
import { optionalAiAuth } from "../../middlewares/optionalAiAuth.js";
import { validateAiMealReplacement } from "../../middlewares/validation.js";

const MEAL_PLAN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";

describe("AI meal replacement HTTP boundary", () => {
  let app;

  beforeAll(async () => {
    await setupTestDB();
    app = createTestApp();
    const router = express.Router();
    router.post(
      "/:id/meal-replacements",
      optionalAiAuth,
      ensureAiActor,
      csrfProtection,
      validateAiMealReplacement,
      replaceMealItem,
    );
    app.use("/api/ai/conversations", router);
  });
  afterEach(async () => {
    vi.clearAllMocks();
    await clearCollections();
  });
  afterAll(teardownTestDB);

  it("requires auth and CSRF and rejects over-posted replacement payloads", async () => {
    const owner = await createTestUser({
      email: "meal-replacement-http@example.test",
    });
    const conversationId = "507f1f77bcf86cd799439011";
    const payload = {
      operationId: OPERATION_ID,
      mealPlanId: MEAL_PLAN_ID,
      expectedRevision: 1,
      mealIndex: 0,
      foodIndex: 0,
    };

    const anonymous = await request(app)
      .post(`/api/ai/conversations/${conversationId}/meal-replacements`)
      .send(payload);
    const noCsrf = await request(app)
      .post(`/api/ai/conversations/${conversationId}/meal-replacements`)
      .set("Cookie", [`accessToken=${owner.accessToken}`])
      .send(payload);
    const overPosted = await withAuth(
      request(app).post(
        `/api/ai/conversations/${conversationId}/meal-replacements`,
      ),
      owner.accessToken,
    ).send({ ...payload, targetCalories: 1 });

    expect([anonymous.status, noCsrf.status, overPosted.status]).toEqual([
      403,
      403,
      400,
    ]);
    expect(replaceConversationMealItem).not.toHaveBeenCalled();
  });

  it("passes only the authenticated owner and validated indexes to the service", async () => {
    const owner = await createTestUser({
      email: "meal-replacement-owner@example.test",
    });
    const conversationId = "507f1f77bcf86cd799439012";
    replaceConversationMealItem.mockResolvedValue({
      card: { cardType: "meal", data: { mealRevision: 2 } },
    });

    const response = await withAuth(
      request(app).post(
        `/api/ai/conversations/${conversationId}/meal-replacements`,
      ),
      owner.accessToken,
    ).send({
      operationId: OPERATION_ID,
      mealPlanId: MEAL_PLAN_ID,
      expectedRevision: "1",
      mealIndex: "0",
      foodIndex: "2",
    });

    expect(response.status).toBe(200);
    expect(replaceConversationMealItem).toHaveBeenCalledWith({
      conversationId,
      ownerFilter: { userId: owner.user._id },
      operationId: OPERATION_ID,
      mealPlanId: MEAL_PLAN_ID,
      expectedRevision: 1,
      mealIndex: 0,
      foodIndex: 2,
    });
  });

  it("preserves the production guest actor boundary", async () => {
    const conversationId = "507f1f77bcf86cd799439013";
    replaceConversationMealItem.mockResolvedValue({
      card: { cardType: "meal", data: { mealRevision: 2 } },
    });

    const response = await request(app)
      .post(`/api/ai/conversations/${conversationId}/meal-replacements`)
      .set("Cookie", [
        "htAiGuest=33333333-3333-4333-8333-333333333333",
        "csrfToken=test-csrf-token",
      ])
      .set("X-CSRF-Token", "test-csrf-token")
      .send({
        operationId: OPERATION_ID,
        mealPlanId: MEAL_PLAN_ID,
        expectedRevision: 1,
        mealIndex: 0,
        foodIndex: 0,
      });

    expect(response.status).toBe(200);
    expect(replaceConversationMealItem).toHaveBeenCalledWith({
      conversationId,
      ownerFilter: { guestKey: expect.stringMatching(/^[a-f0-9]{64}$/) },
      operationId: OPERATION_ID,
      mealPlanId: MEAL_PLAN_ID,
      expectedRevision: 1,
      mealIndex: 0,
      foodIndex: 0,
    });
  });

  it("returns the owner-scoped current card when a stale request must reconcile", async () => {
    const owner = await createTestUser({
      email: "meal-replacement-reconcile@example.test",
    });
    const conversationId = "507f1f77bcf86cd799439014";
    replaceConversationMealItem.mockRejectedValue(
      Object.assign(new Error("Thực đơn đã thay đổi."), {
        status: 409,
        code: "AI_MEAL_REVISION_CONFLICT",
        isOperational: true,
        data: {
          card: {
            cardType: "meal",
            data: { mealPlanId: MEAL_PLAN_ID, mealRevision: 2 },
          },
        },
      }),
    );

    const response = await withAuth(
      request(app).post(
        `/api/ai/conversations/${conversationId}/meal-replacements`,
      ),
      owner.accessToken,
    ).send({
      operationId: OPERATION_ID,
      mealPlanId: MEAL_PLAN_ID,
      expectedRevision: 1,
      mealIndex: 0,
      foodIndex: 0,
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      code: "AI_MEAL_REVISION_CONFLICT",
      data: { card: { data: { mealRevision: 2 } } },
    });
  });
});
