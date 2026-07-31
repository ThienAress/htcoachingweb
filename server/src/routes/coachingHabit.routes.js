import express from "express";
import {
  changeMyHabitStatus,
  createMyHabit,
  createTrainerClientHabit,
  deleteMyHabits,
  exportMyHabits,
  listMyHabits,
  listTrainerHabits,
  updateHabitDefinition,
} from "../controllers/coachingHabit.controller.js";
import { protect, requireTrainerAccess } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { coachingHabitMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateCoachingHabitCreate,
  validateCoachingHabitExport,
  validateCoachingHabitList,
  validateCoachingHabitStatus,
  validateCoachingHabitUpdate,
  validateDeleteCoachingHabits,
  validateTrainerCoachingHabitCreate,
  validateTrainerCoachingHabitList,
} from "../middlewares/validation.js";

const router = express.Router();
router.use(protect);
router.get("/privacy/export", validateCoachingHabitExport, exportMyHabits);
router.delete(
  "/privacy",
  coachingHabitMutationLimiter,
  csrfProtection,
  validateDeleteCoachingHabits,
  deleteMyHabits,
);
router.get("/my", validateCoachingHabitList, listMyHabits);
router.post(
  "/trainer/clients/:clientId",
  requireTrainerAccess,
  coachingHabitMutationLimiter,
  csrfProtection,
  validateTrainerCoachingHabitCreate,
  createTrainerClientHabit,
);
router.get(
  "/trainer/clients/:clientId",
  requireTrainerAccess,
  validateTrainerCoachingHabitList,
  listTrainerHabits,
);
router.post(
  "/",
  coachingHabitMutationLimiter,
  csrfProtection,
  validateCoachingHabitCreate,
  createMyHabit,
);
router.put(
  "/:id",
  coachingHabitMutationLimiter,
  csrfProtection,
  validateCoachingHabitUpdate,
  updateHabitDefinition,
);
router.post(
  "/:id/status",
  coachingHabitMutationLimiter,
  csrfProtection,
  validateCoachingHabitStatus,
  changeMyHabitStatus,
);

export default router;
