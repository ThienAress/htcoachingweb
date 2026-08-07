import express from "express";
import { safeLog } from "../utils/safeLogger.js";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import User from "../models/User.js";
import { getServiceAccessPolicy } from "../constants/serviceAccessPolicies.js";
import { resolveServiceAccessTier } from "../services/serviceAccessPolicy.service.js";

const router = express.Router();

// ===== CHECK QUYỀN TRUY CẬP =====
router.get("/check", protect, async (req, res) => {
  try {
    const tier = await resolveServiceAccessTier(req.user);
    const policy = getServiceAccessPolicy("meal_plan", tier);
    if (policy.mode === "unlimited") {
      return res.json({
        success: true,
        data: {
          access: "unlimited",
          generationCount: 0,
          maxGenerations: null,
          tier,
        },
      });
    }

    const currentUser = await User.findById(req.user.id)
      .select("mealPlanGenerations")
      .lean();
    const generationCount = currentUser?.mealPlanGenerations || 0;
    return res.json({
      success: true,
      data: {
        access: "trial",
        generationCount,
        maxGenerations: policy.limit,
        tier,
      }
    });
  } catch (err) {
    safeLog.error("mealplan.access_check_failed", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ===== GHI NHẬN 1 LƯỢT GENERATE =====
router.post("/record", protect, csrfProtection, async (req, res) => {
  try {
    const { id } = req.user;
    const tier = await resolveServiceAccessTier(req.user);
    const policy = getServiceAccessPolicy("meal_plan", tier);
    if (policy.mode === "unlimited") {
      return res.json({
        success: true,
        data: {
          access: "unlimited",
          generationCount: 0,
          maxGenerations: null,
          tier,
        },
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { mealPlanGenerations: { $lt: policy.limit } },
          { mealPlanGenerations: { $exists: false } },
        ],
      },
      { $inc: { mealPlanGenerations: 1 } },
      { returnDocument: "after", runValidators: true },
    ).select("mealPlanGenerations");

    if (user) {
      return res.json({
        success: true,
        data: {
          generationCount: user.mealPlanGenerations,
          maxGenerations: policy.limit,
        },
      });
    }

    const existing = await User.findById(id)
      .select("mealPlanGenerations")
      .lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    return res.status(403).json({
      success: false,
      message: "Đã hết lượt gợi ý miễn phí",
      data: {
        generationCount: existing.mealPlanGenerations || 0,
        maxGenerations: policy.limit,
      },
    });
  } catch (err) {
    safeLog.error("mealplan.generation_record_failed", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

export default router;
