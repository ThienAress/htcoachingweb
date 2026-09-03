import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteReviews: vi.fn(),
  destroyCloudinaryAsset: vi.fn(),
  findById: vi.fn(),
  findByIdAndDelete: vi.fn(),
  findOne: vi.fn(),
  scheduleNetlifyBuild: vi.fn(),
}));

vi.mock("../../models/Exercise.js", () => ({
  default: {
    create: mocks.create,
    findById: mocks.findById,
    findByIdAndDelete: mocks.findByIdAndDelete,
    findOne: mocks.findOne,
  },
  deriveTechnicalDifficultyRating: vi.fn(() => null),
  TECHNICAL_DIFFICULTY_CRITERIA: [
    "coordination",
    "stability",
    "mobility",
    "setup",
    "errorConsequence",
  ],
}));

vi.mock("../../models/ExerciseReview.js", () => ({
  default: { deleteMany: mocks.deleteReviews },
}));

vi.mock("../../utils/cloudinaryUpload.js", () => ({
  destroyCloudinaryAsset: mocks.destroyCloudinaryAsset,
}));

vi.mock("../../utils/triggerBuild.js", () => ({
  scheduleNetlifyBuild: mocks.scheduleNetlifyBuild,
}));

import {
  createExercise,
  createManyExercises,
  deleteExercise,
  updateExercise,
} from "../exercise.controller.js";

const makeExercise = (overrides = {}) => {
  const exercise = {
    _id: "exercise-1",
    name: "Squat",
    muscleGroup: "Legs",
    description: "Mô tả",
    imageUrl: "",
    instructions: [],
    technicalDifficulty: undefined,
    videoPublicId: "",
    isModified: vi.fn(() => true),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  exercise.toObject = vi.fn(() => ({ ...exercise }));
  return exercise;
};

const makeResponse = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteReviews.mockResolvedValue({ deletedCount: 0 });
  mocks.destroyCloudinaryAsset.mockResolvedValue(undefined);
});

describe("exercise catalog Netlify build policy", () => {
  it("schedules a build after creating an exercise", async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.create.mockResolvedValue(makeExercise());

    await createExercise(
      { body: { name: "Squat", muscleGroup: "Legs" } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("exercise_created");
  });

  it("does not expose internal staging fixture markers", async () => {
    mocks.findOne.mockResolvedValue(null);
    const exercise = makeExercise();
    exercise.toObject.mockReturnValue({
      _id: exercise._id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      videoPublicId: "private-video-id",
      _testCatalogFixture: { managed: true },
      _stagingSearchIndexCohortFixture: { managed: true },
      _stagingSearchIndexCohortDisplaced: { managed: true },
    });
    mocks.create.mockResolvedValue(exercise);
    const res = makeResponse();

    await createExercise(
      { body: { name: "Squat", muscleGroup: "Legs" } },
      res,
    );

    expect(res.json.mock.calls[0][0].data).toEqual({
      _id: exercise._id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      technicalDifficultyRating: null,
    });
  });

  it("does not schedule a build when create validation fails", async () => {
    await createExercise({ body: { name: "Squat" } }, makeResponse());

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("schedules one build after a bulk create mutates the catalog", async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.create.mockResolvedValue(makeExercise());

    await createManyExercises(
      { body: { exercises: [{ name: "Squat", muscleGroup: "Legs" }] } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild.mock.calls).toEqual([
      ["exercise_bulk_created"],
    ]);
  });

  it("does not schedule a build when bulk create changes nothing", async () => {
    mocks.findOne.mockResolvedValue(makeExercise());

    await createManyExercises(
      { body: { exercises: [{ name: "Squat", muscleGroup: "Legs" }] } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("schedules a build after updating an exercise", async () => {
    const exercise = makeExercise();
    mocks.findById.mockResolvedValue(exercise);

    await updateExercise(
      { params: { id: exercise._id }, body: { description: "Mô tả mới" } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("exercise_updated");
  });

  it("does not schedule a build for an unchanged update", async () => {
    const exercise = makeExercise({ isModified: vi.fn(() => false) });
    mocks.findById.mockResolvedValue(exercise);

    await updateExercise(
      { params: { id: exercise._id }, body: { description: exercise.description } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("does not schedule a build when update finds no exercise", async () => {
    mocks.findById.mockResolvedValue(null);

    await updateExercise(
      { params: { id: "missing" }, body: { description: "Mô tả mới" } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("does not schedule a build when update validation fails", async () => {
    const exercise = makeExercise({
      save: vi.fn().mockRejectedValue(new Error("validation failed")),
    });
    mocks.findById.mockResolvedValue(exercise);

    await updateExercise(
      { params: { id: exercise._id }, body: { name: "Tên không hợp lệ" } },
      makeResponse(),
    );

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("schedules a build after deleting an exercise", async () => {
    const exercise = makeExercise();
    mocks.findByIdAndDelete.mockReturnValue({
      select: vi.fn().mockResolvedValue(exercise),
    });

    await deleteExercise({ params: { id: exercise._id } }, makeResponse());

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith("exercise_deleted");
  });

  it("does not schedule a build when delete finds no exercise", async () => {
    mocks.findByIdAndDelete.mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    await deleteExercise({ params: { id: "missing" } }, makeResponse());

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

});
