import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { financialCommandLimiter } from "../middlewares/rateLimit.js";

import {
  getAllDeposits,
  approveDeposit,
  rejectDeposit,
  reverseDeposit,
  deleteDeposit,
} from "../controllers/adminDeposit.controller.js";

const router = express.Router();

// 📋 Danh sách yêu cầu nạp tiền (filter theo status)
router.get("/", protect, requireRoles("admin"), getAllDeposits);

// ✅ Duyệt nạp tiền
router.post("/:id/approve", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), approveDeposit);

// ❌ Từ chối nạp tiền
router.post("/:id/reject", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), rejectDeposit);

// Hoàn tác deposit đã duyệt bằng ledger entry đối ứng
router.post("/:id/reverse", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), reverseDeposit);

// 🗑️ Xóa yêu cầu nạp tiền
router.delete("/:id", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), deleteDeposit);

export default router;
