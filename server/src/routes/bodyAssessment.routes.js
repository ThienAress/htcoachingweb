import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTrainerActor } from "../middlewares/trainerAccess.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { weeklyCheckinMutationLimiter } from "../middlewares/rateLimit.js";
import { validateBodyAssessmentList, validateBodyAssessmentRead, validateBodyAssessmentSave, validateBodyAssessmentPublish, validateBodyAssessmentDelete } from "../middlewares/validation.js";
import { deleteMyBodyAssessments, exportMyBodyAssessments, listMyBodyAssessments, listTrainerBodyAssessments, publishTrainerBodyAssessment, readTrainerBodyAssessment, saveTrainerBodyAssessment } from "../controllers/bodyAssessment.controller.js";

const router = express.Router();
router.use(protect);
router.get("/privacy/export", validateBodyAssessmentList, exportMyBodyAssessments);
router.delete("/privacy", weeklyCheckinMutationLimiter, csrfProtection, validateBodyAssessmentDelete, deleteMyBodyAssessments);
router.get("/trainer/clients/:clientId", requireTrainerActor, validateBodyAssessmentList, listTrainerBodyAssessments);
router.get("/trainer/clients/:clientId/:weekStartDateKey", requireTrainerActor, validateBodyAssessmentRead, readTrainerBodyAssessment);
router.put("/trainer/clients/:clientId/:weekStartDateKey", requireTrainerActor, weeklyCheckinMutationLimiter, csrfProtection, validateBodyAssessmentSave, saveTrainerBodyAssessment);
router.post("/trainer/clients/:clientId/:weekStartDateKey/publish", requireTrainerActor, weeklyCheckinMutationLimiter, csrfProtection, validateBodyAssessmentPublish, publishTrainerBodyAssessment);
router.get("/", validateBodyAssessmentList, listMyBodyAssessments);
export default router;
