import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import F1Customer from "../models/F1Customer.js";

const router = express.Router();

router.get("/check", protect, async (req, res) => {
  try {
    const { id, role } = req.user;

    // 1. Admin & Trainer luôn có quyền
    if (role === "admin" || role === "trainer") {
      return res.json({ success: true, data: { access: "unlimited" } });
    }

    // Lấy thông tin user hiện tại để check F1Customer nếu cần
    const currentUser = await User.findById(id);

    // 2. Check TrainerSubscription (đã mua gói HLV)
    const activeSub = await TrainerSubscription.findOne({
      userId: id,
      status: "active",
      endDate: { $gt: new Date() },
    });
    if (activeSub) {
      return res.json({ success: true, data: { access: "unlimited" } });
    }

    // 3. Check Order (gói tập thông thường)
    const activeOrder = await Order.findOne({
      userId: id,
      status: "approved"
    });
    if (activeOrder) {
      return res.json({ success: true, data: { access: "unlimited" } });
    }

    // 4. Check F1Customer (khách hàng F1)
    if (currentUser && currentUser.email) {
      const f1Customer = await F1Customer.findOne({ email: currentUser.email });
      if (f1Customer) {
        return res.json({ success: true, data: { access: "unlimited" } });
      }
    }

    // 5. Nếu không thuộc đối tượng nào, cho trial 24h
    return res.json({ success: true, data: { access: "trial" } });
  } catch (err) {
    console.error("Check MealPlan access error:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

export default router;
