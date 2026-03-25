import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";

import {
  createOrder,
  getOrders,
  approveOrder,
  updateOrder,
  deleteOrder,
} from "../controllers/order.controller.js";

const router = express.Router();

// 🔥 Admin tạo đơn
router.post("/", protect, requireRoles("admin"), createOrder);

// 🔥 ADMIN
router.get("/", protect, requireRoles("admin", "trainer"), getOrders);
router.put("/:id/approve", protect, requireRoles("admin"), approveOrder);
router.put("/:id", protect, requireRoles("admin"), updateOrder);
router.delete("/:id", protect, requireRoles("admin"), deleteOrder);

export default router;
