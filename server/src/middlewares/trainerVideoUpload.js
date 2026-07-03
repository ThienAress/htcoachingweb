import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedExtensions = new Set([".mp4", ".mov", ".webm", ".avi"]);

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "htcoaching/trainers/videos",
    resource_type: "video",
    allowed_formats: ["mp4", "mov", "webm", "avi"],
    public_id: (req, file) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeBaseName = path
        .basename(file.originalname || "video", ext)
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .slice(0, 80);
      return `${Date.now()}-${safeBaseName}`;
    },
  },
});

const videoFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!file.mimetype?.startsWith("video/") || !allowedExtensions.has(ext)) {
    return cb(new Error("Chỉ chấp nhận video mp4, mov, webm hoặc avi"));
  }

  cb(null, true);
};

export const uploadTrainerVideo = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});
