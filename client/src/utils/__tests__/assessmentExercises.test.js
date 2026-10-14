import { describe, expect, it } from "vitest";
import {
  aggregateExercises,
  canAddExercise,
  createExercise,
  describeTopResult,
  getSuggestionTiers,
  levelToScore,
  parseTieredSuggestion,
  pickProtocol,
  pickSuggestion,
} from "../assessmentExercises";
import { scoreAgainstProtocol, scoreToLevel } from "../assessment.helpers";

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

describe("default protocol scoring", () => {
  const score = (mode, sets, value) => {
    const protocol = pickProtocol(mode, []);
    return scoreAgainstProtocol({
      selectedProtocol: protocol,
      sets,
      reps: mode === "reps" ? value : "",
      durationSec: mode === "time" ? value : "",
    });
  };

  it("rates a full 3 sets x 10 reps as good and lowers the level with less work", () => {
    expect(scoreToLevel(score("reps", 3, 10))).toBe("good");
    expect(scoreToLevel(score("reps", 3, 8))).toBe("good");
    expect(scoreToLevel(score("reps", 2, 8))).toBe("average");
    expect(scoreToLevel(score("reps", 1, 5))).toBe("below_average");
    expect(scoreToLevel(score("reps", 1, 2))).toBe("low");
  });

  it("scores timed work against 20-30 second holds", () => {
    expect(scoreToLevel(score("time", 3, 30))).toBe("good");
    expect(scoreToLevel(score("time", 2, 10))).not.toBe("good");
  });

  it("prefers the suggestion protocol and describes the top result", () => {
    const own = { mode: "reps", setsMin: 3, setsMax: 4, valueMin: 12, valueMax: 15 };

    expect(pickProtocol("reps", [own])).toBe(own);
    expect(pickProtocol("", [own])).toBeNull();
    expect(describeTopResult(pickProtocol("reps", []))).toBe("3 hiệp × 10 lần");
    expect(describeTopResult(pickProtocol("time", []))).toBe("3 hiệp × 30 giây");
  });
});
