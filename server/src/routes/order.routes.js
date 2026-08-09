import express from "express";
import { protect, requireRoles, requireTrainerAccess } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  validateCreateOrder,
  validateUpdateOrder,
  validateId,
} from "../middlewares/validation.js";

import {
  createOrder,
  getOrders,
  getCheckinOrderOptions,
  approveOrder,
  updateOrder,
  deleteOrder,
} from "../controllers/order.controller.js";

const router = express.Router();

// Admin hoặc trainer actor tạo đơn; controller tự gắn owner cho trainer.
router.post(
  "/",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateCreateOrder,
  createOrder,
);

// 🔥 ADMIN
router.get("/", protect, requireTrainerAccess, getOrders);
router.get(
  "/checkin-options",
  protect,
  requireTrainerAccess,
  getCheckinOrderOptions,
);
router.put(
  "/:id/approve",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  approveOrder,
);
router.put(
  "/:id",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateUpdateOrder,
  updateOrder,
);
router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteOrder,
);

export default router;
