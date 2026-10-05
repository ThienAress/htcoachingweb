import { describe, expect, it } from "vitest";

import {
  assertManifest,
  buildImportPlan,
  buildSourceOnlyUpdate,
  sha256,
} from "../applyProductionKbSourceImport.js";

const source = {
  type: "research",
  title: "Primary study",
  publisher: "Example Journal",
  url: "https://example.org/study",
  publishedAt: "2024-01-01T00:00:00.000Z",
  retrievedAt: "2026-09-29T00:00:00.000Z",
  evidenceTier: "primary",
};

const normalizedSource = {
  ...source,
  publishedAt: new Date(source.publishedAt),
  retrievedAt: new Date(source.retrievedAt),
};

const createManifest = (question, answer) => ({
  version: 1,
  updates: [
    {
      entryId: "6a4e0b1755b7e7c8fc6c756c",
      questionHash: sha256(question),
      answerHash: sha256(answer),
      sources: [source],
    },
  ],
});

describe("production Knowledge Base source import", () => {
  it("builds a source-only plan when question, answer, and sources are unchanged", () => {
    const question = "Question";
    const answer = "Answer";
    const plan = buildImportPlan(
      [{
        _id: "6a4e0b1755b7e7c8fc6c756c",
        question,
        answer,
        sources: [],
        revision: 2,
      }],
      createManifest(question, answer),
    );

    expect(plan).toHaveLength(1);
    expect(plan[0].sources).toEqual([normalizedSource]);
    expect(buildSourceOnlyUpdate(plan[0].sources)).toEqual({
      $set: {
        sources: [normalizedSource],
        evidenceLevel: "source_backed",
        reviewStatus: "needs_review",
        reviewedBy: null,
        reviewedAt: null,
        status: "draft",
      },
      $inc: { revision: 1 },
    });
  });

  it("rejects answer drift and never overwrites existing sources", () => {
    const manifest = createManifest("Question", "Answer");
    expect(() =>
      buildImportPlan(
        [{ _id: manifest.updates[0].entryId, question: "Question", answer: "Changed", sources: [] }],
        manifest,
      ),
    ).toThrow("KB_SOURCE_IMPORT_ANSWER_DRIFT");
    expect(() =>
      buildImportPlan(
        [{
          _id: manifest.updates[0].entryId,
          question: "Question",
          answer: "Answer",
          sources: [source],
        }],
        manifest,
      ),
    ).toThrow("KB_SOURCE_IMPORT_EXISTING_SOURCES");
  });

  it("rejects credentials or non-HTTPS source URLs", () => {
    expect(() =>
      assertManifest({
        version: 1,
        updates: [{
          entryId: "6a4e0b1755b7e7c8fc6c756c",
          questionHash: "a".repeat(64),
          answerHash: "b".repeat(64),
          sources: [{ ...source, url: "http://example.org/study" }],
        }],
      }),
    ).toThrow("KB_SOURCE_IMPORT_SOURCE_INVALID");
  });
});
