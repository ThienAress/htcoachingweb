import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readPanel = () =>
  readFileSync(new URL("../ChatPanel.jsx", import.meta.url), "utf8");

describe("persisted chat message DOM identity", () => {
  it("exposes only an existing persisted message id for live acceptance reconciliation", () => {
    expect(readPanel()).toContain("data-message-id={msg._id || undefined}");
  });
});
