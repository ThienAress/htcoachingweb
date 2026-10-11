import { describe, expect, it } from "vitest";

import { resolveAiChatRetry } from "../aiChatRetry.js";

describe("AI chat retry routing", () => {
  it("resends a failed latest turn in the same conversation", () => {
    const retry = resolveAiChatRetry({
      view: {
        conversationId: "conversation-1",
        retryableFailedTurn: {
          userLocalId: "user-1",
          assistantLocalId: "assistant-1",
        },
      },
      target: { role: "user", localId: "user-1", content: "Lịch tập cho tôi" },
    });

    expect(retry).toEqual({
      mode: "same_conversation",
      conversationId: "conversation-1",
      failedUserLocalId: "user-1",
      failedAssistantLocalId: "assistant-1",
    });
  });

  it("forks only a completed historical turn", () => {
    const retry = resolveAiChatRetry({
      view: { conversationId: "conversation-1", retryableFailedTurn: null },
      target: { role: "user", _id: "message-1", content: "Lịch tập cũ" },
    });

    expect(retry).toEqual({ mode: "fork", messageId: "message-1" });
  });
});
