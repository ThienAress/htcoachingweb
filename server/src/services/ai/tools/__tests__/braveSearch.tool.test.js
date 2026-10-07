import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const synthesis = vi.hoisted(() => vi.fn());
vi.mock("../../webGroundingSynthesis.js", () => ({ synthesizeWebEvidence: synthesis }));
import { braveSearchKnowledge } from "../braveSearch.adapter.js";

beforeEach(() => {
  vi.stubEnv("BRAVE_SEARCH_API_KEY", "synthetic-key");
  synthesis.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const body = { grounding: { generic: [{ url: "https://who.int/physical-activity", title: "Physical activity",
  snippets: ["Adults should do at least 150–300 minutes of moderate-intensity physical activity throughout the week."] }] } };

describe("Brave search adapter", () => {
  it("does not externalize private health data or send requests without a key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await braveSearchKnowledge({ query: "Tôi bị đau đầu gối khi squat" })).meta)
      .toMatchObject({ evidenceAvailable: false, diagnosticCode: "privacy_blocked", providerRequestMade: false });
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
    expect((await braveSearchKnowledge({ query: "WHO physical activity guidelines" })).meta)
      .toMatchObject({ diagnosticCode: "search_not_configured", providerRequestMade: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(synthesis).not.toHaveBeenCalled();
  });

  it("searches once through the fixed endpoint and returns only synthesis-bound sources", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
    vi.stubGlobal("fetch", fetchMock);
    const answer = { text: "Khuyến nghị 150–300 phút mỗi tuần.",
      sources: [{ title: "Physical activity (who.int)", uri: "https://who.int/physical-activity" }] };
    synthesis.mockResolvedValue(answer);
    const result = await braveSearchKnowledge({ query: "WHO physical activity guidelines" }, { deadlineAt: Date.now() + 30_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.search.brave.com/res/v1/llm/context");
    expect(options).toMatchObject({ method: "POST", redirect: "error" });
    expect(JSON.parse(options.body)).toMatchObject({ enable_local: false, count: 6, maximum_number_of_tokens: 4096 });
    expect(synthesis).toHaveBeenCalledTimes(1);
    expect(result.meta).toMatchObject({ evidenceAvailable: true, searchOutcome: "grounded", sourceCount: 1 });
    expect(result.uiCard.data.sources).toEqual(answer.sources);
  });

  it.each([401, 403, 429, 500])("fails closed on HTTP %s with no synthesis/retry", async (status) => {
    const fetchMock = vi.fn(async () => new Response("upstream", { status }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await braveSearchKnowledge({ query: "WHO physical activity guidelines" });
    expect(result.meta).toMatchObject({ evidenceAvailable: false, searchOutcome: "provider_error", providerRequestMade: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(synthesis).not.toHaveBeenCalled();
  });

  it("rejects oversized response and empty/invalid evidence without synthesis", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { headers: { "content-length": "300000" } })));
    expect((await braveSearchKnowledge({ query: "WHO physical activity guidelines" })).meta.evidenceAvailable).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    expect((await braveSearchKnowledge({ query: "WHO physical activity guidelines" })).meta.searchOutcome)
      .toBe("no_supported_source");
    expect(synthesis).not.toHaveBeenCalled();
  });

  it("does not fabricate an answer when synthesis fails, and propagates cancellation", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)));
    vi.stubGlobal("fetch", fetchMock);
    synthesis.mockRejectedValue(new Error("provider error includes private text"));
    expect((await braveSearchKnowledge({ query: "WHO physical activity guidelines" })).meta)
      .toMatchObject({ diagnosticCode: "synthesis_failed", evidenceAvailable: false });
    const controller = new AbortController();
    controller.abort();
    await expect(braveSearchKnowledge({ query: "WHO physical activity guidelines" }, { signal: controller.signal }))
      .rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
