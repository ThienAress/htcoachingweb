import { describe, expect, test } from "vitest";

import Exercise, { deriveTechnicalDifficultyRating } from "../Exercise.js";

const rubricForTotal = (total) => {
  const rubric = {
    coordination: 0,
    stability: 0,
    mobility: 0,
    setup: 0,
    errorConsequence: 0,
  };
  let remaining = total;
  for (const criterion of Object.keys(rubric)) {
    rubric[criterion] = Math.min(remaining, 2);
    remaining -= rubric[criterion];
  }
  return rubric;
};

describe("Exercise technical difficulty rating", () => {
  test("maps every score boundary to the approved one-to-five scale", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((total) =>
      deriveTechnicalDifficultyRating(rubricForTotal(total)),
    )).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5]);
  });

  test("returns null when any criterion is missing", () => {
    expect(deriveTechnicalDifficultyRating({ coordination: 1 })).toBeNull();
  });

  test("keeps a legacy document valid without a rubric", async () => {
    const exercise = new Exercise({ name: "Legacy", muscleGroup: "Chân" });

    await expect(exercise.validate()).resolves.toBeUndefined();
  });

  test("rejects an out-of-range rubric value at the model boundary", async () => {
    const exercise = new Exercise({
      name: "Invalid",
      muscleGroup: "Chân",
      technicalDifficulty: {
        coordination: 3,
        stability: 0,
        mobility: 0,
        setup: 0,
        errorConsequence: 0,
      },
    });

    await expect(exercise.validate()).rejects.toMatchObject({
      name: "ValidationError",
    });
  });

  test("keeps ordered setup instructions and allows legacy exercises without them", async () => {
    const legacy = new Exercise({ name: "Legacy Row", muscleGroup: "Lưng" });
    const guided = new Exercise({
      name: "Guided Row",
      muscleGroup: "Lưng",
      instructions: [
        { title: "Chỉnh ghế", description: "Đặt ngực tựa chắc vào đệm." },
        { title: "Nắm tay cầm", description: "Giữ cổ tay thẳng." },
      ],
    });

    await expect(legacy.validate()).resolves.toBeUndefined();
    await expect(guided.validate()).resolves.toBeUndefined();
    expect(guided.instructions.map((step) => step.title)).toEqual([
      "Chỉnh ghế",
      "Nắm tay cầm",
    ]);
  });

  test("rejects more than thirty setup instructions", async () => {
    const exercise = new Exercise({
      name: "Too many steps",
      muscleGroup: "Core",
      instructions: Array.from({ length: 31 }, (_, index) => ({
        title: `Bước ${index + 1}`,
        description: "Thực hiện có kiểm soát.",
      })),
    });

    await expect(exercise.validate()).rejects.toMatchObject({
      name: "ValidationError",
    });
  });
});
