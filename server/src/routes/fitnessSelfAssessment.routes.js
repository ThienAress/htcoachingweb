import express from "express";
import {
  listMySelfAssessments,
  readMySelfAssessment,
  saveMySelfAssessmentDraft,
  submitMySelfAssessment,
} from "../controllers/fitnessSelfAssessment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { fitnessSelfAssessmentMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateSelfAssessmentDraftBody,
  validateSelfAssessmentHistory,
  validateSelfAssessmentId,
} from "../middlewares/validation.js";

// Chỉ chủ tài khoản đọc/ghi dữ liệu của mình; không có route cho HLV hoặc admin.
const router = express.Router();
router.use(protect);

router.get("/me", readMySelfAssessment);
router.get("/", validateSelfAssessmentHistory, listMySelfAssessments);
router.put(
  "/me/draft",
  fitnessSelfAssessmentMutationLimiter,
  csrfProtection,
  validateSelfAssessmentDraftBody,
  saveMySelfAssessmentDraft,
);
router.post(
  "/:id/submit",
  fitnessSelfAssessmentMutationLimiter,
  csrfProtection,
  validateSelfAssessmentId,
  submitMySelfAssessment,
);

export default router;
