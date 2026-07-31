import {
  protect,
  requireRoles,
  requireTrainerAccess as requireBaseTrainerAccess,
} from "./auth.middleware.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { getTrainerPlan } from "../services/trainerPlanCatalog.service.js";
import { safeLog } from "../utils/safeLogger.js";

const requireF1Entitlement = async (req, res, next) => {
  if (req.user.role === "admin") return next();

  try {
    const subscription =
      req.trainerSubscription ||
      (await TrainerSubscription.findOne({
        userId: req.user.id,
        isActive: true,
        endDate: { $gt: new Date() },
      }).lean());
    const plan = getTrainerPlan(subscription?.planCode || subscription?.planTitle);
    if (plan?.entitlements.f1CrmAi) return next();

    return res.status(403).json({
      success: false,
      code: "TRAINER_ENTITLEMENT_REQUIRED",
      message: "F1 CRM & AI chỉ có trong gói Chuyên nghiệp và Cao cấp",
    });
  } catch (error) {
    safeLog.error("auth.f1_entitlement_check_failed", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi kiểm tra quyền truy cập F1 CRM & AI",
    });
  }
};

export const requireTrainerAccess = (req, res, next) =>
  requireBaseTrainerAccess(req, res, () => requireF1Entitlement(req, res, next));

export { protect, requireRoles };
