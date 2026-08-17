import express from "express";

import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { financialCommandLimiter } from "../middlewares/rateLimit.js";
import { validateFitnessPlusPlanPurchase } from "../middlewares/validation.js";
import {
  getFitnessPlusCatalog,
  getMyFitnessPlusSubscription,
  purchaseFitnessPlusPlan,
} from "../controllers/fitnessPlusSubscription.controller.js";

const router = express.Router();

router.get("/catalog", getFitnessPlusCatalog);
router.post(
  "/purchase",
  protect,
  financialCommandLimiter,
  csrfProtection,
  validateFitnessPlusPlanPurchase,
  purchaseFitnessPlusPlan,
);
router.get("/my", protect, getMyFitnessPlusSubscription);

export default router;
