import { describe, expect, it } from "vitest";

import {
  getExerciseDetailPath,
  isCanonicalExerciseDetailSlug,
  slugifyExerciseName,
} from "../exerciseDetailPath";

describe("exercise detail path", () => {
  it("builds a stable ID route with a Vietnamese-safe readable slug", () => {
    expect(slugifyExerciseName("Đẩy ngực với tạ đơn")).toBe(
      "day-nguc-voi-ta-don",
    );
    expect(
      getExerciseDetailPath({
        _id: "64b000000000000000000001",
        name: "Đẩy ngực với tạ đơn",
      }),
    ).toBe(
      "/exercises/64b000000000000000000001/day-nguc-voi-ta-don/",
    );
  });

  it("accepts only the canonical slug for an indexable detail URL", () => {
    const exercise = {
      _id: "64b000000000000000000001",
      name: "Đẩy ngực với tạ đơn",
    };

    expect(isCanonicalExerciseDetailSlug(exercise, "day-nguc-voi-ta-don")).toBe(
      true,
    );
    expect(isCanonicalExerciseDetailSlug(exercise, "slug-cu")).toBe(false);
    expect(isCanonicalExerciseDetailSlug(exercise, undefined)).toBe(false);
  });
});
