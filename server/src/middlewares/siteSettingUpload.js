import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hàm tạo storage với kích thước tuỳ chỉnh cho từng Section
const createSiteSettingStorage = (folderName, maxWidth) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: `htcoaching/site-settings/${folderName}`,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [
        { width: maxWidth, crop: "limit" },
        { quality: "auto", fetch_format: "auto" }
      ],
      public_id: (req, file) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const safeBaseName = path
          .basename(file.originalname || "image", ext)
          .replace(/[^a-zA-Z0-9-_]/g, "_")
          .slice(0, 50);
        const randomStr = Math.round(Math.random() * 10000);
        return `${Date.now()}-${randomStr}-${safeBaseName}`;
      },
    },
  });
};

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!file.mimetype?.startsWith("image/") || !allowedExtensions.has(ext)) {
    return cb(new Error("Chỉ chấp nhận ảnh jpg, jpeg, png hoặc webp"));
  }

  cb(null, true);
};

const multerOptions = (folderName, maxWidth) => ({
  storage: createSiteSettingStorage(folderName, maxWidth),
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Khởi tạo các middleware riêng biệt với mức nén khác nhau theo yêu cầu
export const uploadHeroImage = multer(multerOptions("hero", 1920));
export const uploadAboutImage = multer(multerOptions("about", 1200));
export const uploadTrainerImage = multer(multerOptions("trainer", 800));
export const uploadClassesImage = multer(multerOptions("classes", 800));
export const uploadToolsImage = multer(multerOptions("tools", 1920));
