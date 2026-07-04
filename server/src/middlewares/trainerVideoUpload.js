import path from "path";
import multer from "multer";

const allowedExtensions = new Set([".mp4", ".mov", ".webm", ".avi"]);

const videoFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!file.mimetype?.startsWith("video/") || !allowedExtensions.has(ext)) {
    return cb(new Error("Chỉ chấp nhận video mp4, mov, webm hoặc avi"));
  }

  cb(null, true);
};

export const uploadTrainerVideo = multer({
  storage: multer.memoryStorage(),
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});
