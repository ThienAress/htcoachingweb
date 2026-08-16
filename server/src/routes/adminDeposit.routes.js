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
import {
  approveIncomingBankTransaction,
  getIncomingBankTransactions,
  ignoreIncomingBankTransaction,
  reverseIncomingBankTransaction,
} from "../controllers/adminIncomingBankTransaction.controller.js";

const router = express.Router();

// 📋 Danh sách yêu cầu nạp tiền (filter theo status)
router.get("/", protect, requireRoles("admin"), getAllDeposits);

router.get(
  "/incoming",
  protect,
  requireRoles("admin"),
  getIncomingBankTransactions,
);

router.post(
  "/incoming/:id/approve",
  protect,
  financialCommandLimiter,
  csrfProtection,
  requireRoles("admin"),
  approveIncomingBankTransaction,
);
router.post(
  "/incoming/:id/ignore",
  protect,
  financialCommandLimiter,
  csrfProtection,
  requireRoles("admin"),
  ignoreIncomingBankTransaction,
);
router.post(
  "/incoming/:id/reverse",
  protect,
  financialCommandLimiter,
  csrfProtection,
  requireRoles("admin"),
  reverseIncomingBankTransaction,
);

// ✅ Duyệt nạp tiền
router.post("/:id/approve", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), approveDeposit);

// ❌ Từ chối nạp tiền
router.post("/:id/reject", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), rejectDeposit);

// Hoàn tác deposit đã duyệt bằng ledger entry đối ứng
router.post("/:id/reverse", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), reverseDeposit);

// 🗑️ Xóa yêu cầu nạp tiền
router.delete("/:id", protect, financialCommandLimiter, csrfProtection, requireRoles("admin"), deleteDeposit);

export default router;
