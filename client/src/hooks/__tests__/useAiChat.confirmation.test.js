import { describe, expect, it } from "vitest";

import { isAllowedAiUiCard } from "../../components/ChatWidget/aiCardPolicy";
import { mapAiMessages } from "../useAiChat";

describe("AI read-only card policy", () => {
  it("hydrates a persisted assistant intake card after sync or reload", () => {
    const card = {
      cardType: "tdeeForm",
      data: { prefill: { gender: "male", age: 28 } },
    };

    expect(
      mapAiMessages([
        {
          _id: "assistant-1",
          role: "assistant",
          content: "Bổ sung thông tin còn thiếu.",
          uiCard: card,
        },
      ])[0],
    ).toMatchObject({
      role: "assistant",
      uiCards: [card],
    });
  });

  it("rejects mutation confirmation cards from every client ingestion path", () => {
    const confirmationCard = {
      cardType: "confirmation",
      data: { token: "opaque", expiresAt: "2026-08-13T01:00:00.000Z" },
    };
    const mapped = mapAiMessages([
      {
        _id: "assistant-1",
        role: "assistant",
        content: "Please confirm",
        uiCard: confirmationCard,
      },
      {
        _id: "tool-1",
        role: "tool",
        content: "Pending",
        uiCard: confirmationCard,
      },
    ]);

    expect({
      allowed: isAllowedAiUiCard(confirmationCard),
      hydratedCards: mapped[0].uiCards,
    }).toEqual({ allowed: false, hydratedCards: [] });
  });

  it("rejects unknown card types instead of trusting SSE cardType", () => {
    expect(
      isAllowedAiUiCard({
        cardType: "future_mutation",
        data: { action: "delete" },
      }),
    ).toBe(false);
  });

  it("hydrates a persisted web source card from the tool message", () => {
    const card = {
      cardType: "webSources",
      data: {
        topic: "Creatine",
        searchedAt: "2026-09-20T03:42:00.000Z",
        sources: [
          { title: "NIH (ods.od.nih.gov)", uri: "https://ods.od.nih.gov/creatine" },
        ],
      },
    };

    const mapped = mapAiMessages([
      { _id: "assistant-1", role: "assistant", content: "Có bằng chứng." },
      { _id: "tool-1", role: "tool", content: "Evidence", uiCard: card },
    ]);

    expect(mapped[0].uiCards).toEqual([card]);
  });
});
