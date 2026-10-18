import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { deprecatedRoute } from "../middlewares/deprecatedRoute.js";
import {
  checkMealPlanAccess,
  recordMealPlanGeneration,
} from "../controllers/mealPlanAccess.controller.js";

// Bí danh cho /api/mealplan-access/* (tên cũ); gỡ khi api.deprecated_route_hits về 0.
const router = express.Router();

router.get("/check", protect, deprecatedRoute("/api/meal-plan-access"), checkMealPlanAccess);
router.post("/record", protect, csrfProtection, deprecatedRoute("/api/meal-plan-access/usages"), recordMealPlanGeneration);

export default router;
