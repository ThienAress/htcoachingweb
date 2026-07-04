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

const multerOptions = (maxSizeMB = 10) => ({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

export const uploadHeroImage = multer(multerOptions(20));
export const uploadAboutImage = multer(multerOptions(20));
export const uploadTrainerImage = multer(multerOptions(10));
export const uploadClassesImage = multer(multerOptions(10));
export const uploadToolsImage = multer(multerOptions(20));
