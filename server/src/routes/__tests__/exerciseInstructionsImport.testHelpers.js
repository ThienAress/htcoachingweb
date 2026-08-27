export const exerciseTechnicalDifficultyRubric = {
  coordination: 1,
  stability: 1,
  mobility: 1,
  setup: 1,
  errorConsequence: 1,
  rationale: "Yêu cầu kiểm soát ở mức vừa.",
};

export const buildExerciseInstructionsImportDocument = (exercises) => ({
  schemaVersion: 1,
  exercises,
});

export const buildExerciseInstructionsImportItem = (name, overrides = {}) => ({
  name,
  instructions: [
    { title: "Vào vị trí", description: "Giữ thân người ổn định." },
    { title: "Thực hiện", description: "Di chuyển có kiểm soát." },
  ],
  technicalDifficulty: exerciseTechnicalDifficultyRubric,
  ...overrides,
});

export const attachExerciseInstructionsJson = (
  testRequest,
  document,
  dryRun,
  previewToken,
) => {
  const requestWithFields = testRequest.field("dryRun", String(dryRun));
  if (previewToken) requestWithFields.field("previewToken", previewToken);
  return requestWithFields.attach(
    "file",
    Buffer.from(JSON.stringify(document), "utf8"),
    {
      filename: "exercise-instructions.json",
      contentType: "application/json",
    },
  );
};
