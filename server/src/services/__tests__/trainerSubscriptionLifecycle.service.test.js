import { describe, expect, it } from "vitest";
import { calculateRetentionDeadlines } from "../trainerSubscriptionLifecycle.service.js";

describe("trainer subscription retention policy", () => {
  it("keeps media for 90 days and structured data for 12 months", () => {
    const accessEndedAt = new Date("2026-01-15T00:00:00.000Z");
    const deadlines = calculateRetentionDeadlines(accessEndedAt);

    expect(deadlines.mediaRetentionExpiresAt.toISOString()).toBe(
      "2026-04-15T00:00:00.000Z",
    );
    expect(deadlines.structuredRetentionExpiresAt.toISOString()).toBe(
      "2027-01-15T00:00:00.000Z",
    );
  });
});
