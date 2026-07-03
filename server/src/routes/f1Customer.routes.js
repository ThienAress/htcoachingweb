import express from "express";
import { protect, requireRoles, requireTrainerAccess } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  approveAiReport,
  createAssessment,
  createF1Customer,
  createF1Media,
  deleteF1Customer,
  deleteF1Media,
  generateAiReport,
  generateOutcomeForecast,
  getF1CustomerById,
  getF1Customers,
  getF1DashboardSummary,
  getF1Media,
  getLatestAiReport,
  getAssessmentStarterSuggestions,
  getLatestAssessment,
  getLatestIntake,
  getLatestOutcomeForecast,
  saveIntakeDraft,
  submitIntake,
  updateAssessment,
  updateF1Customer,
  updateF1CustomerStatus,
  reviewTestPermission,
  generateResultPrediction,
  getLatestResultPrediction,
  generateResultPredictionStageImages,
} from "../controllers/f1Customer/index.js";
import {
  validateApproveAiReport,
  validateCreateAssessment,
  validateCreateF1Customer,
  validateCreateF1Media,
  validateDeleteF1Media,
  validateF1CustomerId,
  validateGenerateAiReport,
  validateGenerateOutcomeForecast,
  validateSaveIntakeDraft,
  validateSubmitIntake,
  validateUpdateAssessment,
  validateUpdateF1Customer,
  validateUpdateF1Status,
  validateReviewTestPermission,
  validateGenerateResultPrediction,
  validateGenerateResultPredictionStageImages,
} from "../middlewares/validation.js";

import { uploadF1Media } from "../middlewares/f1MediaUpload.js";

const router = express.Router();

// =========================
// DASHBOARD / CUSTOMER
// =========================
router.get(
  "/dashboard/summary",
  protect,
  requireTrainerAccess,
  getF1DashboardSummary,
);

router.post(
  "/",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateCreateF1Customer,
  createF1Customer,
);

router.get("/", protect, requireTrainerAccess, getF1Customers);

router.get(
  "/:id",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getF1CustomerById,
);

router.patch(
  "/:id",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateUpdateF1Customer,
  updateF1Customer,
);

router.patch(
  "/:id/status",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateUpdateF1Status,
  updateF1CustomerStatus,
);

router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateF1CustomerId,
  deleteF1Customer,
);

// =========================
// INTAKE
// =========================
router.get(
  "/:id/intake/latest",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getLatestIntake,
);

router.post(
  "/:id/intake/draft",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateSaveIntakeDraft,
  saveIntakeDraft,
);

router.post(
  "/:id/intake/submit",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateSubmitIntake,
  submitIntake,
);

router.patch(
  "/:id/test-permission-review",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateReviewTestPermission,
  reviewTestPermission,
);

// =========================
// MEDIA
// =========================
router.post(
  "/:id/media",
  protect,
  csrfProtection,
  requireTrainerAccess,
  uploadF1Media.single("file"),
  validateCreateF1Media,
  createF1Media,
);

router.get(
  "/:id/media",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getF1Media,
);

router.delete(
  "/:id/media/:mediaId",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateDeleteF1Media,
  deleteF1Media,
);

// =========================
// PHYSICAL ASSESSMENT
// =========================
router.post(
  "/:id/assessments",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateCreateAssessment,
  createAssessment,
);

router.get(
  "/:id/assessments/latest",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getLatestAssessment,
);

router.patch(
  "/:id/assessments/:assessmentId",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateUpdateAssessment,
  updateAssessment,
);

router.get(
  "/:id/assessment-starter-suggestions",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getAssessmentStarterSuggestions,
);

// =========================
// AI REPORT
// =========================
router.post(
  "/:id/ai-reports/generate",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateGenerateAiReport,
  generateAiReport,
);

router.get(
  "/:id/ai-reports/latest",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getLatestAiReport,
);

router.patch(
  "/:id/ai-reports/:reportId/approve",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateApproveAiReport,
  approveAiReport,
);

// =========================
// OUTCOME FORECAST
// =========================
router.post(
  "/:id/forecasts/generate",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateGenerateOutcomeForecast,
  generateOutcomeForecast,
);

router.get(
  "/:id/forecasts/latest",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getLatestOutcomeForecast,
);

// =========================
// RESULT PREDICTION
// =========================
router.post(
  "/:id/result-predictions/generate",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateGenerateResultPrediction,
  generateResultPrediction,
);

router.get(
  "/:id/result-predictions/latest",
  protect,
  requireTrainerAccess,
  validateF1CustomerId,
  getLatestResultPrediction,
);

router.post(
  "/:id/result-predictions/:predictionId/visual-stages/:phaseKey/generate-images",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateGenerateResultPredictionStageImages,
  generateResultPredictionStageImages,
);

export default router;

