import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { financialCommandLimiter } from "../middlewares/rateLimit.js";
import {
  validateFitnessPlusPlanPurchase,
  validateFitnessPlusPurchaseQuote,
} from "../middlewares/validation.js";
import {
  getFitnessPlusCatalog,
  getFitnessPlusPurchaseQuoteHandler,
  getMyFitnessPlusSubscription,
  purchaseFitnessPlusPlan,
} from "../controllers/fitnessPlusSubscription.controller.js";

const router = express.Router();

router.get("/catalog", getFitnessPlusCatalog);
// Mua gói là tạo một đăng ký: POST vào tập hợp.
router.post(
  "/",
  protect,
  financialCommandLimiter,
  csrfProtection,
  validateFitnessPlusPlanPurchase,
  purchaseFitnessPlusPlan,
);
router.get("/me", protect, getMyFitnessPlusSubscription);
// Báo giá nâng cấp (đã trừ phần gói tháng chưa dùng): chỉ đọc, không ghi dữ liệu.
router.get("/quotes", protect, validateFitnessPlusPurchaseQuote, getFitnessPlusPurchaseQuoteHandler);

export default router;
