export const EXERCISE_INSTRUCTIONS_JSON_MAX_SIZE = 8 * 1024 * 1024;

export const readExerciseInstructionsImportFile = async (file) => {
  if (!file) {
    throw new Error("Vui lòng chọn file JSON cần nhập");
  }
  if (!file.name?.toLowerCase().endsWith(".json")) {
    throw new Error("Chỉ chấp nhận file có đuôi .json");
  }
  if (file.size > EXERCISE_INSTRUCTIONS_JSON_MAX_SIZE) {
    throw new Error("File JSON hướng dẫn tối đa 8MB");
  }

  let document;
  try {
    document = JSON.parse(await file.text());
  } catch {
    throw new Error("File không phải JSON hợp lệ");
  }

  if (document?.schemaVersion !== 1) {
    throw new Error("schemaVersion phải bằng 1");
  }
  if (!Array.isArray(document.exercises) || document.exercises.length === 0) {
    throw new Error("File phải có ít nhất một bài tập trong exercises");
  }

  return document;
};
