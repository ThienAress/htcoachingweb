import path from "path";
import multer from "multer";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (!file.mimetype?.startsWith("image/") || !allowedExtensions.has(ext)) {
    return cb(new Error("Chỉ chấp nhận ảnh jpg, jpeg, png hoặc webp"));
  }

  cb(null, true);
};

export const uploadBlogImageMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});
