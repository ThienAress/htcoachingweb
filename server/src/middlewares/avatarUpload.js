import path from "path";
import multer from "multer";

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const imageFileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (file.mimetype?.startsWith("image/") && allowedExtensions.has(ext)) {
    return cb(null, true);
  }

  cb(new Error("Chỉ chấp nhận file hình ảnh (jpg, jpeg, png, gif, webp)"));
};

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
