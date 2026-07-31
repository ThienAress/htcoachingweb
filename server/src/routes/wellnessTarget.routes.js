import express from "express";
import {
  deleteMyWellnessTargets,
  exportMyWellnessTargets,
  readCoachClientWellnessTarget,
  readMyWellnessTarget,
  updateCoachClientWellnessTarget,
} from "../controllers/wellnessTarget.controller.js";
import {
  protect,
  requireTrainerAccess,
} from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  wellnessTargetMutationLimiter,
} from "../middlewares/rateLimit.js";
import {
  validateDeleteWellnessTargets,
  validateWellnessTargetClient,
  validateWellnessTargetExport,
  validateWellnessTargetOwnRead,
  validateWellnessTargetWrite,
} from "../middlewares/validation.js";

const router = express.Router();
router.use(protect);
router.get("/me", validateWellnessTargetOwnRead, readMyWellnessTarget);
router.get(
  "/privacy/export",
  validateWellnessTargetExport,
  exportMyWellnessTargets,
);
router.delete(
  "/privacy",
  wellnessTargetMutationLimiter,
  csrfProtection,
  validateDeleteWellnessTargets,
  deleteMyWellnessTargets,
);
router.get(
  "/trainer/clients/:clientId",
  requireTrainerAccess,
  validateWellnessTargetClient,
  readCoachClientWellnessTarget,
);
router.put(
  "/trainer/clients/:clientId",
  requireTrainerAccess,
  wellnessTargetMutationLimiter,
  csrfProtection,
  validateWellnessTargetWrite,
  updateCoachClientWellnessTarget,
);

export default router;
