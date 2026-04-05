import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { exerciseSuggestionLimiter } from "../middlewares/rateLimit.js";
import {
  createSuggestion,
  getSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
} from "../controllers/exerciseSuggestion.controller.js";

const router = express.Router();

// Public route (có thể có user)
router.post("/", exerciseSuggestionLimiter, optionalAuth, createSuggestion);

// Admin routes
router.get("/", protect, requireRoles("admin"), getSuggestions);
router.patch(
  "/:id/status",
  protect,
  requireRoles("admin"),
  updateSuggestionStatus,
);
router.delete("/:id", protect, requireRoles("admin"), deleteSuggestion);

export default router;
