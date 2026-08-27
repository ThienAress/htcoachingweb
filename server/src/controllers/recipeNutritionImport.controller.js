import {
  commitRecipeNutritionImport,
  createRecipeNutritionPreviewToken,
  parseRecipeNutritionImportDocument,
  previewRecipeNutritionImport,
  RecipeNutritionImportError,
  verifyRecipeNutritionPreviewToken,
} from "../services/recipeNutritionImport.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { triggerNetlifyBuild } from "../utils/triggerBuild.js";

export const importRecipeNutrition = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      throw new RecipeNutritionImportError("Vui lòng chọn file JSON cần nhập");
    }
    if (!["true", "false"].includes(req.body.dryRun)) {
      throw new RecipeNutritionImportError("dryRun phải là true hoặc false");
    }

    const document = parseRecipeNutritionImportDocument(req.file.buffer);
    const dryRun = req.body.dryRun === "true";
    if (!dryRun) {
      verifyRecipeNutritionPreviewToken(
        req.body.previewToken,
        req.file.buffer,
        req.user.id,
      );
    }

    const data = dryRun
      ? await previewRecipeNutritionImport(document)
      : await commitRecipeNutritionImport(document);
    if (dryRun && data.summary.canImport) {
      data.previewToken = createRecipeNutritionPreviewToken(
        req.file.buffer,
        req.user.id,
      );
    }
    if (!dryRun) void triggerNetlifyBuild();

    return res.json({
      success: true,
      data,
      message: dryRun
        ? "Đã xem trước file JSON, chưa có dữ liệu nào được cập nhật"
        : `Đã cập nhật dinh dưỡng cho ${data.updatedItems} công thức`,
    });
  } catch (error) {
    if (error instanceof RecipeNutritionImportError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }
    safeLog.error("recipe.nutrition_import_failed", error);
    return res.status(500).json({
      success: false,
      message: "Không thể nhập dinh dưỡng công thức lúc này",
    });
  }
};
