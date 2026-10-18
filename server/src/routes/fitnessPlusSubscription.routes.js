import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { deprecatedRoute } from "../middlewares/deprecatedRoute.js";
import { financialCommandLimiter } from "../middlewares/rateLimit.js";
import { validateFitnessPlusPlanPurchase } from "../middlewares/validation.js";
import {
  getFitnessPlusCatalog,
  getMyFitnessPlusSubscription,
  purchaseFitnessPlusPlan,
} from "../controllers/fitnessPlusSubscription.controller.js";

const router = express.Router();

router.get("/catalog", getFitnessPlusCatalog);
// Mua gói là tạo một đăng ký: POST vào tập hợp. /purchase cũ giữ làm bí danh; gỡ khi api.deprecated_route_hits về 0.
// financialCommandLimiter là một instance dùng chung nên đường cũ và mới chia sẻ hạn mức.
router.post(
  "/",
  protect,
  financialCommandLimiter,
  csrfProtection,
  validateFitnessPlusPlanPurchase,
  purchaseFitnessPlusPlan,
);
router.post(
  "/purchase",
  protect,
  financialCommandLimiter,
  csrfProtection,
  deprecatedRoute("/api/fitness-plus-subscriptions"),
  validateFitnessPlusPlanPurchase,
  purchaseFitnessPlusPlan,
);
router.get("/my", protect, getMyFitnessPlusSubscription);

export default router;
