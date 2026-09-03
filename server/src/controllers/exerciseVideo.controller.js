import path from "path";

import Exercise, {
  deriveTechnicalDifficultyRating,
} from "../models/Exercise.js";
import {
  destroyCloudinaryAsset,
  uploadBufferToCloudinary,
} from "../utils/cloudinaryUpload.js";
import { safeLog } from "../utils/safeLogger.js";
import { scheduleNetlifyBuild } from "../utils/triggerBuild.js";

const serializeExercise = (exercise) => {
  const data = exercise.toObject();
  delete data.videoPublicId;
  delete data._testCatalogFixture;
  delete data._stagingSearchIndexCohortFixture;
  delete data._stagingSearchIndexCohortDisplaced;
  return {
    ...data,
    technicalDifficultyRating: deriveTechnicalDifficultyRating(
      data.technicalDifficulty,
    ),
  };
};

export const uploadExerciseVideo = async (req, res) => {
  let uploadedPublicId = "";
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Không tìm thấy video tải lên" });
    }

    const exercise = await Exercise.findById(req.params.id).select(
      "+videoPublicId",
    );
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }

    const extension = path.extname(req.file.originalname || "").toLowerCase();
    const safeBaseName = path
      .basename(req.file.originalname || "exercise-video", extension)
      .replace(/[^a-zA-Z0-9-_]/g, "_");
    const upload = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "htcoaching/exercise-videos",
      public_id: `${exercise._id}-${Date.now()}-${safeBaseName}`,
      resource_type: "video",
      allowed_formats: ["mp4", "mov", "webm"],
    });
    uploadedPublicId = upload.public_id;

    const previousPublicId = exercise.videoPublicId;
    exercise.videoUrl = upload.url;
    exercise.videoPublicId = upload.public_id;
    await exercise.save();

    if (previousPublicId && previousPublicId !== uploadedPublicId) {
      try {
        await destroyCloudinaryAsset(previousPublicId, "video");
      } catch (cleanupError) {
        safeLog.error("exercise.previous_video_cleanup_failed", cleanupError);
      }
    }
    scheduleNetlifyBuild("exercise_video_uploaded");

    return res.json({
      success: true,
      data: serializeExercise(exercise),
      message: "Tải video bài tập thành công",
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await destroyCloudinaryAsset(uploadedPublicId, "video");
      } catch (cleanupError) {
        safeLog.error("exercise.new_video_cleanup_failed", cleanupError);
      }
    }
    safeLog.error("exercise.video_upload_failed", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải video bài tập lúc này",
    });
  }
};

export const deleteExerciseVideo = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id).select(
      "+videoPublicId",
    );
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }

    const hasStoredVideo = Boolean(exercise.videoUrl || exercise.videoPublicId);
    if (hasStoredVideo) {
      const previousPublicId = exercise.videoPublicId;
      exercise.videoUrl = "";
      exercise.videoPublicId = "";
      await exercise.save();

      if (previousPublicId) {
        try {
          await destroyCloudinaryAsset(previousPublicId, "video");
        } catch (cleanupError) {
          safeLog.error("exercise.video_delete_cleanup_failed", cleanupError);
        }
      }
      scheduleNetlifyBuild("exercise_video_deleted");
    }

    return res.json({
      success: true,
      data: serializeExercise(exercise),
      message: "Đã xóa video bài tập",
    });
  } catch (error) {
    safeLog.error("exercise.video_delete_failed", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xóa video bài tập lúc này",
    });
  }
};
