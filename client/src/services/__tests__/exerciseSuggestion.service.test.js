import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: { post: vi.fn() },
}));

import api from "../../utils/api";
import { sendExerciseSuggestion } from "../exerciseSuggestion.service";

describe("exercise suggestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps free text to the bounded backend contract", async () => {
    api.post.mockResolvedValueOnce({ data: { success: true } });

    await sendExerciseSuggestion("  Incline row  ");

    expect(api.post).toHaveBeenCalledWith("/exercise-suggestions", {
      name: "Incline row",
      description: "Incline row",
    });
  });
});
