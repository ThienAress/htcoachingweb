import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { get: vi.fn() },
}));

import api from "../../utils/api";
import { getExercises } from "../exercise.service";

describe("exercise service", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
  });

  it("adds the technical difficulty filter without changing the existing query", async () => {
    await getExercises(2, 20, "squat", "Chân", "5");

    expect(api.get).toHaveBeenCalledWith(
      "/exercises?page=2&limit=20&search=squat&muscleGroup=Ch%C3%A2n&technicalDifficultyRating=5",
    );
  });
});
