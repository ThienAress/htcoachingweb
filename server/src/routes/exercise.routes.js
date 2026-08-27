import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { exerciseReviewMutationLimiter } from "../middlewares/rateLimit.js";
import { uploadExerciseVideo as uploadExerciseVideoFile } from "../middlewares/exerciseVideoUpload.js";
import {
  getExercises,
  getExerciseById,
  createExercise,
  createManyExercises,
  updateExercise,
  deleteExercise,
} from "../controllers/exercise.controller.js";
import {
  deleteExerciseVideo,
  uploadExerciseVideo,
} from "../controllers/exerciseVideo.controller.js";
import {
  getReviews,
  removeReview,
  upsertReview,
} from "../controllers/exerciseReview.controller.js";
import { importExerciseInstructions } from "../controllers/exerciseInstructionsImport.controller.js";
import { uploadExerciseInstructionsJson } from "../middlewares/exerciseInstructionsJsonUpload.js";
import {
  validateExerciseBatchWrite,
  validateExerciseList,
  validateExerciseWrite,
  validateExerciseReview,
  validateExerciseReviewId,
  validateId,
} from "../middlewares/validation.js";

const router = express.Router();

// Public routes (ai cũng xem được)
router.get("/", validateExerciseList, getExercises);
router.get(
  "/:exerciseId/reviews",
  optionalAuth,
  validateExerciseReviewId,
  getReviews,
);
router.put(
  "/:exerciseId/reviews",
  protect,
  csrfProtection,
  exerciseReviewMutationLimiter,
  validateExerciseReview,
  upsertReview,
);
router.delete(
  "/:exerciseId/reviews",
  protect,
  csrfProtection,
  exerciseReviewMutationLimiter,
  validateExerciseReviewId,
  removeReview,
);
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
router.post(
  "/instructions/import",
  protect,
  csrfProtection,
  requireRoles("admin"),
  uploadExerciseInstructionsJson,
  importExerciseInstructions,
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
router.post(
  "/:id/video",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  uploadExerciseVideoFile,
  uploadExerciseVideo,
);
router.delete(
  "/:id/video",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteExerciseVideo,
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
