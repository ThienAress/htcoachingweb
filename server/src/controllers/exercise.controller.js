import Exercise, {
  deriveTechnicalDifficultyRating,
  TECHNICAL_DIFFICULTY_CRITERIA,
} from "../models/Exercise.js";
import ExerciseReview from "../models/ExerciseReview.js";
import {
  isPinnedExerciseDescriptionCohortSafe,
  isPinnedExercisePostStateEligible,
  isSearchIndexExerciseId,
  normalizeExerciseSeoText,
  SEARCH_INDEX_EXERCISE_IDS,
} from "../seo/exerciseSearchIndexPolicy.js";
import { destroyCloudinaryAsset } from "../utils/cloudinaryUpload.js";
import { safeLog } from "../utils/safeLogger.js";
import { scheduleNetlifyBuild } from "../utils/triggerBuild.js";

const COMPLETE_TECHNICAL_DIFFICULTY_QUERY = {
  $and: TECHNICAL_DIFFICULTY_CRITERIA.map((criterion) => ({
    [`technicalDifficulty.${criterion}`]: { $in: [0, 1, 2] },
  })),
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TECHNICAL_DIFFICULTY_RATING_RANGES = {
  1: [0, 1],
  2: [2, 3],
  3: [4, 5],
  4: [6, 7],
  5: [8, 10],
};

const rejectPinnedExerciseMutation = (res, code, message) =>
  res.status(409).json({
    success: false,
    message,
    details: { code },
  });

const buildTechnicalDifficultyQuery = (rating) => {
  if (!rating) return null;
  if (rating === "unrated") {
    return { $nor: [COMPLETE_TECHNICAL_DIFFICULTY_QUERY] };
  }

  const [minimum, maximum] = TECHNICAL_DIFFICULTY_RATING_RANGES[rating];
  const total = {
    $add: TECHNICAL_DIFFICULTY_CRITERIA.map(
      (criterion) => `$technicalDifficulty.${criterion}`,
    ),
  };
  return {
    ...COMPLETE_TECHNICAL_DIFFICULTY_QUERY,
    $expr: {
      $and: [{ $gte: [total, minimum] }, { $lte: [total, maximum] }],
    },
  };
};

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

// Lấy tất cả bài tập (có phân trang, tìm kiếm)
export const getExercises = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const muscleGroup = req.query.muscleGroup || "";
    const technicalDifficultyRating = req.query.technicalDifficultyRating || "";

    let query = {};
    if (search) {
      query.name = { $regex: escapeRegex(search), $options: "i" };
    }
    if (muscleGroup) {
      query.muscleGroup = muscleGroup;
    }
    const technicalDifficultyQuery = buildTechnicalDifficultyQuery(
      technicalDifficultyRating,
    );
    if (technicalDifficultyQuery) {
      query = { $and: [query, technicalDifficultyQuery] };
    }

    const total = await Exercise.countDocuments(query);
    const exercises = await Exercise.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: exercises.map(serializeExercise),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    safeLog.error("exercise.list_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Lấy một bài tập theo ID
export const getExerciseById = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }
    res.json({ success: true, data: serializeExercise(exercise) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Tạo bài tập mới (chỉ admin)
export const createExercise = async (req, res) => {
  try {
    const {
      name,
      muscleGroup,
      description,
      imageUrl,
      instructions,
      technicalDifficulty,
    } = req.body;
    if (!name || !muscleGroup) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu tên hoặc nhóm cơ" });
    }
    const existing = await Exercise.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Bài tập đã tồn tại" });
    }
    const exercise = await Exercise.create({
      name,
      muscleGroup,
      description,
      imageUrl,
      instructions,
      technicalDifficulty,
    });
    scheduleNetlifyBuild("exercise_created");
    res.status(201).json({ success: true, data: serializeExercise(exercise) });
  } catch (err) {
    safeLog.error("exercise.create_failed", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Tạo nhiều bài tập mới (chỉ admin)
export const createManyExercises = async (req, res) => {
  try {
    const exercises = req.body.exercises;
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Dữ liệu không hợp lệ" });
    }
    const results = { success: [], failed: [] };
    for (const item of exercises) {
      try {
        const {
          name,
          muscleGroup,
          description,
          imageUrl,
          instructions,
          technicalDifficulty,
        } = item;
        if (!name || !muscleGroup) {
          results.failed.push({ ...item, error: "Thiếu tên hoặc nhóm cơ" });
          continue;
        }
        const existing = await Exercise.findOne({ name });
        if (existing) {
          results.failed.push({ ...item, error: "Tên bài tập đã tồn tại" });
          continue;
        }
        const newExercise = await Exercise.create({
          name,
          muscleGroup,
          description,
          imageUrl,
          instructions,
          technicalDifficulty,
        });
        results.success.push(serializeExercise(newExercise));
      } catch (err) {
        results.failed.push({ ...item, error: err.message });
      }
    }
    if (results.success.length > 0) {
      scheduleNetlifyBuild("exercise_bulk_created");
    }
    res.status(201).json({
      success: true,
      data: results,
      message: `Thêm thành công ${results.success.length} / ${exercises.length} bài tập`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Cập nhật bài tập (chỉ admin)
export const updateExercise = async (req, res) => {
  try {
    const allowed = [
      "name",
      "muscleGroup",
      "description",
      "imageUrl",
      "instructions",
      "technicalDifficulty",
    ];
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }

    const pinnedExercise = isSearchIndexExerciseId(exercise._id);
    const previousNormalizedDescription = normalizeExerciseSeoText(
      exercise.description,
    );
    const providedFields = allowed.filter((key) => req.body[key] !== undefined);
    for (const key of providedFields) {
      exercise[key] = req.body[key];
    }
    const hasChanges = providedFields.some((key) => exercise.isModified(key));
    if (hasChanges) {
      if (
        pinnedExercise &&
        normalizeExerciseSeoText(exercise.description) !==
          previousNormalizedDescription
      ) {
        return rejectPinnedExerciseMutation(
          res,
          "PINNED_EXERCISE_DESCRIPTION_CHANGE_BLOCKED",
          "Không thể thay đổi mô tả của bài tập đang thuộc cohort tìm kiếm. Hãy repin cohort trước khi cập nhật.",
        );
      }
      if (
        pinnedExercise &&
        !isPinnedExercisePostStateEligible(exercise)
      ) {
        return rejectPinnedExerciseMutation(
          res,
          "PINNED_EXERCISE_INELIGIBLE",
          "Không thể cập nhật vì bài tập đang thuộc cohort tìm kiếm và thay đổi này làm nội dung không còn đạt chuẩn. Hãy repin cohort trước khi cập nhật.",
        );
      }
      if (pinnedExercise) {
        const exerciseId = String(exercise._id).toLowerCase();
        const siblingIds = SEARCH_INDEX_EXERCISE_IDS.filter(
          (id) => id !== exerciseId,
        );
        const siblings = await Exercise.find({
          _id: { $in: siblingIds },
        })
          .select({ _id: 1, description: 1 })
          .lean();
        if (!isPinnedExerciseDescriptionCohortSafe(exercise, siblings)) {
          return rejectPinnedExerciseMutation(
            res,
            "PINNED_EXERCISE_DESCRIPTION_CONFLICT",
            "Không thể cập nhật vì cohort tìm kiếm thiếu dữ liệu hoặc có mô tả bài tập bị trùng sau chuẩn hóa. Hãy repin cohort trước khi cập nhật.",
          );
        }
      }
      await exercise.save();
      scheduleNetlifyBuild("exercise_updated");
    }
    res.json({ success: true, data: serializeExercise(exercise) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Xóa bài tập (chỉ admin)
export const deleteExercise = async (req, res) => {
  try {
    if (isSearchIndexExerciseId(req.params.id)) {
      return rejectPinnedExerciseMutation(
        res,
        "PINNED_EXERCISE_DELETE_BLOCKED",
        "Không thể xóa bài tập đang thuộc cohort tìm kiếm. Hãy repin và deploy cohort mới trước khi xóa.",
      );
    }
    const exercise = await Exercise.findByIdAndDelete(req.params.id).select(
      "+videoPublicId",
    );
    if (!exercise) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }
    try {
      await ExerciseReview.deleteMany({ exerciseId: exercise._id });
    } catch (cleanupError) {
      safeLog.error("exercise.review_cleanup_after_delete_failed", cleanupError);
    }
    if (exercise.videoPublicId) {
      try {
        await destroyCloudinaryAsset(exercise.videoPublicId, "video");
      } catch (cleanupError) {
        safeLog.error("exercise.video_cleanup_after_delete_failed", cleanupError);
      }
    }
    scheduleNetlifyBuild("exercise_deleted");
    res.json({ success: true, message: "Xóa thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
