import express from "express";
import {
  createTrainer,
  deleteTrainer,
  getAdminTrainerById,
  getAdminTrainers,
  getTrainerBySlug,
  getTrainers,
  updateTrainer,
  updateTrainerStatus,
  uploadTrainerImageFile,
  uploadTrainerVideoFile,
} from "../controllers/trainer.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { validateId } from "../middlewares/validation.js";
import { uploadTrainerImage } from "../middlewares/trainerUpload.js";
import { uploadTrainerVideo } from "../middlewares/trainerVideoUpload.js";

const router = express.Router();

router.get("/admin", protect, requireRoles("admin"), getAdminTrainers);
router.get(
  "/admin/:id",
  protect,
  requireRoles("admin"),
  validateId,
  getAdminTrainerById,
);
router.post(
  "/admin",
  protect,
  csrfProtection,
  requireRoles("admin"),
  createTrainer,
);
router.post(
  "/admin/upload",
  protect,
  csrfProtection,
  requireRoles("admin"),
  uploadTrainerImage.single("file"),
  uploadTrainerImageFile,
);
router.post(
  "/admin/upload-video",
  protect,
  csrfProtection,
  requireRoles("admin"),
  uploadTrainerVideo.single("file"),
  uploadTrainerVideoFile,
);
router.patch(
  "/admin/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  updateTrainer,
);
router.patch(
  "/admin/:id/status",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  updateTrainerStatus,
);
router.delete(
  "/admin/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteTrainer,
);

router.get("/", getTrainers);
router.get("/:slug", getTrainerBySlug);

export default router;
