import path from "path";
import multer from "multer";

const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm"]);
export const EXERCISE_VIDEO_MAX_SIZE = 100 * 1024 * 1024;

export const exerciseVideoFileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const isVideo = file.mimetype?.startsWith("video/");

  if (!isVideo || !ALLOWED_VIDEO_EXTENSIONS.has(extension)) {
    return callback(new Error("Chỉ chấp nhận video mp4, mov hoặc webm"));
  }

  return callback(null, true);
};

const exerciseVideoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: exerciseVideoFileFilter,
  limits: { fileSize: EXERCISE_VIDEO_MAX_SIZE },
});

export const uploadExerciseVideo = (req, res, next) => {
  exerciseVideoUpload.single("video")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Video bài tập tối đa 100MB"
        : error.message;
    return res.status(400).json({ success: false, message });
  });
};
