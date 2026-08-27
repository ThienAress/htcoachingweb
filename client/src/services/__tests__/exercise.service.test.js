import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../../utils/api";
import {
  deleteExerciseReview,
  getExerciseById,
  getExerciseReviews,
  getExercises,
  saveExerciseReview,
  commitExerciseInstructionsImport,
  previewExerciseInstructionsImport,
  uploadExerciseVideo,
} from "../exercise.service";

describe("exercise service", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue({ data: { success: true, data: [] } });
    api.put.mockReset();
    api.put.mockResolvedValue({ data: { success: true } });
    api.post.mockReset();
    api.post.mockResolvedValue({ data: { success: true } });
    api.delete.mockReset();
    api.delete.mockResolvedValue({ data: { success: true } });
  });

  it("adds the technical difficulty filter without changing the existing query", async () => {
    await getExercises(2, 20, "squat", "Chân", "5");

    expect(api.get).toHaveBeenCalledWith(
      "/exercises?page=2&limit=20&search=squat&muscleGroup=Ch%C3%A2n&technicalDifficultyRating=5",
    );
  });

  it("uses separate detail and community review endpoints", async () => {
    await getExerciseById("exercise-1");
    await getExerciseReviews("exercise-1");
    await saveExerciseReview("exercise-1", { rating: 5, comment: "Rõ" });
    await deleteExerciseReview("exercise-1");

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/exercises/exercise-1",
      { signal: undefined },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/exercises/exercise-1/reviews",
      { signal: undefined },
    );
    expect(api.put).toHaveBeenCalledWith("/exercises/exercise-1/reviews", {
      rating: 5,
      comment: "Rõ",
    });
    expect(api.delete).toHaveBeenCalledWith(
      "/exercises/exercise-1/reviews",
    );
  });

  it("uploads admin video as multipart form data", async () => {
    const file = new File(["video"], "squat.mp4", { type: "video/mp4" });

    await uploadExerciseVideo("exercise-1", file);

    expect(api.post).toHaveBeenCalledWith(
      "/exercises/exercise-1/video",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(api.post.mock.calls[0][1].get("video")).toBe(file);
  });

  it("uploads the same JSON contract for preview and commit", async () => {
    const file = new File(["{}"], "exercise-instructions.json", {
      type: "application/json",
    });

    await previewExerciseInstructionsImport(file);
    await commitExerciseInstructionsImport(file, "preview-token");

    expect(api.post).toHaveBeenNthCalledWith(
      1,
      "/exercises/instructions/import",
      expect.any(FormData),
    );
    expect(api.post.mock.calls[0][1].get("file")).toBe(file);
    expect(api.post.mock.calls[0][1].get("dryRun")).toBe("true");
    expect(api.post.mock.calls[1][1].get("file")).toBe(file);
    expect(api.post.mock.calls[1][1].get("dryRun")).toBe("false");
    expect(api.post.mock.calls[1][1].get("previewToken")).toBe(
      "preview-token",
    );
  });
});
