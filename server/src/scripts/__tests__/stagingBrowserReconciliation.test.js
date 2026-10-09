import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runBrowserAcceptance } from "../stagingAiChatAcceptance.browser.js";
import { reconciliationBrowserFixture } from "./fixtures/stagingBrowserReconciliation.js";
import { knowledgeFixtureQueries } from "../stagingAiChatAcceptance.http.js";
import { routeAiRequest } from "../../services/ai/requestRouter.js";

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

  it.each([
    ["first_citation", "STAGING_AI_INITIAL_CITATION_NOT_VISIBLE"],
    ["persisted_message", "STAGING_AI_PERSISTED_MESSAGE_NOT_VISIBLE"],
    ["persisted_citation", "STAGING_AI_PERSISTED_CITATION_NOT_VISIBLE"],
  ])("retains a bounded failure code for %s without locator details", async (failedWaitPhase, code) => {
    const error = await exerciseIsolation({ initiallyComplete: true, failedWaitPhase });
    expect(error).toMatchObject({ code });
    expect(error.message).not.toContain("private diagnostic text");
  });

  it("makes the WHO citation expectation explicit while retaining the live internal KB route", () => {
    const fixture = knowledgeFixtureQueries("htcoaching-acceptance:385eea90-778d-4d98-8e20-744463e3aebd");
    for (const question of [fixture.question, fixture.variant]) {
      expect(question).toMatch(/WHO/u);
      expect(routeAiRequest(question)).toMatchObject({
        domain: "fitness", evidence: "internal_kb", risk: "low",
        webSearchRequired: false, preferredTool: null,
      });
    }
  });
});
