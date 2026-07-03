import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import Order from "../models/Order.js";
import User from "../models/User.js";

const router = express.Router();

const MAX_FREE_GENERATIONS = 1;

// ===== CHECK QUYỀN TRUY CẬP =====
router.get("/check", protect, async (req, res) => {
  try {
    const { id, role } = req.user;

    // 1. Admin & Trainer luôn có quyền
    if (role === "admin" || role === "trainer") {
      return res.json({ success: true, data: { access: "unlimited", generationCount: 0, maxGenerations: MAX_FREE_GENERATIONS } });
    }

    const currentUser = await User.findById(id);

    // 2. Check TrainerSubscription (đã mua gói HLV)
    const activeSub = await TrainerSubscription.findOne({
      userId: id,
      status: "active",
      endDate: { $gt: new Date() },
    });
    if (activeSub) {
      return res.json({ success: true, data: { access: "unlimited", generationCount: 0, maxGenerations: MAX_FREE_GENERATIONS } });
    }

    // 3. Check Order (gói tập thông thường)
    const activeOrder = await Order.findOne({
      userId: id,
      status: "approved"
    });
    if (activeOrder) {
      return res.json({ success: true, data: { access: "unlimited", generationCount: 0, maxGenerations: MAX_FREE_GENERATIONS } });
    }

    // 4. User thường (kể cả F1 Customer) → trial với giới hạn lượt
    const generationCount = currentUser?.mealPlanGenerations || 0;
    return res.json({
      success: true,
      data: {
        access: "trial",
        generationCount,
        maxGenerations: MAX_FREE_GENERATIONS,
      }
    });
  } catch (err) {
    console.error("Check MealPlan access error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// ===== GHI NHẬN 1 LƯỢT GENERATE =====
router.post("/record", protect, csrfProtection, async (req, res) => {
  try {
    const { id } = req.user;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }

    const currentCount = user.mealPlanGenerations || 0;

    // Nếu đã hết lượt → từ chối
    if (currentCount >= MAX_FREE_GENERATIONS) {
      return res.status(403).json({
        success: false,
        message: "Đã hết lượt gợi ý miễn phí",
        data: { generationCount: currentCount, maxGenerations: MAX_FREE_GENERATIONS }
      });
    }

    user.mealPlanGenerations = currentCount + 1;
    await user.save();

    return res.json({
      success: true,
      data: {
        generationCount: user.mealPlanGenerations,
        maxGenerations: MAX_FREE_GENERATIONS,
      }
    });
  } catch (err) {
    console.error("Record MealPlan generation error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

export default router;
