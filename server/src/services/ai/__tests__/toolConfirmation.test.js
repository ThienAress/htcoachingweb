import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  clearCollections,
  createTestUser,
  setupTestDB,
  teardownTestDB,
} from "../../../__tests__/setup.js";
import AiToolConfirmation from "../../../models/AiToolConfirmation.js";
import {
  cancelAiToolAction,
  confirmAiToolAction,
  createAiToolConfirmation,
  serializeAiToolConfirmationCard,
} from "../toolConfirmation.service.js";
import { toolRegistry } from "../tools/toolRegistry.js";

const testTool = {
  name: "test_mutation",
  parameters: { type: "object", additionalProperties: false, properties: {} },
  requiresAuth: true,
  requiresConfirmation: true,
  confirmation: {
    title: "Xác nhận test mutation",
    description: "Thực hiện synthetic mutation đã kiểm thử.",
  },
  readOnly: false,
  parallelSafe: false,
  execute: vi.fn(),
};

beforeAll(async () => {
  toolRegistry.test_mutation = testTool;
  await setupTestDB();
});
afterEach(async () => {
  vi.clearAllMocks();
  await clearCollections();
});
afterAll(async () => {
  delete toolRegistry.test_mutation;
  await teardownTestDB();
});

describe("AI tool confirmation challenge", () => {
  it("stores only a token hash and executes once for the owning user", async () => {
    const owner = await createTestUser({ email: "confirm-owner@example.com" });
    const executor = vi.fn().mockResolvedValue({ text: "done" });
    const challenge = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "test_mutation",
      parameters: { recordId: "record-1" },
    });

    const stored = await AiToolConfirmation.findOne();
    const first = await confirmAiToolAction({
      userId: owner.user._id,
      token: challenge.token,
      executor,
    });

    expect(String(stored._id)).toMatch(/^[a-f0-9]{64}$/);
    expect(String(stored._id)).not.toBe(challenge.token);
    expect(serializeAiToolConfirmationCard(challenge).data).toEqual({
      token: challenge.token,
      expiresAt: challenge.expiresAt,
      title: "Xác nhận test mutation",
      description: "Thực hiện synthetic mutation đã kiểm thử.",
    });
    expect(first).toEqual({ completed: true });
    expect(first).not.toHaveProperty("toolName");
    expect(executor).toHaveBeenCalledWith(
      "test_mutation",
      { recordId: "record-1" },
      expect.objectContaining({
        userId: owner.user._id,
        confirmationId: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    await expect(
      confirmAiToolAction({
        userId: owner.user._id,
        token: challenge.token,
        executor,
      }),
    ).rejects.toMatchObject({ code: "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED" });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it("marks an execution failure consumed so the mutation cannot replay", async () => {
    const owner = await createTestUser({ email: "confirm-failure@example.com" });
    const challenge = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "test_mutation",
      parameters: {},
    });
    const failingExecutor = vi.fn().mockResolvedValue({
      text: "friendly failure",
      error: null,
      meta: { internalError: "synthetic" },
    });

    await expect(
      confirmAiToolAction({
        userId: owner.user._id,
        token: challenge.token,
        executor: failingExecutor,
      }),
    ).rejects.toMatchObject({
      code: "AI_TOOL_CONFIRMATION_EXECUTION_FAILED",
      consumed: true,
    });
    await expect(
      confirmAiToolAction({
        userId: owner.user._id,
        token: challenge.token,
        executor: failingExecutor,
      }),
    ).rejects.toMatchObject({ code: "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED" });
    expect(failingExecutor).toHaveBeenCalledTimes(1);
  });

  it("rejects a different owner without consuming the challenge", async () => {
    const owner = await createTestUser({ email: "confirm-owner2@example.com" });
    const attacker = await createTestUser({ email: "confirm-attacker@example.com" });
    const executor = vi.fn();
    const challenge = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "test_mutation",
      parameters: {},
    });

    await expect(
      confirmAiToolAction({
        userId: attacker.user._id,
        token: challenge.token,
        executor,
      }),
    ).rejects.toMatchObject({ code: "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED" });
    await confirmAiToolAction({
      userId: owner.user._id,
      token: challenge.token,
      executor: vi.fn().mockResolvedValue({ text: "owner" }),
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it("rejects expiry and cancellation replay", async () => {
    const owner = await createTestUser({ email: "confirm-expiry@example.com" });
    const createdAt = new Date("2026-08-13T00:00:00.000Z");
    const expired = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "test_mutation",
      parameters: {},
      now: createdAt,
    });
    await expect(
      confirmAiToolAction({
        userId: owner.user._id,
        token: expired.token,
        now: new Date(createdAt.getTime() + 5 * 60 * 1000 + 1),
        executor: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED" });

    const cancelled = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "test_mutation",
      parameters: {},
    });
    await cancelAiToolAction({ userId: owner.user._id, token: cancelled.token });
    await expect(
      cancelAiToolAction({ userId: owner.user._id, token: cancelled.token }),
    ).rejects.toMatchObject({ code: "AI_TOOL_CONFIRMATION_EXPIRED_OR_USED" });
  });

  it("bounds stored parameters by UTF-8 bytes", async () => {
    const owner = await createTestUser({ email: "confirm-size@example.com" });

    await expect(
      createAiToolConfirmation({
        userId: owner.user._id,
        toolName: "test_mutation",
        parameters: { value: "é".repeat(5_000) },
      }),
    ).rejects.toMatchObject({
      code: "AI_TOOL_CONFIRMATION_PARAMETERS_TOO_LARGE",
    });
    expect(await AiToolConfirmation.countDocuments()).toBe(0);
  });

  it("requires confirmable tools to be authenticated mutations", async () => {
    const owner = await createTestUser({ email: "confirm-capability@example.com" });
    const original = {
      requiresAuth: testTool.requiresAuth,
      readOnly: testTool.readOnly,
      parallelSafe: testTool.parallelSafe,
    };
    try {
      Object.assign(testTool, { requiresAuth: false, readOnly: true });
      await expect(
        createAiToolConfirmation({
          userId: owner.user._id,
          toolName: "test_mutation",
          parameters: {},
        }),
      ).rejects.toMatchObject({ code: "AI_TOOL_CONFIRMATION_UNAVAILABLE" });
    } finally {
      Object.assign(testTool, original);
    }
  });

  it("rechecks mutation capabilities before executing a consumed challenge", async () => {
    const owner = await createTestUser({ email: "confirm-drift@example.com" });
    const challenge = await createAiToolConfirmation({
      userId: owner.user._id,
      toolName: "test_mutation",
      parameters: {},
    });
    const originalReadOnly = testTool.readOnly;
    try {
      testTool.readOnly = true;
      await expect(
        confirmAiToolAction({
          userId: owner.user._id,
          token: challenge.token,
          executor: vi.fn(),
        }),
      ).rejects.toMatchObject({
        code: "AI_TOOL_CONFIRMATION_EXECUTION_FAILED",
        consumed: true,
      });
    } finally {
      testTool.readOnly = originalReadOnly;
    }
  });
});
