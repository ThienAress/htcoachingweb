import { describe, expect, it } from "vitest";

import {
  COACHING_FEEDBACK_UPLOADS_PER_HOUR,
  MAX_COACHING_VIDEO_SIZE,
  uploadClientFeedbackVideoStream,
  uploadCoachingVideo,
  videoFileFilter,
} from "../coachingUpload.js";

const runFilter = (file) =>
  new Promise((resolve) => {
    videoFileFilter(null, file, (error, accepted) => {
      resolve({ error, accepted });
    });
  });

describe("coaching video upload containment", () => {
  it("keeps the 25 MB limit while using streaming storage", () => {
    expect(MAX_COACHING_VIDEO_SIZE).toBe(25 * 1024 * 1024);
    expect(uploadCoachingVideo.storage.constructor.name).not.toBe(
      "MemoryStorage",
    );
    expect(uploadClientFeedbackVideoStream.storage.constructor.name).not.toBe(
      "MemoryStorage",
    );
    expect(COACHING_FEEDBACK_UPLOADS_PER_HOUR).toBe(60);
  });

  it("accepts a video only when MIME and extension both match", async () => {
    const valid = await runFilter({
      originalname: "feedback.mp4",
      mimetype: "video/mp4",
    });
    const spoofedExtension = await runFilter({
      originalname: "feedback.exe",
      mimetype: "video/mp4",
    });
    const spoofedMime = await runFilter({
      originalname: "feedback.mp4",
      mimetype: "application/octet-stream",
    });

    expect(valid).toEqual({ error: null, accepted: true });
    expect(spoofedExtension.error).toBeInstanceOf(Error);
    expect(spoofedMime.error).toBeInstanceOf(Error);
  });
});
