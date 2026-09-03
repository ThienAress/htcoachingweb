import {
  commitExerciseInstructionsImport,
  createExerciseInstructionsPreviewToken,
  ExerciseInstructionsImportError,
  parseExerciseInstructionsImportDocument,
  previewExerciseInstructionsImport,
  verifyExerciseInstructionsPreviewToken,
} from "../services/exerciseInstructionsImport.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { scheduleNetlifyBuild } from "../utils/triggerBuild.js";

export const importExerciseInstructions = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      throw new ExerciseInstructionsImportError(
        "Vui lòng chọn file JSON cần nhập",
      );
    }
    if (!["true", "false"].includes(req.body.dryRun)) {
      throw new ExerciseInstructionsImportError(
        "dryRun phải là true hoặc false",
      );
    }

    const document = parseExerciseInstructionsImportDocument(req.file.buffer);
    const dryRun = req.body.dryRun === "true";
    if (!dryRun) {
      verifyExerciseInstructionsPreviewToken(
        req.body.previewToken,
        req.file.buffer,
        req.user.id,
      );
    }
    const data = dryRun
      ? await previewExerciseInstructionsImport(document)
      : await commitExerciseInstructionsImport(document);
    if (dryRun && data.summary.canImport) {
      data.previewToken = createExerciseInstructionsPreviewToken(
        req.file.buffer,
        req.user.id,
      );
    }
    if (!dryRun && data.modifiedItems > 0) {
      scheduleNetlifyBuild("exercise_instructions_imported");
    }

    return res.json({
      success: true,
      data,
      message: dryRun
        ? "Đã xem trước file JSON, chưa có dữ liệu nào được cập nhật"
        : `Đã cập nhật ${data.updatedItems} bài tập`,
    });
  } catch (error) {
    if (error instanceof ExerciseInstructionsImportError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }

    safeLog.error("exercise.instructions_import_failed", error);
    return res.status(500).json({
      success: false,
      message: "Không thể nhập hướng dẫn bài tập lúc này",
    });
  }
};
