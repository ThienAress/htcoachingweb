import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";

import {
  purchaseTrainerPlan,
  getMySubscription,
  getAllSubscribers,
  cancelSubscription,
} from "../controllers/trainerSubscription.controller.js";

const router = express.Router();

// 💰 Mua gói HLV (thanh toán bằng ví)
router.post("/purchase", protect, csrfProtection, purchaseTrainerPlan);

// 📋 Xem gói hiện tại của user
router.get("/my", protect, getMySubscription);

// 👑 Admin: Lấy tất cả HLV có gói active
router.get("/all", protect, requireRoles("admin"), getAllSubscribers);

router.post(
  "/:id/cancel",
  protect,
  csrfProtection,
  requireRoles("admin"),
  cancelSubscription,
);

export default router;
