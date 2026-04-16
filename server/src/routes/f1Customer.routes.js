import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
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
  requireRoles("admin", "trainer"),
  getF1DashboardSummary,
);

router.post(
  "/",
  protect,
  requireRoles("admin", "trainer"),
  validateCreateF1Customer,
  createF1Customer,
);

router.get("/", protect, requireRoles("admin", "trainer"), getF1Customers);

router.get(
  "/:id",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getF1CustomerById,
);

router.patch(
  "/:id",
  protect,
  requireRoles("admin", "trainer"),
  validateUpdateF1Customer,
  updateF1Customer,
);

router.patch(
  "/:id/status",
  protect,
  requireRoles("admin", "trainer"),
  validateUpdateF1Status,
  updateF1CustomerStatus,
);

router.delete(
  "/:id",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  deleteF1Customer,
);

// =========================
// INTAKE
// =========================
router.get(
  "/:id/intake/latest",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getLatestIntake,
);

router.post(
  "/:id/intake/draft",
  protect,
  requireRoles("admin", "trainer"),
  validateSaveIntakeDraft,
  saveIntakeDraft,
);

router.post(
  "/:id/intake/submit",
  protect,
  requireRoles("admin", "trainer"),
  validateSubmitIntake,
  submitIntake,
);

router.patch(
  "/:id/test-permission-review",
  protect,
  requireRoles("admin", "trainer"),
  validateReviewTestPermission,
  reviewTestPermission,
);

// =========================
// MEDIA
// =========================
router.post(
  "/:id/media",
  protect,
  requireRoles("admin", "trainer"),
  uploadF1Media.single("file"),
  validateCreateF1Media,
  createF1Media,
);

router.get(
  "/:id/media",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getF1Media,
);

router.delete(
  "/:id/media/:mediaId",
  protect,
  requireRoles("admin", "trainer"),
  validateDeleteF1Media,
  deleteF1Media,
);

// =========================
// PHYSICAL ASSESSMENT
// =========================
router.post(
  "/:id/assessments",
  protect,
  requireRoles("admin", "trainer"),
  validateCreateAssessment,
  createAssessment,
);

router.get(
  "/:id/assessments/latest",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getLatestAssessment,
);

router.patch(
  "/:id/assessments/:assessmentId",
  protect,
  requireRoles("admin", "trainer"),
  validateUpdateAssessment,
  updateAssessment,
);

router.get(
  "/:id/assessment-starter-suggestions",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getAssessmentStarterSuggestions,
);

// =========================
// AI REPORT
// =========================
router.post(
  "/:id/ai-reports/generate",
  protect,
  requireRoles("admin", "trainer"),
  validateGenerateAiReport,
  generateAiReport,
);

router.get(
  "/:id/ai-reports/latest",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getLatestAiReport,
);

router.patch(
  "/:id/ai-reports/:reportId/approve",
  protect,
  requireRoles("admin", "trainer"),
  validateApproveAiReport,
  approveAiReport,
);

// =========================
// OUTCOME FORECAST
// =========================
router.post(
  "/:id/forecasts/generate",
  protect,
  requireRoles("admin", "trainer"),
  validateGenerateOutcomeForecast,
  generateOutcomeForecast,
);

router.get(
  "/:id/forecasts/latest",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getLatestOutcomeForecast,
);

// =========================
// RESULT PREDICTION
// =========================
router.post(
  "/:id/result-predictions/generate",
  protect,
  requireRoles("admin", "trainer"),
  validateGenerateResultPrediction,
  generateResultPrediction,
);

router.get(
  "/:id/result-predictions/latest",
  protect,
  requireRoles("admin", "trainer"),
  validateF1CustomerId,
  getLatestResultPrediction,
);

router.post(
  "/:id/result-predictions/:predictionId/visual-stages/:phaseKey/generate-images",
  protect,
  requireRoles("admin", "trainer"),
  validateGenerateResultPredictionStageImages,
  generateResultPredictionStageImages,
);

export default router;
