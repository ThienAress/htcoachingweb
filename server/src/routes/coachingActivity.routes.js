import express from "express";
import {
  exportMyCoachingActivity,
  listMyCoachingActivity,
} from "../controllers/coachingActivity.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { progressReadLimiter } from "../middlewares/rateLimit.js";
import {
  validateCoachingActivityExport,
  validateCoachingActivityRead,
} from "../middlewares/validation.js";

const router = express.Router();
router.use(protect, progressReadLimiter);
router.get(
  "/export",
  validateCoachingActivityExport,
  exportMyCoachingActivity,
);
router.get("/", validateCoachingActivityRead, listMyCoachingActivity);

export default router;
