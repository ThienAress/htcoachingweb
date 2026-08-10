import { describe, expect, it, vi } from "vitest";

import { createAiChatSessionRegistry } from "../aiChatSessionRegistry.js";

describe("AI chat session registry", () => {
  it("keeps conversation A active while conversation B is selected", () => {
    const registry = createAiChatSessionRegistry({
      createKey: vi.fn().mockReturnValue("new-1"),
    });
    const controller = new AbortController();

    const conversationAKey = registry.selectConversation("conversation-a");
    registry.updateView(conversationAKey, (view) => ({
      ...view,
      isLoading: true,
      messages: [{ role: "assistant", content: "Đang trả lời A" }],
    }));
    registry.registerSession({
      id: "session-a",
      viewKey: conversationAKey,
      controller,
    });

    registry.selectConversation("conversation-b");
    registry.updateView(conversationAKey, (view) => ({
      ...view,
      isLoading: false,
      messages: [{ role: "assistant", content: "A đã hoàn tất" }],
    }));

    expect(controller.signal.aborted).toBe(false);
    registry.selectConversation("conversation-a");
    expect(registry.getSelectedView().messages[0].content).toBe(
      "A đã hoàn tất",
    );
  });

  it("rekeys a background new conversation without changing the selected view", () => {
    const registry = createAiChatSessionRegistry({
      createKey: vi.fn().mockReturnValueOnce("new-a").mockReturnValueOnce("new-b"),
    });
    const newConversationKey = registry.getSelectedKey();
    registry.registerSession({
      id: "session-a",
      viewKey: newConversationKey,
      controller: new AbortController(),
    });
    registry.selectConversation("conversation-b");

    registry.rekeySession("session-a", "conversation-a");

    expect(registry.getSelectedView().conversationId).toBe("conversation-b");
    expect(registry.getView("conversation-a")).toBeTruthy();
  });

  it("lists only persisted conversations that still have an active session", () => {
    const registry = createAiChatSessionRegistry({
      createKey: vi.fn().mockReturnValue("new-a"),
    });
    registry.registerSession({
      id: "session-a",
      viewKey: registry.getSelectedKey(),
      controller: new AbortController(),
    });

    registry.rekeySession("session-a", "conversation-a");
    registry.selectConversation("conversation-b");

    expect(registry.listPendingConversationIds()).toEqual(["conversation-a"]);
  });

  it("removes a conversation from the pending list when its session ends", () => {
    const registry = createAiChatSessionRegistry({
      createKey: vi.fn().mockReturnValue("new-a"),
    });
    registry.registerSession({
      id: "session-a",
      viewKey: registry.getSelectedKey(),
      controller: new AbortController(),
    });
    registry.rekeySession("session-a", "conversation-a");

    registry.removeSession("session-a");

    expect(registry.listPendingConversationIds()).toEqual([]);
  });
});
