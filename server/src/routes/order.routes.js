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
  approveOrder,
  updateOrder,
  deleteOrder,
} from "../controllers/order.controller.js";

const router = express.Router();

// 🔥 Admin tạo đơn
router.post(
  "/",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateCreateOrder,
  createOrder,
);

// 🔥 ADMIN
router.get("/", protect, requireTrainerAccess, getOrders);
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
  requireRoles("admin"),
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
