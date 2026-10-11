import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeSearchMock, executeExerciseSearchMock } = vi.hoisted(() => ({
  executeSearchMock: vi.fn(),
  executeExerciseSearchMock: vi.fn(),
}));

vi.mock("../toolRegistry.js", () => ({
  toolRegistry: {
    search_knowledge: {
      name: "search_knowledge",
      description: "Synthetic evidence search",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      execute: executeSearchMock,
      requiresAuth: false,
      guestEnabled: false,
      requiresConfirmation: false,
    },
    search_exercises: {
      name: "search_exercises",
      description: "Synthetic exercise search",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { searchQuery: { type: "string" } },
        required: ["searchQuery"],
      },
      execute: executeExerciseSearchMock,
      requiresAuth: false,
      guestEnabled: true,
      requiresConfirmation: false,
    },
  },
}));

import { executeTool } from "../toolEngine.js";

describe("search evidence metadata boundary", () => {
  beforeEach(() => {
    executeSearchMock.mockReset();
    executeExerciseSearchMock.mockReset();
  });

  it("keeps only bounded evidence availability metadata", async () => {
    executeSearchMock.mockResolvedValue({
      text: "Grounded answer",
      uiCard: null,
      meta: {
        evidenceAvailable: true,
        sourceCount: 99,
        sources: [
          { title: "Synthetic source", uri: "https://example.org/evidence#section", provenance: { publisherHost: "spoof.test" } },
          { title: "Unsafe source", uri: "http://example.org/unsafe" },
        ],
        rawQuery: "must not cross the boundary",
      },
    });

    const result = await executeTool(
      "search_knowledge",
      { query: "synthetic" },
      { userId: "507f191e810c19729de860ea" },
    );

    expect(result.meta).toMatchObject({
      toolName: "search_knowledge",
      evidenceAvailable: true,
      sourceCount: 1,
      sources: [
        { title: "Synthetic source", uri: "https://example.org/evidence" },
      ],
    });
    expect(result.meta).not.toHaveProperty("rawQuery");
    expect(result.meta.sources[0]).not.toHaveProperty("provenance");
  });

  it("keeps resolver-created provenance synchronized between metadata and the source card", async () => {
    const googleRedirect =
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aBc_123=";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 302,
      headers: { get: () => "https://pmc.ncbi.nlm.nih.gov/articles/PMC1" },
      body: { cancel: vi.fn().mockResolvedValue() },
    }));
    let receivedContext;
    executeSearchMock.mockImplementation(async (_parameters, context) => {
      receivedContext = context;
      return {
      text: "Grounded answer",
      uiCard: {
        cardType: "webSources",
        data: { topic: "Synthetic", sources: [{ title: "Spoofed title", uri: googleRedirect, provenance: { publisherHost: "spoof.test" } }] },
      },
      meta: {
        evidenceAvailable: true,
        sources: [{ title: "Spoofed title", uri: googleRedirect, provenance: { publisherHost: "spoof.test" } }],
        searchOutcome: "grounded",
      },
      };
    });

    const result = await executeTool(
      "search_knowledge",
      { query: "synthetic" },
      { userId: "507f191e810c19729de860ea" },
    );

    expect(result.meta.sources).toEqual([{ title: "Spoofed title", uri: googleRedirect, provenance: { kind: "google_grounding_redirect", publisherHost: "pmc.ncbi.nlm.nih.gov" } }]);
    expect(result.uiCard.data.sources).toEqual(result.meta.sources);
    expect(receivedContext.deadlineAt).toEqual(expect.any(Number));
  });

  it("includes provenance enrichment time in the observable tool duration", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00.000Z"));
    const googleRedirect =
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aBc_123=";
    vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => {
      setTimeout(() => resolve({
        status: 302,
        headers: { get: () => "https://pmc.ncbi.nlm.nih.gov/articles/PMC1" },
        body: { cancel: vi.fn().mockResolvedValue() },
      }), 25);
    })));
    executeSearchMock.mockResolvedValue({
      text: "Grounded answer",
      uiCard: null,
      meta: { evidenceAvailable: true, sources: [{ title: "Source", uri: googleRedirect }] },
    });

    const pending = executeTool(
      "search_knowledge",
      { query: "synthetic" },
      { userId: "507f191e810c19729de860ea" },
    );
    await vi.advanceTimersByTimeAsync(25);

    await expect(pending).resolves.toMatchObject({ meta: { timeCost: 25 } });
  });

  it("preserves only bounded exercise-result evidence metadata", async () => {
    executeExerciseSearchMock.mockResolvedValue({
      text: "Không tìm thấy bài tập phù hợp.",
      uiCard: null,
      meta: {
        evidenceAvailable: false,
        requestedCount: 7,
        resultCount: 999,
        catalogInsufficient: true,
        rawQuery: "must not cross the boundary",
      },
    });

    const result = await executeTool(
      "search_exercises",
      { searchQuery: "synthetic" },
      {},
    );

    expect(result.meta).toMatchObject({
      toolName: "search_exercises",
      evidenceAvailable: false,
      requestedCount: 7,
      resultCount: 10,
      catalogInsufficient: true,
    });
    expect(result.meta).not.toHaveProperty("rawQuery");
  });
});
