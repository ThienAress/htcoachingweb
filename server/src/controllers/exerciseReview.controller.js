import {
  deleteExerciseReview,
  findPublicExercise,
  getExerciseReviews,
  upsertExerciseReview,
} from "../services/exerciseReview.service.js";
import { safeLog } from "../utils/safeLogger.js";

const handleError = (res, error) => {
  if (error?.statusCode) {
    return res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Đánh giá đã được cập nhật, vui lòng thử lại.",
    });
  }
  safeLog.error("exercise_review.request_failed", error);
  return res.status(500).json({
    success: false,
    message: "Không thể xử lý đánh giá lúc này.",
  });
};

export const getReviews = async (req, res) => {
  try {
    if (!(await findPublicExercise(req.params.exerciseId))) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 10, 1),
      50,
    );
    const data = await getExerciseReviews(
      req.params.exerciseId,
      req.user?.id,
      { page, limit },
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

export const upsertReview = async (req, res) => {
  try {
    if (!(await findPublicExercise(req.params.exerciseId))) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy bài tập" });
    }
    const review = await upsertExerciseReview({
      exerciseId: req.params.exerciseId,
      userId: req.user.id,
      rating: req.body.rating,
      comment: req.body.comment,
    });
    return res.json({ success: true, data: review });
  } catch (error) {
    return handleError(res, error);
  }
};

export const removeReview = async (req, res) => {
  try {
    const deleted = await deleteExerciseReview(
      req.params.exerciseId,
      req.user.id,
    );
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Bạn chưa có đánh giá cho bài tập này",
      });
    }
    return res.json({ success: true, message: "Đã xóa đánh giá" });
  } catch (error) {
    return handleError(res, error);
  }
};
