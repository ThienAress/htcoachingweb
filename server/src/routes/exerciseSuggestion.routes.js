import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { exerciseSuggestionLimiter } from "../middlewares/rateLimit.js";
import {
  validateCreateExerciseSuggestion,
  validateExerciseSuggestionId,
  validateExerciseSuggestionList,
  validateExerciseSuggestionUpdate,
} from "../middlewares/validation.js";
import {
  createSuggestion,
  getSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
} from "../controllers/exerciseSuggestion.controller.js";

const router = express.Router();

// Public route (có thể có user)
router.post(
  "/",
  exerciseSuggestionLimiter,
  csrfProtection,
  validateCreateExerciseSuggestion,
  optionalAuth,
  createSuggestion,
);

// Admin routes
router.get(
  "/",
  protect,
  requireRoles("admin"),
  validateExerciseSuggestionList,
  getSuggestions,
);
router.patch(
  "/:id/status",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateExerciseSuggestionUpdate,
  updateSuggestionStatus,
);
router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateExerciseSuggestionId,
  deleteSuggestion,
);

export default router;
