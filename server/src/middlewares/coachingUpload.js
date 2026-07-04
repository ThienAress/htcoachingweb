import path from "path";
import multer from "multer";

const allowedVideoExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v", ".3gp", ".quicktime"];

const videoFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (file.mimetype?.startsWith("video/") || allowedVideoExtensions.includes(ext)) {
    return cb(null, true);
  }

  cb(new Error("Chỉ chấp nhận file video (mp4, mov, avi, webm, quicktime,...)"));
};

export const uploadCoachingVideo = multer({
  storage: multer.memoryStorage(),
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});
