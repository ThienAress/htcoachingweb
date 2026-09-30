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
          { title: "Synthetic source", uri: "https://example.org/evidence#section" },
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
