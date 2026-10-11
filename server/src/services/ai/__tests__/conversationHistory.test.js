import { describe, expect, it } from "vitest";
import { selectConversationHistory } from "../conversationHistory.js";

describe("bounded complete tool history", () => {
  it("drops only the cut leading tool-result group and retains the newest context", () => {
    const messages = [
      { role: "user", content: "Old question" },
      { role: "assistant", toolCalls: [{ id: "old-call", name: "calculate_tdee", args: {} }] },
      { role: "tool", toolCallId: "old-call", content: "Old result" },
      { role: "assistant", content: "Old answer" },
      ...Array.from({ length: 18 }, (_, index) => ({ role: "user", content: `context-${index}` })),
    ];
    expect(selectConversationHistory(messages, 20)).toEqual(messages.slice(3));
  });
  it("preserves complete parallel tool groups in order", () => {
    const messages = [
      { role: "assistant", toolCalls: [{ id: "a" }, { id: "b" }] },
      { role: "tool", toolCallId: "a" }, { role: "tool", toolCallId: "b" },
      { role: "assistant", content: "Summary" }, { role: "user", content: "Follow-up" },
    ];
    expect(selectConversationHistory(messages, 20)).toEqual(messages);
  });
  it("does not hide genuine orphan rows when no boundary was cut", () => {
    const messages = [{ role: "tool", toolCallId: "unknown" }, { role: "user", content: "Next" }];
    expect(selectConversationHistory(messages, 20)).toEqual(messages);
  });
});
