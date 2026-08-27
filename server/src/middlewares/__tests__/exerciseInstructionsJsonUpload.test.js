import { describe, expect, it, vi } from "vitest";

import {
  EXERCISE_INSTRUCTIONS_JSON_MAX_SIZE,
  exerciseInstructionsJsonFileFilter,
} from "../exerciseInstructionsJsonUpload.js";

describe("exercise instructions JSON upload boundary", () => {
  it("accepts a JSON file with the expected MIME and extension", () => {
    const callback = vi.fn();

    exerciseInstructionsJsonFileFilter(
      {},
      {
        originalname: "exercise-instructions.json",
        mimetype: "application/json",
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, true);
    expect(EXERCISE_INSTRUCTIONS_JSON_MAX_SIZE).toBe(8 * 1024 * 1024);
  });

  it("rejects a disguised non-JSON file", () => {
    const callback = vi.fn();

    exerciseInstructionsJsonFileFilter(
      {},
      {
        originalname: "exercise-instructions.txt",
        mimetype: "application/json",
      },
      callback,
    );

    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0][1]).toBeUndefined();
  });
});
