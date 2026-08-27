import path from "node:path";
import multer from "multer";

const ALLOWED_JSON_MIME_TYPES = new Set([
  "application/json",
  "text/json",
  "application/octet-stream",
]);

export const RECIPE_NUTRITION_JSON_MAX_SIZE = 8 * 1024 * 1024;

export const recipeNutritionJsonFileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (
    extension !== ".json" ||
    !ALLOWED_JSON_MIME_TYPES.has(file.mimetype)
  ) {
    return callback(new Error("Chỉ chấp nhận file JSON (.json)"));
  }
  return callback(null, true);
};

const recipeNutritionJsonUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: recipeNutritionJsonFileFilter,
  limits: {
    fileSize: RECIPE_NUTRITION_JSON_MAX_SIZE,
    files: 1,
    fields: 2,
  },
});

export const uploadRecipeNutritionJson = (req, res, next) => {
  recipeNutritionJsonUpload.single("file")(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "File JSON dinh dưỡng tối đa 8MB"
        : error.message;
    return res.status(400).json({ success: false, message });
  });
};
