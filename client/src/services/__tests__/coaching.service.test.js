import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/api", () => ({
  default: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../../utils/api";
import {
  removeClientFeedbackVideo,
  uploadClientFeedbackVideo,
} from "../coaching.service";

describe("coaching private feedback service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { success: true } });
    api.delete.mockResolvedValue({ data: { success: true } });
  });

  it("puts ownership identifiers in the upload path instead of multipart fields", async () => {
    const formData = new FormData();
    formData.append("video", new File(["video"], "feedback.mp4"));

    await uploadClientFeedbackVideo(
      "2026-08-28",
      "exercise-1",
      formData,
    );

    expect(api.post).toHaveBeenCalledWith(
      "/coaching/my-plans/2026-08-28/exercises/exercise-1/feedback-video",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(formData.has("dateString")).toBe(false);
    expect(formData.has("exerciseId")).toBe(false);
  });

  it("uses the explicit ownership-checked remove action", async () => {
    await removeClientFeedbackVideo("2026-08-28", "exercise-1");

    expect(api.delete).toHaveBeenCalledWith(
      "/coaching/my-plans/2026-08-28/exercises/exercise-1/feedback-video",
    );
  });
});
