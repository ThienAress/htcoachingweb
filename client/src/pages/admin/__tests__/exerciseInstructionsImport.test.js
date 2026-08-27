import { describe, expect, it } from "vitest";

import { readExerciseInstructionsImportFile } from "../exerciseInstructionsImport.js";

const validDocument = {
  schemaVersion: 1,
  exercises: [
    {
      name: "Goblet Squat",
      instructions: [
        { title: "Vào vị trí", description: "Giữ lưng trung lập." },
      ],
      technicalDifficulty: {
        coordination: 1,
        stability: 1,
        mobility: 1,
        setup: 1,
        errorConsequence: 1,
      },
    },
  ],
};

describe("exercise instructions import file guard", () => {
  it("accepts a syntactically valid version-one JSON file", async () => {
    const file = new File(
      [JSON.stringify(validDocument)],
      "exercise-instructions.json",
      { type: "application/json" },
    );

    await expect(readExerciseInstructionsImportFile(file)).resolves.toEqual(
      validDocument,
    );
  });

  it("rejects malformed JSON before calling the API", async () => {
    const file = new File(["{not-json"], "exercise-instructions.json", {
      type: "application/json",
    });

    await expect(readExerciseInstructionsImportFile(file)).rejects.toThrow(
      "File không phải JSON hợp lệ",
    );
  });

  it("rejects a different schema version", async () => {
    const file = new File(
      [JSON.stringify({ ...validDocument, schemaVersion: 2 })],
      "exercise-instructions.json",
      { type: "application/json" },
    );

    await expect(readExerciseInstructionsImportFile(file)).rejects.toThrow(
      "schemaVersion phải bằng 1",
    );
  });
});
