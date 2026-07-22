import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { financialCommandLimiter } from "../middlewares/rateLimit.js";

import {
  createDeposit,
  getDepositById,
  getMyDeposits,
  getMyWallet,
  confirmDeposit,
} from "../controllers/deposit.controller.js";

const router = express.Router();

// 💰 User tạo yêu cầu nạp tiền (sinh QR)
router.post("/", protect, financialCommandLimiter, csrfProtection, createDeposit);

// 📋 User xem lịch sử nạp tiền
router.get("/", protect, getMyDeposits);

// 🔍 User xem chi tiết 1 yêu cầu nạp
router.get("/:id", protect, getDepositById);

// ✅ User xác nhận đã thanh toán
router.post("/:id/confirm", protect, financialCommandLimiter, csrfProtection, confirmDeposit);

// 👛 User xem số dư ví (mount ở server.js: /api/me/wallet)
// -> Được export riêng để mount ở path khác
export { getMyWallet };

export default router;
