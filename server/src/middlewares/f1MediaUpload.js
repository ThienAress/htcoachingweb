import multer from "multer";

const imageFileFilter = (_req, file, cb) => {
  if (!file.mimetype?.startsWith("image/")) {
    return cb(new Error("Chỉ chấp nhận file ảnh"));
  }
  cb(null, true);
};

export const uploadF1Media = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: Math.max(
      Number(process.env.F1_MEDIA_MAX_INPUT_BYTES || 8 * 1024 * 1024),
      1024,
    ),
    files: 1,
    fields: 4,
  },
});
