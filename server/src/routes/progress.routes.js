import express from "express";
import {
  getMyProgress,
  getTrainerProgress,
} from "../controllers/progress.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTrainerActor } from "../middlewares/trainerAccess.middleware.js";
import { progressReadLimiter } from "../middlewares/rateLimit.js";
import {
  validateProgressRead,
  validateTrainerProgressRead,
} from "../middlewares/validation.js";

const router = express.Router();
router.use(protect, progressReadLimiter);
router.get(
  "/trainer/clients/:clientId",
  requireTrainerActor,
  validateTrainerProgressRead,
  getTrainerProgress,
);
router.get("/", validateProgressRead, getMyProgress);

export default router;
