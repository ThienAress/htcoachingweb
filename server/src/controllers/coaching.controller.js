import path from "path";
import CoachingDay from "../models/CoachingDay.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  destroyCloudinaryAsset,
  getCloudinaryPublicIdFromUrl,
  uploadBufferToCloudinary,
} from "../utils/cloudinaryUpload.js";
import { applyExerciseFeedback } from "../utils/coachingFeedback.js";
import { buildTrainerPlanUpdate } from "../utils/coachingPlan.js";
import { incrementMetric } from "../observability/metrics.js";
import { trackDbQuery } from "../observability/queryTelemetry.js";
import { safeLog } from "../utils/safeLogger.js";

const MAX_CLIENT_FEEDBACK_TEXT_LENGTH = 5000;

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

    res.json({
      success: true,
      data: plan,
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

    const previousFeedbackVideoIds = new Map(
      plan.exercises.map((exercise) => [
        String(exercise._id),
        getCloudinaryPublicIdFromUrl(exercise.clientFeedbackVideo),
      ]),
    );

    try {
      applyExerciseFeedback(plan.exercises, req.body.exercises);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (clientFeedbackText !== undefined) {
      plan.clientFeedbackText = clientFeedbackText;
    }

    // Nếu có file video tải lên
    if (req.file) {
      const ext = path.extname(req.file.originalname || "").toLowerCase();
      const safeBaseName = path.basename(req.file.originalname || "video", ext).replace(/[^a-zA-Z0-9-_]/g, "_");
      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: "htcoaching/coaching-videos",
        public_id: `${Date.now()}-${safeBaseName}`,
        resource_type: "video",
        allowed_formats: ["mp4", "mov", "avi", "webm", "mkv", "m4v", "3gp"],
      });
      plan.clientFeedbackVideo = result.url;
    }

    // Tự động kiểm tra trạng thái hoàn thành ngày tập
    // Nếu tất cả bài tập trong checklist đều có completed = true thì đánh dấu completed
    const allCompleted = plan.exercises.length > 0 && plan.exercises.every((ex) => ex.completed);
    plan.clientStatus = allCompleted ? "completed" : "pending";

    await plan.save();

    const staleFeedbackVideoIds = plan.exercises
      .map((exercise) => {
        const previousId = previousFeedbackVideoIds.get(String(exercise._id));
        const currentId = getCloudinaryPublicIdFromUrl(
          exercise.clientFeedbackVideo,
        );
        return previousId && previousId !== currentId ? previousId : null;
      })
      .filter(Boolean);

    for (const publicId of staleFeedbackVideoIds) {
      try {
        await destroyCloudinaryAsset(publicId, "video");
      } catch (cleanupError) {
        incrementMetric("coaching.cleanup_failures");
        safeLog.error("coaching.removed_feedback_cleanup_failed", cleanupError);
      }
    }

    res.json({
      success: true,
      data: plan,
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
    let query = { status: "approved" };
    
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

    const history = await trackDbQuery("coaching.trainer.timeline", () =>
      CoachingDay.find({ userId })
        .populate("trainerId", "name email")
        .sort({ date: -1 })
        .limit(120)
        .lean(),
    );

    res.json({
      success: true,
      data: history,
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

    res.json({
      success: true,
      data: plan,
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

    const deleted = await CoachingDay.findOneAndDelete({ userId, dateString });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giáo án tập để xóa" });
    }

    res.json({
      success: true,
      message: "Đã xóa giáo án thành công",
    });
  } catch (err) {
    safeLog.error("coaching.day_delete_failed", err);
    res.status(500).json({ success: false, message: "Lỗi xóa giáo án tập luyện" });
  }
};

// 8. Tải lên video demo bài tập của Trainer
export const uploadCoachingDemoVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const safeBaseName = path.basename(req.file.originalname || "demo-video", ext).replace(/[^a-zA-Z0-9-_]/g, "_");
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "htcoaching/coaching-videos",
      public_id: `${Date.now()}-${safeBaseName}`,
      resource_type: "video",
      allowed_formats: ["mp4", "mov", "avi", "webm", "mkv", "m4v", "3gp"],
    });

    res.json({
      success: true,
      url: result.url,
      message: "Tải lên video demo thành công",
    });
  } catch (err) {
    safeLog.error("coaching.demo_upload_failed", err);
    res.status(500).json({ success: false, message: "Lỗi tải lên video demo" });
  }
};

// 9. Tải lên video phản hồi kỹ thuật bài tập của Client
export const uploadClientFeedbackVideo = async (req, res) => {
  let uploadedPublicId = "";
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Không tìm thấy file tải lên" });
    }

    const { dateString, exerciseId } = req.body;
    if (!dateString || !exerciseId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu ngày giáo án hoặc mã bài tập",
      });
    }

    const plan = await CoachingDay.findOne({
      userId: req.user.id,
      dateString,
    });
    const exercise = plan?.exercises.id(exerciseId);
    if (!plan || !exercise) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài tập thuộc giáo án của bạn",
      });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const safeBaseName = path.basename(req.file.originalname || "feedback-video", ext).replace(/[^a-zA-Z0-9-_]/g, "_");
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "htcoaching/coaching-videos",
      public_id: `${Date.now()}-${safeBaseName}`,
      resource_type: "video",
      allowed_formats: ["mp4", "mov", "avi", "webm", "mkv", "m4v", "3gp"],
    });
    uploadedPublicId = result.public_id;

    const previousPublicId = getCloudinaryPublicIdFromUrl(
      exercise.clientFeedbackVideo,
    );
    exercise.clientFeedbackVideo = result.url;
    exercise.completed = true;
    plan.clientStatus =
      plan.exercises.length > 0 &&
      plan.exercises.every((item) => item.completed)
        ? "completed"
        : "pending";
    await plan.save();

    if (previousPublicId && previousPublicId !== uploadedPublicId) {
      try {
        await destroyCloudinaryAsset(previousPublicId, "video");
      } catch (cleanupError) {
        incrementMetric("coaching.cleanup_failures");
        safeLog.error("coaching.old_feedback_cleanup_failed", cleanupError);
      }
    }

    res.json({
      success: true,
      url: result.url,
      revision: plan.__v,
      clientStatus: plan.clientStatus,
      message: "Tải lên video phản hồi thành công",
    });
  } catch (err) {
    if (uploadedPublicId) {
      try {
        await destroyCloudinaryAsset(uploadedPublicId, "video");
      } catch (cleanupError) {
        incrementMetric("coaching.cleanup_failures");
        safeLog.error("coaching.new_feedback_cleanup_failed", cleanupError);
      }
    }
    safeLog.error("coaching.feedback_video_upload_failed", err);
    res.status(500).json({ success: false, message: "Lỗi tải lên video phản hồi" });
  }
};
