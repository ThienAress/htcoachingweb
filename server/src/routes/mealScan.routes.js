import express from "express";

import { analyzeMealScan } from "../controllers/mealScan.controller.js";
import { optionalMealScanAuth } from "../middlewares/optionalMealScanAuth.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  mealScanAnonymousLimiter,
  mealScanLimiter,
} from "../middlewares/aiRateLimit.js";
import { validateMealScanImage } from "../middlewares/mealScanImage.js";

const router = express.Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

router.post(
  "/analyze",
  optionalMealScanAuth,
  csrfProtection,
  validateMealScanImage,
  mealScanAnonymousLimiter,
  mealScanLimiter,
  analyzeMealScan,
);

export default router;
