import express from "express";
import {
  getTodayDashboardDay,
  getTodayDashboardPromptEligibility,
} from "../controllers/todayDashboard.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { todayDashboardReadLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.get(
  "/prompt-eligibility",
  protect,
  todayDashboardReadLimiter,
  getTodayDashboardPromptEligibility,
);
router.get("/day/:dateKey", protect, todayDashboardReadLimiter, getTodayDashboardDay);

export default router;
