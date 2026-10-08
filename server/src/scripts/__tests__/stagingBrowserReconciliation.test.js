import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runBrowserAcceptance } from "../stagingAiChatAcceptance.browser.js";
import { reconciliationBrowserFixture } from "./fixtures/stagingBrowserReconciliation.js";

describe("AC-009 completed conversation baseline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const exerciseIsolation = async (options) => {
    const result = runBrowserAcceptance(reconciliationBrowserFixture(options));
    const outcome = result.then(() => null, (error) => error);
    await vi.runAllTimersAsync();
    return outcome;
  };

  it("compares the finalized answer when a citation appears before the streamed suffix", async () => {
    const error = await exerciseIsolation({ initiallyComplete: false });

    expect(error).toMatchObject({ code: "TEST_ISOLATION_CHECKPOINT" });
  });

  it("also accepts a completed answer that was already rendered when the citation appeared", async () => {
    const error = await exerciseIsolation({ initiallyComplete: true });

    expect(error).toMatchObject({ code: "TEST_ISOLATION_CHECKPOINT" });
  });

  it("continues to reject a real content change when returning from the pending conversation", async () => {
    const error = await exerciseIsolation({ initiallyComplete: true, changedOnReturn: true });

    expect(error).toMatchObject({ code: "STAGING_AI_ISOLATION_CONTENT_CHANGED" });
  });
});
