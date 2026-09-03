import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  destroyCloudinaryAsset: vi.fn(),
  findById: vi.fn(),
  scheduleNetlifyBuild: vi.fn(),
  uploadBufferToCloudinary: vi.fn(),
}));

const PINNED_EXERCISE_ID = "6a4b43515b0a4f47f1108990";

vi.mock("../../models/Exercise.js", () => ({
  default: { findById: mocks.findById },
  deriveTechnicalDifficultyRating: vi.fn(() => null),
}));

vi.mock("../../utils/cloudinaryUpload.js", () => ({
  destroyCloudinaryAsset: mocks.destroyCloudinaryAsset,
  uploadBufferToCloudinary: mocks.uploadBufferToCloudinary,
}));

vi.mock("../../utils/triggerBuild.js", () => ({
  scheduleNetlifyBuild: mocks.scheduleNetlifyBuild,
}));

import {
  deleteExerciseVideo,
  uploadExerciseVideo,
} from "../exerciseVideo.controller.js";

const makeExercise = (overrides = {}) => {
  const exercise = {
    _id: "exercise-1",
    name: "Squat",
    videoUrl: "",
    videoPublicId: "",
    technicalDifficulty: undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  exercise.toObject = vi.fn(() => ({ ...exercise }));
  return exercise;
};

const findExercise = (exercise) => {
  mocks.findById.mockReturnValue({
    select: vi.fn().mockResolvedValue(exercise),
  });
};

const makeResponse = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.destroyCloudinaryAsset.mockResolvedValue(undefined);
});

describe("exercise video Netlify build policy", () => {
  it("schedules a build after uploading and saving a video", async () => {
    findExercise(makeExercise({ _id: PINNED_EXERCISE_ID }));
    mocks.uploadBufferToCloudinary.mockResolvedValue({
      public_id: "new-public-id",
      url: "https://cdn.example.com/squat.mp4",
    });

    await uploadExerciseVideo(
      {
        params: { id: PINNED_EXERCISE_ID },
        file: { buffer: Buffer.from("video"), originalname: "squat.mp4" },
      },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith(
      "exercise_video_uploaded",
    );
  });

  it("does not expose internal staging fixture markers after video upload", async () => {
    const exercise = makeExercise({ _id: PINNED_EXERCISE_ID });
    exercise.toObject.mockReturnValue({
      _id: exercise._id,
      name: exercise.name,
      videoUrl: "https://cdn.example.com/squat.mp4",
      videoPublicId: "private-video-id",
      _testCatalogFixture: { managed: true },
      _stagingSearchIndexCohortFixture: { managed: true },
      _stagingSearchIndexCohortDisplaced: { managed: true },
    });
    findExercise(exercise);
    mocks.uploadBufferToCloudinary.mockResolvedValue({
      public_id: "new-public-id",
      url: "https://cdn.example.com/squat.mp4",
    });
    const res = makeResponse();

    await uploadExerciseVideo(
      {
        params: { id: PINNED_EXERCISE_ID },
        file: { buffer: Buffer.from("video"), originalname: "squat.mp4" },
      },
      res,
    );

    expect(res.json.mock.calls[0][0].data).toEqual({
      _id: exercise._id,
      name: exercise.name,
      videoUrl: "https://cdn.example.com/squat.mp4",
      technicalDifficultyRating: null,
    });
  });

  it("does not schedule a build when video upload validation fails", async () => {
    await uploadExerciseVideo(
      { params: { id: "exercise-1" } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("does not schedule a build when saving an uploaded video fails", async () => {
    findExercise(
      makeExercise({ save: vi.fn().mockRejectedValue(new Error("save failed")) }),
    );
    mocks.uploadBufferToCloudinary.mockResolvedValue({
      public_id: "new-public-id",
      url: "https://cdn.example.com/squat.mp4",
    });

    await uploadExerciseVideo(
      {
        params: { id: "exercise-1" },
        file: { buffer: Buffer.from("video"), originalname: "squat.mp4" },
      },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("schedules a build after deleting a saved video", async () => {
    findExercise(
      makeExercise({
        _id: PINNED_EXERCISE_ID,
        videoUrl: "https://cdn.example.com/squat.mp4",
        videoPublicId: "old-public-id",
      }),
    );

    await deleteExerciseVideo(
      { params: { id: PINNED_EXERCISE_ID } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith(
      "exercise_video_deleted",
    );
  });

  it("does not schedule a build when delete has no video to remove", async () => {
    const exercise = makeExercise();
    findExercise(exercise);

    await deleteExerciseVideo(
      { params: { id: "exercise-1" } },
      makeResponse(),
    );

    expect({
      saved: exercise.save.mock.calls.length,
      scheduled: mocks.scheduleNetlifyBuild.mock.calls.length,
    }).toEqual({ saved: 0, scheduled: 0 });
  });

  it("does not schedule a build when saving video deletion fails", async () => {
    findExercise(
      makeExercise({
        videoUrl: "https://cdn.example.com/squat.mp4",
        videoPublicId: "old-public-id",
        save: vi.fn().mockRejectedValue(new Error("save failed")),
      }),
    );

    await deleteExerciseVideo(
      { params: { id: "exercise-1" } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });
});
