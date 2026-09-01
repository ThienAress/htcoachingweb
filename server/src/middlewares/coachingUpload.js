import path from "path";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { createCoachingVideoStorage } from "../services/coachingPrivateMedia.service.js";

const allowedVideoExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v", ".3gp", ".quicktime"];
export const MAX_COACHING_VIDEO_SIZE = 25 * 1024 * 1024;
export const COACHING_FEEDBACK_UPLOADS_PER_HOUR = 60;

export const coachingFeedbackUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: COACHING_FEEDBACK_UPLOADS_PER_HOUR,
  keyGenerator: (req) => req.user.id.toString(),
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      code: "COACHING_FEEDBACK_UPLOAD_RATE_LIMITED",
      message: "Bạn tải video quá nhanh. Vui lòng thử lại sau.",
    }),
  standardHeaders: true,
  legacyHeaders: false,
});

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
  storage: createCoachingVideoStorage({ authenticated: false }),
  fileFilter: videoFileFilter,
  limits: {
    fileSize: MAX_COACHING_VIDEO_SIZE,
  },
});

export const uploadClientFeedbackVideoStream = multer({
  storage: createCoachingVideoStorage({ authenticated: true }),
  fileFilter: videoFileFilter,
  limits: {
    fileSize: MAX_COACHING_VIDEO_SIZE,
  },
});
