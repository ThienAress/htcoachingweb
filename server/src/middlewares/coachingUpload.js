import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = path.resolve("uploads/coaching-videos");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeBaseName = path
      .basename(file.originalname || "video", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    cb(null, `${Date.now()}-${safeBaseName}${ext || ".mp4"}`);
  },
});

const videoFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedExtensions = [".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v", ".3gp", ".quicktime"];
  
  if (file.mimetype?.startsWith("video/") || allowedExtensions.includes(ext)) {
    return cb(null, true);
  }
  
  cb(new Error("Chỉ chấp nhận file video (mp4, mov, avi, webm, quicktime,...)"));
};

export const uploadCoachingVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB tối đa để hỗ trợ video 15-20s chất lượng cao từ điện thoại
  },
});
