import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearCollections,
  setupTestDB,
  teardownTestDB,
} from "../../../../__tests__/setup.js";
import Exercise from "../../../../models/Exercise.js";
import { searchExercises } from "../searchExercises.tool.js";

describe("searchExercises Mongo query contract", () => {
  beforeAll(setupTestDB);
  afterEach(clearCollections);
  afterAll(teardownTestDB);

  it("queries canonical instruction subdocuments without a DocumentArray cast error", async () => {
    await Exercise.create({
      name: "Wall Press Canonical",
      muscleGroup: "Cơ ngực",
      instructions: [{
        title: "Bodyweight setup",
        description: "Không cần dụng cụ, phù hợp người mới.",
      }],
    });

    const result = await searchExercises({
      searchQuery: "bài tập ngực không cần dụng cụ cho người mới",
      limit: 1,
    });

    expect(result.uiCard?.data.exercises).toEqual([
      expect.objectContaining({ name: "Wall Press Canonical" }),
    ]);
  });
});
