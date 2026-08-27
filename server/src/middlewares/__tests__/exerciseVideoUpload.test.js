import { describe, expect, it, vi } from "vitest";

import {
  EXERCISE_VIDEO_MAX_SIZE,
  exerciseVideoFileFilter,
} from "../exerciseVideoUpload.js";

describe("exercise video upload boundary", () => {
  it("accepts supported video MIME and extension combinations", () => {
    const callback = vi.fn();

    exerciseVideoFileFilter(
      {},
      { originalname: "goblet-squat.mp4", mimetype: "video/mp4" },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
    expect(EXERCISE_VIDEO_MAX_SIZE).toBe(100 * 1024 * 1024);
  });

  it("rejects disguised or unsupported files", () => {
    const callback = vi.fn();

    exerciseVideoFileFilter(
      {},
      { originalname: "goblet-squat.exe", mimetype: "video/mp4" },
      callback,
    );

    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0][1]).toBeUndefined();
  });
});
