import express from "express";
import { getTodayDashboardDay } from "../controllers/todayDashboard.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { todayDashboardReadLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.get("/day/:dateKey", protect, todayDashboardReadLimiter, getTodayDashboardDay);

export default router;
