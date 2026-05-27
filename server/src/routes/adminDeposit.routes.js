import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";

import {
  getAllDeposits,
  approveDeposit,
  rejectDeposit,
  deleteDeposit,
} from "../controllers/adminDeposit.controller.js";

const router = express.Router();

// 📋 Danh sách yêu cầu nạp tiền (filter theo status)
router.get("/", protect, requireRoles("admin"), getAllDeposits);

// ✅ Duyệt nạp tiền
router.post("/:id/approve", protect, csrfProtection, requireRoles("admin"), approveDeposit);

// ❌ Từ chối nạp tiền
router.post("/:id/reject", protect, csrfProtection, requireRoles("admin"), rejectDeposit);

// 🗑️ Xóa yêu cầu nạp tiền
router.delete("/:id", protect, csrfProtection, requireRoles("admin"), deleteDeposit);

export default router;
