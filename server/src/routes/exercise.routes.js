import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import {
  getExercises,
  getExerciseById,
  createExercise,
  createManyExercises,
  updateExercise,
  deleteExercise,
} from "../controllers/exercise.controller.js";
import { validateId } from "../middlewares/validation.js";

const router = express.Router();

// Public routes (ai cũng xem được)
router.get("/", getExercises);
router.get("/:id", validateId, getExerciseById);

// Admin only
router.post("/", protect, requireRoles("admin"), createExercise);
router.post("/batch", protect, requireRoles("admin"), createManyExercises);
router.put("/:id", protect, requireRoles("admin"), validateId, updateExercise);
router.delete(
  "/:id",
  protect,
  requireRoles("admin"),
  validateId,
  deleteExercise,
);

export default router;
