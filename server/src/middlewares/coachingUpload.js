import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "htcoaching/coaching-videos",
    resource_type: "video",
    allowed_formats: ["mp4", "mov", "avi", "webm", "mkv", "m4v", "3gp", "quicktime"],
    public_id: (req, file) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeBaseName = path
        .basename(file.originalname || "video", ext)
        .replace(/[^a-zA-Z0-9-_]/g, "_");
      return `${Date.now()}-${safeBaseName}`;
    },
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
