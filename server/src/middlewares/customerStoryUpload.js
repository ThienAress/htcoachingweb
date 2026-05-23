import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = path.resolve("uploads/customer-stories");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = allowedExtensions.has(ext) ? ext : ".jpg";
    const safeBaseName = path
      .basename(file.originalname || "customer-story", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 80);

    cb(null, `${Date.now()}-${safeBaseName}${safeExt}`);
  },
});

const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!file.mimetype?.startsWith("image/") || !allowedExtensions.has(ext)) {
    return cb(new Error("Chỉ chấp nhận ảnh jpg, jpeg, png hoặc webp"));
  }

  cb(null, true);
};

export const uploadCustomerStoryImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});
