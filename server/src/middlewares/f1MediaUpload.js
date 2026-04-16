import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = path.resolve("uploads/f1-media");

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
      .basename(file.originalname || "media", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "_");

    cb(null, `${Date.now()}-${safeBaseName}${ext || ".jpg"}`);
  },
});

const imageFileFilter = (_req, file, cb) => {
  if (!file.mimetype?.startsWith("image/")) {
    return cb(new Error("Chỉ chấp nhận file ảnh"));
  }
  cb(null, true);
};

export const uploadF1Media = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});
