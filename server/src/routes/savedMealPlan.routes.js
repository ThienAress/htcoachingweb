import express from "express";
import {
  archiveMySavedMealPlan,
  createMySavedMealPlan,
  deleteMySavedMealPlans,
  exportMySavedMealPlans,
  getMySavedMealPlan,
  listMySavedMealPlans,
  renameMySavedMealPlan,
  reviseMySavedMealPlan,
} from "../controllers/savedMealPlan.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  savedMealPlanMutationLimiter,
} from "../middlewares/rateLimit.js";
import {
  validateArchiveSavedMealPlan,
  validateCreateSavedMealPlan,
  validateDeleteSavedMealPlans,
  validateRenameSavedMealPlan,
  validateReviseSavedMealPlan,
  validateSavedMealPlanExport,
  validateSavedMealPlanId,
  validateSavedMealPlanList,
} from "../middlewares/validation.js";

const router = express.Router();

router.use(protect);
router.get(
  "/privacy/export",
  validateSavedMealPlanExport,
  exportMySavedMealPlans,
);
router.delete(
  "/privacy",
  savedMealPlanMutationLimiter,
  csrfProtection,
  validateDeleteSavedMealPlans,
  deleteMySavedMealPlans,
);
router.get("/", validateSavedMealPlanList, listMySavedMealPlans);
router.post(
  "/",
  savedMealPlanMutationLimiter,
  csrfProtection,
  validateCreateSavedMealPlan,
  createMySavedMealPlan,
);
router.get("/:id", validateSavedMealPlanId, getMySavedMealPlan);
router.patch(
  "/:id/title",
  savedMealPlanMutationLimiter,
  csrfProtection,
  validateRenameSavedMealPlan,
  renameMySavedMealPlan,
);
router.post(
  "/:id/revisions",
  savedMealPlanMutationLimiter,
  csrfProtection,
  validateReviseSavedMealPlan,
  reviseMySavedMealPlan,
);
router.post(
  "/:id/archive",
  savedMealPlanMutationLimiter,
  csrfProtection,
  validateArchiveSavedMealPlan,
  archiveMySavedMealPlan,
);

export default router;
