import { describe, expect, it } from "vitest";

import {
  buildKnowledgeEntryIntegritySet,
  HISTORICAL_EMBEDDING_DIMENSION,
  HISTORICAL_EMBEDDING_VERSION,
  KNOWLEDGE_INTEGRITY_PROJECTION,
} from "../phase2AiKbIntegrity.helpers.js";

const readyVector = () => Array(HISTORICAL_EMBEDDING_DIMENSION).fill(0.25);

const readyEntry = (overrides = {}) => ({
  question: "Cách thực hiện squat?",
  variants: [{ text: "Squat sao cho đúng?", embedding: readyVector() }],
  tags: ["squat"],
  embedding: readyVector(),
  status: "published",
  ...overrides,
});

describe("phase 2 historical Knowledge Base migration helper", () => {
  it("pins the historical contract to 768 dimensions and projects the stored version", () => {
    expect({
      dimension: HISTORICAL_EMBEDDING_DIMENSION,
      version: HISTORICAL_EMBEDDING_VERSION,
      projection: KNOWLEDGE_INTEGRITY_PROJECTION,
    }).toEqual({
      dimension: 768,
      version: "gemini-embedding-2:768",
      projection: expect.objectContaining({
        embeddingVersion: 1,
        embeddingUpdatedAt: 1,
      }),
    });
  });

  it("backfills the legacy version only when a valid historical vector has no version", () => {
    const readyMissingVersion = buildKnowledgeEntryIntegritySet(readyEntry());
    const invalidMissingVersion = buildKnowledgeEntryIntegritySet(
      readyEntry({ embedding: Array(767).fill(0.25) }),
    );

    expect({ readyMissingVersion, invalidMissingVersion }).toMatchObject({
      readyMissingVersion: {
        embeddingStatus: "ready",
        embeddingVersion: "gemini-embedding-2:768",
      },
      invalidMissingVersion: {
        embeddingStatus: "failed",
        embeddingVersion: null,
        status: "draft",
      },
    });
  });

  it("preserves a question-answering version across repeated migration runs", () => {
    const embeddingVersion = "gemini-embedding-2:768:question-answering-v1";
    const original = readyEntry({ embeddingVersion });
    const firstRun = buildKnowledgeEntryIntegritySet(
      original,
      { now: new Date("2026-09-12T00:00:00.000Z") },
    );
    const persistedAfterFirstRun = { ...original, ...firstRun };
    const secondRun = buildKnowledgeEntryIntegritySet(
      persistedAfterFirstRun,
      { now: new Date("2026-09-13T00:00:00.000Z") },
    );

    expect({
      firstRunWritesVersion: Object.hasOwn(firstRun, "embeddingVersion"),
      firstRunTimestamp: firstRun.embeddingUpdatedAt,
      persistedVersion: persistedAfterFirstRun.embeddingVersion,
      secondRunWritesVersion: Object.hasOwn(secondRun, "embeddingVersion"),
      secondRunTimestamp: secondRun.embeddingUpdatedAt,
    }).toEqual({
      firstRunWritesVersion: false,
      firstRunTimestamp: new Date("2026-09-12T00:00:00.000Z"),
      persistedVersion: embeddingVersion,
      secondRunWritesVersion: false,
      secondRunTimestamp: new Date("2026-09-12T00:00:00.000Z"),
    });
  });

  it.each([null, undefined, "", "   "])(
    "backfills a missing or blank embedding timestamp (%j)",
    (embeddingUpdatedAt) => {
      const now = new Date("2026-09-13T00:00:00.000Z");

      expect(
        buildKnowledgeEntryIntegritySet(
          readyEntry({ embeddingUpdatedAt }),
          { now },
        ).embeddingUpdatedAt,
      ).toEqual(now);
    },
  );
});
