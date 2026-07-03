import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "htcoaching/blog",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
    public_id: (req, file) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeBaseName = path
        .basename(file.originalname || "blog-image", ext)
        .replace(/[^a-zA-Z0-9-_]/g, "_")
        .slice(0, 80);
      return `${Date.now()}-${safeBaseName}`;
    },
  },
});

const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!file.mimetype?.startsWith("image/") || !allowedExtensions.has(ext)) {
    return cb(new Error("Chỉ chấp nhận ảnh jpg, jpeg, png hoặc webp"));
  }

  cb(null, true);
};

export const uploadBlogImageMiddleware = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});
