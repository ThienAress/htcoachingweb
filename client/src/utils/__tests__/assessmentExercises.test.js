import { describe, expect, it } from "vitest";
import {
  aggregateExercises,
  canAddExercise,
  createExercise,
  getSuggestionTiers,
  levelToScore,
  parseTieredSuggestion,
  pickSuggestion,
} from "../assessmentExercises";
import { scoreToLevel } from "../assessment.helpers";

describe("parseTieredSuggestion", () => {
  it("reads the three tiers from the server title format", () => {
    const title =
      "Mức dễ:\n- Hít đất tường (Wall Push-Up)\n- Đẩy ngực máy nhẹ\n\nMức tiêu chuẩn:\n- Hít đất nghiêng\n\nMức nâng cao:\n- Hít đất chuẩn";

    expect(parseTieredSuggestion(title)).toEqual({
      easy: ["Hít đất tường (Wall Push-Up)", "Đẩy ngực máy nhẹ"],
      standard: ["Hít đất nghiêng"],
      advanced: ["Hít đất chuẩn"],
    });
  });

  it("returns empty tiers for text without tier headers", () => {
    expect(parseTieredSuggestion("Treadmill Walk")).toEqual({
      easy: [],
      standard: [],
      advanced: [],
    });
  });

  it("prefers structured tiers over the title", () => {
    const suggestion = {
      title: "Mức dễ:\n- Cũ",
      tiers: { easy: ["Mới"], standard: [], advanced: [] },
    };

    expect(getSuggestionTiers(suggestion).easy).toEqual(["Mới"]);
    expect(getSuggestionTiers({ title: "Mức dễ:\n- Cũ" }).easy).toEqual(["Cũ"]);
  });
});

describe("pickSuggestion", () => {
  it("matches by key even when the array order differs", () => {
    const list = [{ key: "upperBodyPush" }, { key: "upperBodyPull" }, { key: "lowerBody" }];

    expect(pickSuggestion(list, "lowerBody", 1).key).toBe("lowerBody");
  });

  it("falls back to the index only for legacy suggestions without keys", () => {
    expect(pickSuggestion([{ a: 1 }, { a: 2 }], "lowerBody", 1)).toEqual({ a: 2 });
    expect(pickSuggestion([{ key: "x" }], "lowerBody", 0)).toBeNull();
  });
});

describe("exercise list rules", () => {
  it("limits to three distinct, non-empty names", () => {
    const three = ["A", "B", "C"].map((name) => createExercise({ name }));

    expect(canAddExercise([], "  ")).toBe(false);
    expect(canAddExercise(three.slice(0, 2), "c")).toBe(true);
    expect(canAddExercise(three.slice(0, 2), "a")).toBe(false);
    expect(canAddExercise(three, "D")).toBe(false);
  });

  it("truncates custom names to 80 characters", () => {
    expect(createExercise({ name: "x".repeat(100), source: "custom" }).name).toHaveLength(80);
  });
});

describe("aggregateExercises", () => {
  it("averages scored exercises and ignores unscored ones", () => {
    const result = aggregateExercises([
      { score: "8" },
      { score: "5" },
      { score: "" },
    ]);

    expect(result).toEqual({ score: "6.5", level: "average" });
  });

  it("returns empty values when nothing has a score", () => {
    expect(aggregateExercises([{ score: "" }])).toEqual({ score: "", level: "" });
  });

  it("maps a coach-chosen level back to the same level", () => {
    for (const level of ["low", "below_average", "average", "good"]) {
      expect(scoreToLevel(levelToScore(level))).toBe(level);
    }
  });
});
