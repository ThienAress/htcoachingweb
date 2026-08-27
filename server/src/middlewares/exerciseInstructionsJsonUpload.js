import path from "path";
import multer from "multer";

const ALLOWED_JSON_MIME_TYPES = new Set([
  "application/json",
  "text/json",
  "application/octet-stream",
]);

export const EXERCISE_INSTRUCTIONS_JSON_MAX_SIZE = 8 * 1024 * 1024;

export const exerciseInstructionsJsonFileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const hasAllowedMimeType = ALLOWED_JSON_MIME_TYPES.has(file.mimetype);

  if (extension !== ".json" || !hasAllowedMimeType) {
    return callback(new Error("Chỉ chấp nhận file JSON (.json)"));
  }

  return callback(null, true);
};

const exerciseInstructionsJsonUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: exerciseInstructionsJsonFileFilter,
  limits: {
    fileSize: EXERCISE_INSTRUCTIONS_JSON_MAX_SIZE,
    files: 1,
    fields: 2,
  },
});

export const uploadExerciseInstructionsJson = (req, res, next) => {
  exerciseInstructionsJsonUpload.single("file")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "File JSON hướng dẫn tối đa 8MB"
        : error.message;
    return res.status(400).json({ success: false, message });
  });
};
