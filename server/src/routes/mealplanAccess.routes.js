import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  checkMealPlanAccess,
  recordMealPlanGeneration,
} from "../controllers/mealPlanAccess.controller.js";

const router = express.Router();

// Đường mới (mount /api/meal-plan-access). Đường cũ /api/mealplan-access/{check,record} ở mealplanAccessLegacy.routes.js.
router.get("/", protect, checkMealPlanAccess);
router.post("/usages", protect, csrfProtection, recordMealPlanGeneration);

export default router;
