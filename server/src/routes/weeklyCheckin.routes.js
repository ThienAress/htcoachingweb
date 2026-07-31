import express from "express";
import {
  correctMyWeeklyCheckin,
  deleteMyWeeklyCheckins,
  exportMyWeeklyCheckins,
  getMyCheckin,
  getMyCheckinRevisions,
  getTrainerClientCheckin,
  reviewTrainerClientCheckin,
  saveMyWeeklyCheckin,
  submitMyWeeklyCheckin,
} from "../controllers/weeklyCheckin.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTrainerActor } from "../middlewares/trainerAccess.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { weeklyCheckinMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateDeleteWeeklyCheckins,
  validateWeeklyCheckinCorrection,
  validateWeeklyCheckinExport,
  validateWeeklyCheckinRead,
  validateWeeklyCheckinReview,
  validateWeeklyCheckinRevisionList,
  validateSaveWeeklyCheckin,
  validateSubmitWeeklyCheckin,
} from "../middlewares/validation.js";

const router = express.Router();
router.use(protect);
router.get(
  "/privacy/export",
  validateWeeklyCheckinExport,
  exportMyWeeklyCheckins,
);
router.delete(
  "/privacy",
  weeklyCheckinMutationLimiter,
  csrfProtection,
  validateDeleteWeeklyCheckins,
  deleteMyWeeklyCheckins,
);
router.get(
  "/trainer/clients/:clientId/:weekStartDateKey",
  requireTrainerActor,
  validateWeeklyCheckinRead,
  getTrainerClientCheckin,
);
router.post(
  "/trainer/clients/:clientId/:weekStartDateKey/review",
  requireTrainerActor,
  weeklyCheckinMutationLimiter,
  csrfProtection,
  validateWeeklyCheckinReview,
  reviewTrainerClientCheckin,
);
router.get(
  "/:weekStartDateKey/revisions",
  validateWeeklyCheckinRevisionList,
  getMyCheckinRevisions,
);
router.get("/:weekStartDateKey", validateWeeklyCheckinRead, getMyCheckin);
router.put(
  "/:weekStartDateKey",
  weeklyCheckinMutationLimiter,
  csrfProtection,
  validateSaveWeeklyCheckin,
  saveMyWeeklyCheckin,
);
router.post(
  "/:weekStartDateKey/submit",
  weeklyCheckinMutationLimiter,
  csrfProtection,
  validateSubmitWeeklyCheckin,
  submitMyWeeklyCheckin,
);
router.post(
  "/:weekStartDateKey/corrections",
  weeklyCheckinMutationLimiter,
  csrfProtection,
  validateWeeklyCheckinCorrection,
  correctMyWeeklyCheckin,
);

export default router;
