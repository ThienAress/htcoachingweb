import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockImportError extends Error {
    constructor(message, status = 400, details = null) {
      super(message);
      this.status = status;
      this.details = details;
    }
  }

  return {
    commit: vi.fn(),
    createPreviewToken: vi.fn(),
    ImportError: MockImportError,
    parse: vi.fn(),
    preview: vi.fn(),
    scheduleNetlifyBuild: vi.fn(),
    verifyPreviewToken: vi.fn(),
  };
});

vi.mock("../../services/exerciseInstructionsImport.service.js", () => ({
  commitExerciseInstructionsImport: mocks.commit,
  createExerciseInstructionsPreviewToken: mocks.createPreviewToken,
  ExerciseInstructionsImportError: mocks.ImportError,
  parseExerciseInstructionsImportDocument: mocks.parse,
  previewExerciseInstructionsImport: mocks.preview,
  verifyExerciseInstructionsPreviewToken: mocks.verifyPreviewToken,
}));

vi.mock("../../utils/triggerBuild.js", () => ({
  scheduleNetlifyBuild: mocks.scheduleNetlifyBuild,
}));

import { importExerciseInstructions } from "../exerciseInstructionsImport.controller.js";

const makeRequest = (dryRun) => ({
  body: { dryRun, previewToken: "preview-token" },
  file: { buffer: Buffer.from("{}") },
  user: { id: "admin-1" },
});

const makeResponse = () => {
  const res = { json: vi.fn(), status: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parse.mockReturnValue({ schemaVersion: 1, exercises: [] });
});

describe("exercise instructions import Netlify build policy", () => {
  it("schedules a build after a committed import modifies exercises", async () => {
    mocks.commit.mockResolvedValue({ updatedItems: 2, modifiedItems: 2 });

    await importExerciseInstructions(makeRequest("false"), makeResponse());

    expect(mocks.scheduleNetlifyBuild).toHaveBeenCalledWith(
      "exercise_instructions_imported",
    );
  });

  it("does not schedule a build for a dry-run preview", async () => {
    mocks.preview.mockResolvedValue({
      summary: { canImport: true },
      previewItems: [],
    });
    mocks.createPreviewToken.mockReturnValue("new-preview-token");

    await importExerciseInstructions(makeRequest("true"), makeResponse());

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("does not schedule a build when commit matches but modifies no exercises", async () => {
    mocks.commit.mockResolvedValue({ updatedItems: 2, modifiedItems: 0 });

    await importExerciseInstructions(makeRequest("false"), makeResponse());

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("does not schedule a build when committed import fails", async () => {
    mocks.commit.mockRejectedValue(new Error("commit failed"));

    await importExerciseInstructions(makeRequest("false"), makeResponse());

    expect(mocks.scheduleNetlifyBuild).not.toHaveBeenCalled();
  });

  it("preserves a pinned eligibility conflict without scheduling a build", async () => {
    mocks.commit.mockRejectedValue(
      new mocks.ImportError("Pinned Exercise không còn đạt chuẩn", 409, {
        code: "PINNED_EXERCISE_INELIGIBLE",
      }),
    );
    const res = makeResponse();

    await importExerciseInstructions(makeRequest("false"), res);

    expect({
      scheduled: mocks.scheduleNetlifyBuild.mock.calls.length,
      status: res.status.mock.calls[0]?.[0],
      code: res.json.mock.calls[0]?.[0]?.details?.code,
    }).toEqual({
      scheduled: 0,
      status: 409,
      code: "PINNED_EXERCISE_INELIGIBLE",
    });
  });
});
