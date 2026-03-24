import express from "express";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

import {
  createOrder,
  getOrders,
  approveOrder,
  updateOrder,
  deleteOrder,
} from "../controllers/order.controller.js";

const router = express.Router();

// 🔥 Admin tạo đơn
router.post("/", protect, requireAdmin, createOrder);

// 🔥 ADMIN
router.get("/", protect, requireAdmin, getOrders);
router.put("/:id/approve", protect, requireAdmin, approveOrder);
router.put("/:id", protect, requireAdmin, updateOrder);
router.delete("/:id", protect, requireAdmin, deleteOrder);

export default router;
