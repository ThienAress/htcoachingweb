import { afterEach, describe, expect, it, vi } from "vitest";

import { aiLogger } from "../aiLogger.js";
import {
  AI_PROMPT_CONTRACT_HASH,
  AI_PROMPT_CONTRACT_VERSION,
  getAiPromptContractMetadata,
} from "../promptContract.js";

afterEach(() => vi.restoreAllMocks());

describe("AI prompt contract telemetry", () => {
  it("keeps an explicit version and deterministic core prompt fingerprint", () => {
    expect(getAiPromptContractMetadata()).toEqual({
      version: "2026-08-13.v1",
      hash: AI_PROMPT_CONTRACT_HASH,
    });
    expect(AI_PROMPT_CONTRACT_VERSION).toBe("2026-08-13.v1");
    expect(AI_PROMPT_CONTRACT_HASH).toBe(
      "d9d91280e7b5f467a5a134f3880351e58bb2d6eb0344841677fa8e0407568eef",
    );
  });

  it("logs only prompt metadata rather than prompt or user content", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});

    aiLogger.chatStart("user-123", "conversation-123");

    const entry = JSON.parse(output.mock.calls.at(-1)[0]);
    expect(entry).toMatchObject({
      event: "chat_start",
      promptContractVersion: AI_PROMPT_CONTRACT_VERSION,
      promptContractHash: AI_PROMPT_CONTRACT_HASH,
    });
    expect(entry).toHaveProperty("conversationRef");
    expect(entry).not.toHaveProperty("conversationId");
    expect(entry).not.toHaveProperty("prompt");
    expect(entry).not.toHaveProperty("message");
  });

  it("does not write raw AI error messages into telemetry", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("PRIVATE_CONVERSATION_SENTINEL"), {
      code: "AI_PROVIDER_FAILED",
      status: 503,
    });

    aiLogger.chatError("user-123", error, "chatStream");

    const line = output.mock.calls.at(-1)[0];
    const entry = JSON.parse(line);
    expect(entry).toMatchObject({
      event: "chat_error",
      errorName: "Error",
      errorCode: "AI_PROVIDER_FAILED",
      status: 503,
      context: "chatStream",
    });
    expect(line).not.toContain("PRIVATE_CONVERSATION_SENTINEL");
    expect(entry).not.toHaveProperty("error");
    expect(entry).not.toHaveProperty("message");
  });
});
