import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  getExercises,
  getExerciseById,
  createExercise,
  createManyExercises,
  updateExercise,
  deleteExercise,
} from "../controllers/exercise.controller.js";
import {
  validateExerciseBatchWrite,
  validateExerciseList,
  validateExerciseWrite,
  validateId,
} from "../middlewares/validation.js";

const router = express.Router();

// Public routes (ai cũng xem được)
router.get("/", validateExerciseList, getExercises);
router.get("/:id", validateId, getExerciseById);

// Admin only
router.post(
  "/",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateExerciseWrite,
  createExercise,
);
router.post(
  "/batch",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateExerciseBatchWrite,
  createManyExercises,
);
router.put(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  validateExerciseWrite,
  updateExercise,
);
router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteExercise,
);

export default router;
