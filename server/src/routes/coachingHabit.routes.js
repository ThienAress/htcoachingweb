import express from "express";
import {
  changeMyHabitStatus,
  createMyHabit,
  createTrainerClientHabit,
  deleteMyHabits,
  exportMyHabits,
  listMyHabits,
  listTrainerHabits,
} from "../controllers/coachingHabit.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTrainerActor } from "../middlewares/trainerAccess.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { coachingHabitMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateCoachingHabitCreate,
  validateCoachingHabitExport,
  validateCoachingHabitList,
  validateCoachingHabitStatus,
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
  requireTrainerActor,
  coachingHabitMutationLimiter,
  csrfProtection,
  validateTrainerCoachingHabitCreate,
  createTrainerClientHabit,
);
router.get(
  "/trainer/clients/:clientId",
  requireTrainerActor,
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
router.post(
  "/:id/status",
  coachingHabitMutationLimiter,
  csrfProtection,
  validateCoachingHabitStatus,
  changeMyHabitStatus,
);

export default router;
