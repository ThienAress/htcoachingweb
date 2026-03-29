import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
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
  requireRoles("admin"),
  validateCreateOrder,
  createOrder,
);

// 🔥 ADMIN
router.get("/", protect, requireRoles("admin", "trainer"), getOrders);
router.put(
  "/:id/approve",
  protect,
  requireRoles("admin"),
  validateId,
  approveOrder,
);
router.put(
  "/:id",
  protect,
  requireRoles("admin"),
  validateUpdateOrder,
  updateOrder,
);
router.delete("/:id", protect, requireRoles("admin"), validateId, deleteOrder);

export default router;
