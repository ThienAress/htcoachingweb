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
        return `${Date.now()}-${safeBaseName}`;
      },
    },
  });
};

// Khởi tạo các middleware riêng biệt với mức nén khác nhau theo yêu cầu
export const uploadHeroImage = multer({ 
  storage: createSiteSettingStorage("hero", 1920) 
});

export const uploadAboutImage = multer({ 
  storage: createSiteSettingStorage("about", 1200) 
});

export const uploadTrainerImage = multer({ 
  storage: createSiteSettingStorage("trainer", 800) 
});

export const uploadClassesImage = multer({ 
  storage: createSiteSettingStorage("classes", 800) 
});

export const uploadToolsImage = multer({ 
  storage: createSiteSettingStorage("tools", 1920) 
});
