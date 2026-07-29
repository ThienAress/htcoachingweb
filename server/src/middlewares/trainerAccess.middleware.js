import TrainerSubscription from "../models/TrainerSubscription.js";
import { requireTrainerAccess } from "./auth.middleware.js";
import { safeLog } from "../utils/safeLogger.js";

export const requireTrainerActor = (req, res, next) =>
  requireTrainerAccess(req, res, () => {
    if (req.isAdmin) {
      return res.status(403).json({
        success: false,
        code: "TRAINER_ROLE_REQUIRED",
        message: "Chức năng này yêu cầu tài khoản huấn luyện viên",
      });
    }
    return next();
  });

export const attachOptionalTrainerAccess = async (req, res, next) => {
  if (req.user.role === "admin") {
    req.isAdmin = true;
    return next();
  }
  if (req.user.role === "trainer") {
    req.isAdmin = false;
    req.isTrainer = true;
    return next();
  }
  try {
    const subscription = await TrainerSubscription.findOne({
      userId: req.user.id,
      isActive: true,
      endDate: { $gt: new Date() },
    })
      .select("_id")
      .lean();
    if (subscription) {
      req.isAdmin = false;
      req.isTrainer = true;
      req.trainerSubscription = subscription;
    }
    return next();
  } catch (error) {
    safeLog.error("auth.optional_trainer_access_failed", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi kiểm tra quyền huấn luyện viên",
    });
  }
};
