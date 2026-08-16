import { describe, expect, it } from "vitest";

import { mergeEphemeralConfirmationCards } from "../useAiChat";

describe("AI ephemeral confirmation reconciliation", () => {
  it("keeps the current one-time card after persisted history reconciliation", () => {
    const persisted = [
      { role: "user", content: "Do it" },
      { role: "assistant", content: "Please confirm", uiCards: [] },
    ];
    const local = [
      {
        role: "assistant",
        localId: "current-assistant",
        content: "",
        uiCards: [
          {
            cardType: "confirmation",
            data: { token: "opaque", expiresAt: "2026-08-13T01:00:00.000Z" },
          },
        ],
      },
    ];

    const merged = mergeEphemeralConfirmationCards(
      persisted,
      local,
      "current-assistant",
    );

    expect(merged[1].uiCards).toEqual(local[0].uiCards);
    expect(persisted[1].uiCards).toEqual([]);
  });

  it("does not resurrect ordinary cards or old confirmation history", () => {
    const persisted = [{ role: "assistant", content: "Done", uiCards: [] }];
    const local = [
      { role: "assistant", uiCards: [{ cardType: "tdee", data: {} }] },
    ];

    expect(
      mergeEphemeralConfirmationCards(persisted, local, "current-assistant"),
    ).toBe(persisted);
  });

  it("does not move an older pending card onto the newest response", () => {
    const persisted = [{ role: "assistant", content: "Newest", uiCards: [] }];
    const local = [
      {
        role: "assistant",
        localId: "older-assistant",
        uiCards: [
          { cardType: "confirmation", data: { token: "older" } },
        ],
      },
    ];

    expect(
      mergeEphemeralConfirmationCards(persisted, local, "current-assistant"),
    ).toBe(persisted);
  });
});
