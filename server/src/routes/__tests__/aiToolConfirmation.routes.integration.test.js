import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  clearCollections,
  createTestApp,
  createTestUser,
  setupTestDB,
  teardownTestDB,
  withAuth,
} from "../../__tests__/setup.js";
import {
  cancelAiTool,
  confirmAiTool,
} from "../../controllers/aiToolConfirmation.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";
import { csrfProtection } from "../../middlewares/csrf.js";
import { validateAiToolConfirmation } from "../../middlewares/validation.js";
import { createAiToolConfirmation } from "../../services/ai/toolConfirmation.service.js";
import { toolRegistry } from "../../services/ai/tools/toolRegistry.js";

const executor = vi.fn().mockResolvedValue({ text: "mutation-complete" });
const confirmationTool = toolRegistry.calculate_tdee;
const originalToolState = {
  execute: confirmationTool.execute,
  requiresAuth: confirmationTool.requiresAuth,
  requiresConfirmation: confirmationTool.requiresConfirmation,
  readOnly: confirmationTool.readOnly,
  parallelSafe: confirmationTool.parallelSafe,
  confirmation: confirmationTool.confirmation,
};
const validParameters = {
  gender: "male",
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activityLevel: "moderate",
  dailyMovement: "mixed",
  steps: "between_8000_11999",
  trainingFrequency: "three_four",
  trainingDuration: "between_45_60",
  trainingIntensity: "moderate",
  goal: "maintenance",
};

describe("AI tool confirmation HTTP boundary", () => {
  let app;

  beforeAll(async () => {
    Object.assign(confirmationTool, {
      execute: executor,
      requiresAuth: true,
      requiresConfirmation: true,
      readOnly: false,
      parallelSafe: false,
      confirmation: {
        title: "Xác nhận tính toán",
        description: "Thực hiện hành động synthetic cho integration test.",
      },
    });
    await setupTestDB();
    app = createTestApp();
    const router = express.Router();
    router.post(
      "/confirm",
      protect,
      csrfProtection,
      validateAiToolConfirmation,
      confirmAiTool,
    );
    router.post(
      "/cancel",
      protect,
      csrfProtection,
      validateAiToolConfirmation,
      cancelAiTool,
    );
    app.use("/api/ai/tool-confirmations", router);
  });
  afterEach(async () => {
    vi.clearAllMocks();
    await clearCollections();
  });
  afterAll(async () => {
    Object.assign(confirmationTool, originalToolState);
    await teardownTestDB();
  });

  it("requires both authentication and CSRF before reading the challenge", async () => {
    const user = await createTestUser({ email: "confirm-http-auth@example.com" });
    const challenge = await createAiToolConfirmation({
      userId: user.user._id,
      toolName: "calculate_tdee",
      parameters: validParameters,
    });

    const anonymous = await request(app)
      .post("/api/ai/tool-confirmations/confirm")
      .send({ token: challenge.token });
    const noCsrf = await request(app)
      .post("/api/ai/tool-confirmations/confirm")
      .set("Cookie", [`accessToken=${user.accessToken}`])
      .send({ token: challenge.token });

    expect([anonymous.status, noCsrf.status]).toEqual([401, 403]);
    expect(executor).not.toHaveBeenCalled();
  });

  it("isolates owners and allows the real owner exactly once", async () => {
    const owner = await createTestUser({ email: "confirm-http-owner@example.com" });
    const other = await createTestUser({ email: "confirm-http-other@example.com" });
    const challenge = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "calculate_tdee",
      parameters: validParameters,
    });

    const wrongOwner = await withAuth(
      request(app).post("/api/ai/tool-confirmations/confirm"),
      other.accessToken,
    ).send({ token: challenge.token });
    const confirmed = await withAuth(
      request(app).post("/api/ai/tool-confirmations/confirm"),
      owner.accessToken,
    ).send({ token: challenge.token });
    const replay = await withAuth(
      request(app).post("/api/ai/tool-confirmations/confirm"),
      owner.accessToken,
    ).send({ token: challenge.token });

    expect([wrongOwner.status, confirmed.status, replay.status]).toEqual([
      409, 200, 409,
    ]);
    expect(confirmed.body).toMatchObject({
      success: true,
      data: { completed: true },
    });
    expect(confirmed.body).not.toHaveProperty("data.toolName");
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(
      validParameters,
      expect.objectContaining({ userId: owner.user._id }),
    );
  });

  it("rejects body tampering before consuming the challenge", async () => {
    const owner = await createTestUser({ email: "confirm-http-body@example.com" });
    const challenge = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "calculate_tdee",
      parameters: validParameters,
    });

    const tampered = await withAuth(
      request(app).post("/api/ai/tool-confirmations/confirm"),
      owner.accessToken,
    ).send({ token: challenge.token, toolName: "check_wallet" });
    const cancelled = await withAuth(
      request(app).post("/api/ai/tool-confirmations/cancel"),
      owner.accessToken,
    ).send({ token: challenge.token });

    expect([tampered.status, cancelled.status]).toEqual([400, 200]);
    expect(executor).not.toHaveBeenCalled();
  });
});
