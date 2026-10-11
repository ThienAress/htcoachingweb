import { describe, expect, it } from "vitest";

import {
  validateMixedWorkoutSupplementOutput,
} from "../mixedWorkoutMealGuard.js";

describe("mixed workout and meal output guard", () => {
  it.each([
    "Bạn nên ăn 2700 mỗi ngày. Giáo án 4 ngày: Dumbbell Floor Press.",
    "Bạn nên ăn mỗi ngày 2700. Giáo án 4 ngày: Dumbbell Floor Press.",
    "Nâng năng lượng hằng ngày lên 2700. Lịch tập 4 ngày: Goblet Squat.",
    "Mức nạp mỗi ngày là 2700. Lịch tập 4 ngày: Goblet Squat.",
    "Thực đơn mới có 180g protein. Lịch tập 4 ngày: One-arm Row.",
  ])("rejects model-authored nutrition content: %s", (answer) => {
    expect(validateMixedWorkoutSupplementOutput(answer)).toMatchObject({
      valid: false,
      reasonCodes: expect.arrayContaining(["meal_content_present"]),
    });
  });

  it("accepts workout numbers without treating 'giáo án' as food intake", () => {
    expect(validateMixedWorkoutSupplementOutput(
      "Giáo án 4 ngày: Dumbbell Floor Press 3 hiệp x 10 reps.",
    )).toEqual({ valid: true, reasonCodes: [] });
  });
});
