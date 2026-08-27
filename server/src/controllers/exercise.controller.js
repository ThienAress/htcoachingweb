import Exercise, {
  deriveTechnicalDifficultyRating,
  TECHNICAL_DIFFICULTY_CRITERIA,
} from "../models/Exercise.js";
import ExerciseReview from "../models/ExerciseReview.js";
import { destroyCloudinaryAsset } from "../utils/cloudinaryUpload.js";
import { safeLog } from "../utils/safeLogger.js";

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
    const updateData = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    const exercise = await Exercise.findByIdAndUpdate(req.params.id, updateData, {
      returnDocument: 'after',
      runValidators: true,
    });
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

// Xóa bài tập (chỉ admin)
export const deleteExercise = async (req, res) => {
  try {
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
    res.json({ success: true, message: "Xóa thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
