import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = path.resolve("uploads/avatars");

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
      .basename(file.originalname || "avatar", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    cb(null, `${Date.now()}-${safeBaseName}${ext || ".png"}`);
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
