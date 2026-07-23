import path from "path";
import multer from "multer";

const allowedVideoExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v", ".3gp", ".quicktime"];
export const MAX_COACHING_VIDEO_SIZE = 25 * 1024 * 1024;

export const videoFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const hasVideoMime = file.mimetype?.startsWith("video/");
  const hasVideoExtension = allowedVideoExtensions.includes(ext);

  if (hasVideoMime && hasVideoExtension) {
    return cb(null, true);
  }

  cb(new Error("Chỉ chấp nhận file video (mp4, mov, avi, webm, quicktime,...)"));
};

export const uploadCoachingVideo = multer({
  storage: multer.memoryStorage(),
  fileFilter: videoFileFilter,
  limits: {
    fileSize: MAX_COACHING_VIDEO_SIZE,
  },
});
