import mongoose from "mongoose";
import CoachingDay from "../models/CoachingDay.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { applyExerciseFeedback } from "../utils/coachingFeedback.js";
import { buildTrainerPlanUpdate } from "../utils/coachingPlan.js";
import { incrementMetric } from "../observability/metrics.js";
import { trackDbQuery } from "../observability/queryTelemetry.js";
import { safeLog } from "../utils/safeLogger.js";
import { isTodayPlatformEnabled } from "../config/todayPlatform.js";
import {
  deleteCoachingCommentsForTargets,
} from "../services/coachingCommentPrivacy.service.js";
import { enqueueAccountDeletionMedia } from "../services/accountDeletionMedia.service.js";
import {
  collectCoachingMediaDeletionInventory,
  createPrivateCoachingMedia,
  deletePrivateCoachingMedia,
  getPrivateCoachingMediaUrl,
  serializeCoachingPlanMedia,
  serializeCoachingPlansMedia,
} from "../services/coachingPrivateMedia.service.js";

const MAX_CLIENT_FEEDBACK_TEXT_LENGTH = 5000;
const privateResponse = (res) =>
  res.setHeader("Cache-Control", "private, no-store");

const stripClientFeedbackMedia = (rawExercises) => {
  let exercises = rawExercises;
  if (typeof exercises === "string") {
    try {
      exercises = JSON.parse(exercises);
    } catch {
      return rawExercises;
    }
  }
  if (!Array.isArray(exercises)) return exercises;
  return exercises.map((exercise) => {
    if (!exercise || typeof exercise !== "object") return exercise;
    const { clientFeedbackVideo: _ignoredSignedUrl, ...safeExercise } = exercise;
    return safeExercise;
  });
};

const updateClientStatus = (plan) => {
  const allCompleted =
    plan.exercises.length > 0 &&
    plan.exercises.every((exercise) => exercise.completed);
  plan.clientStatus = allCompleted ? "completed" : "pending";
};

// ================= KHÁCH HÀNG (CLIENT) =================

// 1. Lấy danh sách ngày tập của tôi (để dựng sidebar gập/mở tuần)
export const getMyPlans = async (req, res) => {
  try {
    const plans = await trackDbQuery("coaching.client.list", () =>
      CoachingDay.find({ userId: req.user.id })
        .select(
          "date dateString title clientStatus exercises.name exercises.completed trainerId",
        )
        .populate("trainerId", "name email avatar")
        .sort({ date: -1 })
        .limit(100)
        .lean(),
    );

    res.json({
      success: true,
      data: plans,
    });
  } catch (err) {
    safeLog.error("coaching.my_plans_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách bài tập" });
  }
};

// 2. Lấy chi tiết bài tập của một ngày cụ thể (dateString)
export const getMyPlanDetails = async (req, res) => {
  try {
    const { dateString } = req.params;
    const plan = await CoachingDay.findOne({
      userId: req.user.id,
      dateString,
    }).populate("trainerId", "name email avatar");

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giáo án tập luyện cho ngày này",
      });
    }

    const serializedPlan = await serializeCoachingPlanMedia(plan);
    privateResponse(res);
    res.json({
      success: true,
      data: serializedPlan,
    });
  } catch (err) {
    safeLog.error("coaching.plan_detail_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy chi tiết bài tập" });
  }
};

// 3. Khách tích chọn hoàn thành bài & gửi feedback kèm video ngắn
export const submitFeedback = async (req, res) => {
  try {
    const { dateString } = req.params;
    const { clientFeedbackText } = req.body;

    if (
      clientFeedbackText !== undefined &&
      (typeof clientFeedbackText !== "string" ||
        clientFeedbackText.length > MAX_CLIENT_FEEDBACK_TEXT_LENGTH)
    ) {
      return res.status(400).json({
        success: false,
        message: "Phản hồi buổi tập không hợp lệ hoặc quá dài",
      });
    }

    const plan = await CoachingDay.findOne({
      userId: req.user.id,
      dateString,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy giáo án để cập nhật phản hồi",
      });
    }

    try {
      applyExerciseFeedback(
        plan.exercises,
        stripClientFeedbackMedia(req.body.exercises),
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (clientFeedbackText !== undefined) {
      plan.clientFeedbackText = clientFeedbackText;
    }

    // Tự động kiểm tra trạng thái hoàn thành ngày tập
    // Nếu tất cả bài tập trong checklist đều có completed = true thì đánh dấu completed
    updateClientStatus(plan);

    await plan.save();

    const serializedPlan = await serializeCoachingPlanMedia(plan);

    privateResponse(res);
    res.json({
      success: true,
      data: serializedPlan,
      message: "Cập nhật tiến trình tập luyện thành công",
    });
  } catch (err) {
    safeLog.error("coaching.feedback_submit_failed", err);
    res.status(500).json({ success: false, message: "Lỗi gửi phản hồi tập luyện" });
  }
};

// ================= HUẤN LUYỆN VIÊN (TRAINER) =================

// 4. Lấy danh sách khách hàng được gán cho Trainer (từ các Orders approved)
export const getTrainerClients = async (req, res) => {
  try {
    let query = { status: "approved", sessions: { $gt: 0 } };
    
    // Nếu không phải admin thì trainer chỉ lấy khách của họ
    if (req.user.role !== "admin") {
      query.trainerId = req.user.id;
    }

    // Lấy orders approved, populate user
    const orders = await trackDbQuery("coaching.trainer.clients", () =>
      Order.find(query)
        .select("userId package updatedAt")
        .populate("userId", "name email avatar phone")
        .sort({ updatedAt: -1 })
        .limit(1000)
        .lean(),
    );

    // Lọc ra danh sách khách hàng duy nhất
    const clientsMap = {};
    orders.forEach((o) => {
      if (o.userId && o.userId._id) {
        const client = o.userId;
        if (!clientsMap[client._id]) {
          clientsMap[client._id] = {
            _id: client._id,
            name: client.name,
            email: client.email,
            avatar: client.avatar,
            phone: client.phone,
            package: o.package,
            orderId: o._id,
          };
        }
      }
    });

    const uniqueClients = Object.values(clientsMap);

    res.json({
      success: true,
      data: uniqueClients,
    });
  } catch (err) {
    safeLog.error("coaching.trainer_clients_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy danh sách khách hàng" });
  }
};

// 5. Xem lịch sử giáo án của một khách hàng cụ thể
export const getClientTimeline = async (req, res) => {
  try {
    const { userId } = req.params;

    // Trainer kiểm tra xem có quyền quản lý khách này không (hoặc là admin)
    if (req.user.role !== "admin") {
      const hasOrder = await Order.findOne({
        userId,
        trainerId: req.user.id,
        status: "approved",
      });
      if (!hasOrder) {
        return res.status(403).json({ success: false, message: "Bạn không quản lý khách hàng này" });
      }
    }

    const historyFilter = { userId };
    if (req.user.role !== "admin") {
      historyFilter.trainerId = req.user.id;
    }
    const history = await trackDbQuery("coaching.trainer.timeline", () =>
      CoachingDay.find(historyFilter)
        .populate("trainerId", "name email")
        .sort({ date: -1 })
        .limit(120)
        .lean(),
    );

    const serializedHistory = await serializeCoachingPlansMedia(history);
    privateResponse(res);
    res.json({
      success: true,
      data: serializedHistory,
    });
  } catch (err) {
    safeLog.error("coaching.client_timeline_failed", err);
    res.status(500).json({ success: false, message: "Lỗi lấy lịch sử bài tập của khách" });
  }
};

// 6. Huấn luyện viên tạo mới hoặc cập nhật giáo án (Upsert)
export const upsertCoachingDay = async (req, res) => {
  try {
    const { userId } = req.params;
    const { dateString, revision, assignedTrainerId } = req.body;
    const existingPlan = dateString
      ? await CoachingDay.findOne({ userId, dateString })
      : null;

    const orderQuery = {
      userId,
      status: "approved",
    };
    if (req.user.role !== "admin") {
      orderQuery.trainerId = req.user.id;
    } else if (assignedTrainerId) {
      orderQuery.trainerId = assignedTrainerId;
    }

    const approvedOrder = await Order.findOne(orderQuery).sort({
      updatedAt: -1,
    });
    if (!approvedOrder) {
      return res.status(403).json({
        success: false,
        message: "Không tìm thấy quan hệ huấn luyện đã được phê duyệt",
      });
    }

    let trainerId;
    if (existingPlan) {
      trainerId = existingPlan.trainerId;
      if (
        req.user.role !== "admin" &&
        String(trainerId) !== String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền sửa giáo án này",
        });
      }
      if (!Number.isInteger(revision) || revision !== existingPlan.__v) {
        incrementMetric("coaching.revision_conflicts");
        return res.status(409).json({
          success: false,
          code: "COACHING_REVISION_CONFLICT",
          message: "Giáo án đã thay đổi. Vui lòng tải lại trước khi lưu",
          currentRevision: existingPlan.__v,
        });
      }
    } else {
      trainerId =
        req.user.role === "admin"
          ? assignedTrainerId || approvedOrder.trainerId
          : req.user.id;
    }

    let planUpdate;
    try {
      planUpdate = buildTrainerPlanUpdate(
        req.body,
        existingPlan?.exercises || [],
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    let plan;
    if (existingPlan) {
      existingPlan.set(planUpdate);
      plan = await existingPlan.save();
    } else {
      plan = await CoachingDay.create({
        userId,
        trainerId,
        ...planUpdate,
      });
    }

    const serializedPlan = await serializeCoachingPlanMedia(plan);
    privateResponse(res);
    res.json({
      success: true,
      data: serializedPlan,
      message: "Lưu giáo án thành công",
    });
  } catch (err) {
    safeLog.error("coaching.day_upsert_failed", err);
    if (err.name === "VersionError") {
      incrementMetric("coaching.revision_conflicts");
      return res.status(409).json({
        success: false,
        code: "COACHING_REVISION_CONFLICT",
        message: "Giáo án đã được cập nhật bởi một yêu cầu khác",
      });
    }
    res.status(500).json({ success: false, message: "Lỗi lưu giáo án luyện tập" });
  }
};

// 7. Xoá giáo án của một ngày tập cụ thể
export const deleteCoachingDay = async (req, res) => {
  const todayPlatformEnabled = isTodayPlatformEnabled();
  const session = await mongoose.startSession();
  try {
    const { userId, dateString } = req.params;

    // Kiểm tra quyền
    if (req.user.role !== "admin") {
      const hasOrder = await Order.findOne({
        userId,
        trainerId: req.user.id,
        status: "approved",
      });
      if (!hasOrder) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền chỉnh sửa khách hàng này" });
      }
    }

    const deleteFilter = { userId, dateString };
    if (req.user.role !== "admin") {
      deleteFilter.trainerId = req.user.id;
    }

    let deleted = null;
    await session.withTransaction(async () => {
      deleted = await CoachingDay.findOneAndDelete(deleteFilter).session(
        session,
      );
      if (!deleted) return;
      const mediaInventory = collectCoachingMediaDeletionInventory(deleted);
      if (mediaInventory.unsupported.length > 0) {
        throw Object.assign(
          new Error("Cần xác minh nguồn video trước khi xóa giáo án"),
          { status: 409, code: "COACHING_MEDIA_OWNERSHIP_REQUIRED" },
        );
      }
      await enqueueAccountDeletionMedia({
        targetUserId: deleted.userId,
        assets: mediaInventory.assets,
        session,
      });
      if (todayPlatformEnabled) {
        await deleteCoachingCommentsForTargets({
          targets: [{
            targetType: "coaching_day",
            targetId: deleted._id,
          }],
          session,
        });
      }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo án tập để xóa" });
    }

    res.json({
      success: true,
      message: "Đã xóa giáo án thành công",
    });
  } catch (err) {
    safeLog.error("coaching.day_delete_failed", err);
    res.status(err.status || 500).json({
      success: false,
      ...(err.code ? { code: err.code } : {}),
      message:
        err.status && err.message ? err.message : "Lỗi xóa giáo án tập luyện",
    });
  } finally {
    await session.endSession();
  }
};

// 8. Tải lên video demo bài tập của Trainer
export const uploadCoachingDemoVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
    }

    privateResponse(res);
    res.json({
      success: true,
      url: req.file.path,
      message: "Tải lên video demo thành công",
    });
  } catch (err) {
    safeLog.error("coaching.demo_upload_failed", err);
    res.status(500).json({ success: false, message: "Lỗi tải lên video demo" });
  }
};

// 9. Xác minh ownership trước khi route bắt đầu đọc multipart body.
export const authorizeClientFeedbackVideoUpload = async (req, res, next) => {
  try {
    const { dateString, exerciseId } = req.params;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateString || "") ||
      !mongoose.isValidObjectId(exerciseId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Ngày giáo án hoặc mã bài tập không hợp lệ",
      });
    }
    const plan = await CoachingDay.findOne({
      userId: req.user.id,
      dateString,
      "exercises._id": exerciseId,
    }).select("_id");
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài tập thuộc giáo án của bạn",
      });
    }
    req.coachingFeedbackUpload = {
      planId: plan._id,
      exerciseId,
    };
    return next();
  } catch (err) {
    safeLog.error("coaching.feedback_video_authorize_failed", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi kiểm tra quyền tải video phản hồi",
    });
  }
};

export const retireLegacyClientFeedbackUpload = (_req, res) =>
  res.status(410).json({
    success: false,
    code: "COACHING_FEEDBACK_UPLOAD_ROUTE_RETIRED",
    message: "Vui lòng tải lại trang trước khi gửi video phản hồi",
  });

// 10. Tải lên video phản hồi kỹ thuật bài tập của Client
export const uploadClientFeedbackVideo = async (req, res) => {
  let uploadedMedia = null;
  let session = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
    }

    uploadedMedia = createPrivateCoachingMedia(req.file);
    const signedUrl = await getPrivateCoachingMediaUrl(uploadedMedia);
    const { planId, exerciseId } = req.coachingFeedbackUpload || {};
    session = await mongoose.startSession();
    let updatedPlan = null;
    await session.withTransaction(async () => {
      const plan = await CoachingDay.findOne({
        _id: planId,
        userId: req.user.id,
        "exercises._id": exerciseId,
      }).session(session);
      const exercise = plan?.exercises.id(exerciseId);
      if (!plan || !exercise) {
        throw Object.assign(
          new Error("Không tìm thấy bài tập thuộc giáo án của bạn"),
          { status: 404 },
        );
      }

      const previousMedia = exercise.clientFeedbackVideo;
      exercise.clientFeedbackVideo = uploadedMedia;
      exercise.completed = true;
      updateClientStatus(plan);
      await plan.save({ session });

      if (previousMedia) {
        const mediaInventory = collectCoachingMediaDeletionInventory({
          clientFeedbackVideo: previousMedia,
          exercises: [],
        });
        await enqueueAccountDeletionMedia({
          targetUserId: plan.userId,
          assets: mediaInventory.assets,
          session,
        });
      }
      updatedPlan = plan;
    });

    // DB đã tham chiếu asset mới và cleanup asset cũ đã được ghi bền vững.
    uploadedMedia = null;

    privateResponse(res);
    return res.json({
      success: true,
      url: signedUrl,
      revision: updatedPlan.__v,
      clientStatus: updatedPlan.clientStatus,
      message: "Tải lên video phản hồi thành công",
    });
  } catch (err) {
    if (uploadedMedia) {
      try {
        await deletePrivateCoachingMedia(uploadedMedia);
      } catch (cleanupError) {
        incrementMetric("coaching.cleanup_failures");
        safeLog.error("coaching.new_feedback_cleanup_failed", cleanupError);
      }
    }
    safeLog.error("coaching.feedback_video_upload_failed", err);
    return res.status(err.status || 500).json({
      success: false,
      message:
        err.status && err.message ? err.message : "Lỗi tải lên video phản hồi",
    });
  } finally {
    if (session) await session.endSession();
  }
};

// 11. Gỡ video bằng action riêng; không nhận URL delivery từ client.
export const removeClientFeedbackVideo = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { planId, exerciseId } = req.coachingFeedbackUpload || {};
    let updatedPlan = null;
    await session.withTransaction(async () => {
      const plan = await CoachingDay.findOne({
        _id: planId,
        userId: req.user.id,
        "exercises._id": exerciseId,
      }).session(session);
      const exercise = plan?.exercises.id(exerciseId);
      if (!plan || !exercise) {
        throw Object.assign(
          new Error("Không tìm thấy bài tập thuộc giáo án của bạn"),
          { status: 404 },
        );
      }

      const previousMedia = exercise.clientFeedbackVideo;
      exercise.clientFeedbackVideo = "";
      exercise.completed = false;
      updateClientStatus(plan);
      await plan.save({ session });

      if (previousMedia) {
        const mediaInventory = collectCoachingMediaDeletionInventory({
          clientFeedbackVideo: previousMedia,
          exercises: [],
        });
        await enqueueAccountDeletionMedia({
          targetUserId: plan.userId,
          assets: mediaInventory.assets,
          session,
        });
      }
      updatedPlan = plan;
    });

    return res.json({
      success: true,
      revision: updatedPlan.__v,
      clientStatus: updatedPlan.clientStatus,
      message: "Đã gỡ video phản hồi",
    });
  } catch (err) {
    safeLog.error("coaching.feedback_video_remove_failed", err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.status && err.message ? err.message : "Lỗi gỡ video phản hồi",
    });
  } finally {
    await session.endSession();
  }
};
