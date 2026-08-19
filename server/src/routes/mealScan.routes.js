import express from "express";

import { analyzeMealScan } from "../controllers/mealScan.controller.js";
import { optionalMealScanAuth } from "../middlewares/optionalMealScanAuth.js";
import { ensureMealScanActor } from "../middlewares/mealScanGuestSession.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  mealScanAnonymousLimiter,
  mealScanLimiter,
} from "../middlewares/aiRateLimit.js";
import { resolveServiceAccessTierMiddleware } from "../middlewares/resolveServiceAccessTier.js";
import { validateMealScanImage } from "../middlewares/mealScanImage.js";
import { enforceSharedServiceUsage } from "../middlewares/serviceUsageLedger.js";

const router = express.Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

router.post(
  "/analyze",
  optionalMealScanAuth,
  ensureMealScanActor,
  csrfProtection,
  validateMealScanImage,
  resolveServiceAccessTierMiddleware,
  mealScanAnonymousLimiter,
  mealScanLimiter,
  enforceSharedServiceUsage("meal_scan"),
  analyzeMealScan,
);

export default router;
