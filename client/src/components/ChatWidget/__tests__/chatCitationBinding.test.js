import { describe, expect, it } from "vitest";

import { bindTurnCitationCards } from "../chatCitationBinding";
import { mapAiMessages } from "../../../hooks/useAiChat";

const card = { cardType: "webSources", data: { sources: [{ title: "Guide", uri: "https://example.org/guide" }] } };

describe("chat citation turn binding", () => {
  it("moves a hydrated tool-card placeholder to the following assistant in the same user turn", () => {
    const hydrated = mapAiMessages([
      { role: "user", content: "Câu hỏi" },
      { role: "assistant", content: "" },
      { role: "tool", uiCard: card },
      { role: "assistant", content: "Câu trả lời có [nguồn](https://example.org/guide)." },
    ]);
    const result = bindTurnCitationCards(hydrated);

    expect(result[1].uiCards).toEqual([]);
    expect(result[2].uiCards).toEqual([card]);
  });

  it("does not bind a source across a later user turn", () => {
    const result = bindTurnCitationCards([
      { role: "user", content: "Câu hỏi cũ" },
      { role: "assistant", content: "", uiCards: [card] },
      { role: "user", content: "Câu hỏi mới" },
      { role: "assistant", content: "Trả lời mới", uiCards: [] },
    ]);

    expect(result[3].uiCards).toEqual([]);
  });

  it("keeps a live source card already paired with assistant text", () => {
    const result = bindTurnCitationCards([
      { role: "user", content: "Câu hỏi" },
      { role: "assistant", content: "Câu trả lời", uiCards: [card] },
    ]);

    expect(result[1].uiCards).toEqual([card]);
  });

  it("keeps a source disclosure visible while the final answer is still pending", () => {
    const result = bindTurnCitationCards([
      { role: "user", content: "Câu hỏi" },
      { role: "assistant", content: "", uiCards: [card] },
    ]);

    expect(result[1].uiCards).toEqual([card]);
  });
});
