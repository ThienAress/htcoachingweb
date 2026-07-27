import { describe, expect, it } from "vitest";
import { createChatHistoryLoadGate } from "../chatHistoryLoadGate.js";

describe("createChatHistoryLoadGate", () => {
  it("does not reload history after the same user starts a new chat", () => {
    const gate = createChatHistoryLoadGate();

    const firstOpen = gate.shouldLoad("user-1");
    const afterNewConversation = gate.shouldLoad("user-1");

    expect({ firstOpen, afterNewConversation }).toEqual({
      firstOpen: true,
      afterNewConversation: false,
    });
  });

  it("loads history when the authenticated user changes", () => {
    const gate = createChatHistoryLoadGate();
    gate.shouldLoad("user-1");

    expect(gate.shouldLoad("user-2")).toBe(true);
  });
});
