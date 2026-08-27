import express from "express";
import {
  correctMyJournal,
  deleteMyJournalData,
  exportMyJournalData,
  getMyJournal,
  getMyJournalRevisions,
  getMyJournalTimeline,
  getTrainerClientJournal,
  saveMyJournal,
  submitMyJournal,
  submitMyJournalNutrition,
} from "../controllers/dailyJournal.controller.js";
import {
  protect,
  requireTrainerAccess,
} from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { dailyJournalMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateCorrectDailyJournal,
  validateDailyJournalDate,
  validateDailyJournalExport,
  validateDailyJournalPagination,
  validateDeleteDailyJournalData,
  validateSaveDailyJournal,
  validateSubmitDailyJournal,
  validateSubmitDailyJournalNutrition,
  validateTrainerDailyJournalRead,
} from "../middlewares/validation.js";

const router = express.Router();

router.use(protect);
router.get(
  "/privacy/export",
  validateDailyJournalExport,
  exportMyJournalData,
);
router.delete(
  "/privacy",
  dailyJournalMutationLimiter,
  csrfProtection,
  validateDeleteDailyJournalData,
  deleteMyJournalData,
);
router.get(
  "/trainer/clients/:clientId/:dateKey",
  requireTrainerAccess,
  validateTrainerDailyJournalRead,
  getTrainerClientJournal,
);
router.get(
  "/:dateKey/revisions",
  validateDailyJournalPagination,
  getMyJournalRevisions,
);
router.get(
  "/:dateKey/timeline",
  validateDailyJournalDate,
  getMyJournalTimeline,
);
router.get("/:dateKey", validateDailyJournalDate, getMyJournal);
router.put(
  "/:dateKey",
  dailyJournalMutationLimiter,
  csrfProtection,
  validateSaveDailyJournal,
  saveMyJournal,
);
router.post(
  "/:dateKey/nutrition/submit",
  dailyJournalMutationLimiter,
  csrfProtection,
  validateSubmitDailyJournalNutrition,
  submitMyJournalNutrition,
);
router.post(
  "/:dateKey/submit",
  dailyJournalMutationLimiter,
  csrfProtection,
  validateSubmitDailyJournal,
  submitMyJournal,
);
router.post(
  "/:dateKey/corrections",
  dailyJournalMutationLimiter,
  csrfProtection,
  validateCorrectDailyJournal,
  correctMyJournal,
);

export default router;
