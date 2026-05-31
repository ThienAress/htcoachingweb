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
    folder: "htcoaching/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 500, height: 500, crop: "fill", gravity: "face" }, { quality: "auto", fetch_format: "auto" }],
    public_id: (req, file) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeBaseName = path
        .basename(file.originalname || "avatar", ext)
        .replace(/[^a-zA-Z0-9-_]/g, "_");
      return `${Date.now()}-${safeBaseName}`;
    },
  },
});

const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  
  if (file.mimetype?.startsWith("image/") || allowedExtensions.includes(ext)) {
    return cb(null, true);
  }
  
  cb(new Error("Chỉ chấp nhận file hình ảnh (jpg, jpeg, png, gif, webp)"));
};

export const uploadAvatar = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});
