import api from "../utils/api";
import {
  buildConversionOriginFields,
  pickDefinedFields,
} from "../utils/conversionOrigin";

// =========================
// HELPER
// =========================
const unwrap = (promise) => promise.then((res) => res.data);

// =========================
// CUSTOMER
// =========================
export const getF1DashboardSummary = () =>
  unwrap(api.get("/f1-customers/dashboard/summary"));

export const getF1Customers = (params = {}) =>
  unwrap(api.get("/f1-customers", { params }));

export const getF1CustomerById = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}`));

export const createF1Customer = (payload) => {
  const data = {
    ...pickDefinedFields(payload, [
      "fullName",
      "age",
      "gender",
      "occupation",
      "phone",
      "email",
      "assignedTrainerId",
      "source",
      "notesInternal",
    ]),
    ...buildConversionOriginFields(payload),
  };
  return unwrap(api.post("/f1-customers", data));
};

export const updateF1Customer = (customerId, payload) =>
  unwrap(api.patch(`/f1-customers/${customerId}`, payload));

export const updateF1CustomerStatus = (customerId, status) =>
  unwrap(
    api.patch(`/f1-customers/${customerId}/status`, {
      status,
    }),
  );

export const deleteF1Customer = (customerId) =>
  unwrap(api.delete(`/f1-customers/${customerId}`));

// =========================
// INTAKE
// =========================
export const getLatestIntake = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/intake/latest`));

export const saveIntakeDraft = (customerId, payload) =>
  unwrap(api.post(`/f1-customers/${customerId}/intake/draft`, payload));

export const submitIntake = (customerId, payload) =>
  unwrap(api.post(`/f1-customers/${customerId}/intake/submit`, payload));

export const reviewTestPermission = (customerId, payload) =>
  unwrap(
    api.patch(`/f1-customers/${customerId}/test-permission-review`, payload),
  );

// =========================
// MEDIA
// =========================
export const getF1Media = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/media`));

export const createF1Media = (customerId, payload, options = {}) =>
  unwrap(
    api.post(`/f1-customers/${customerId}/media`, payload, {
      signal: options.signal,
      onUploadProgress: options.onUploadProgress,
    }),
  );

export const deleteF1Media = (customerId, mediaId) =>
  unwrap(api.delete(`/f1-customers/${customerId}/media/${mediaId}`));

// =========================
// PHYSICAL ASSESSMENT
// =========================
export const getLatestAssessment = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/assessments/latest`));

export const createAssessment = (customerId, payload) =>
  unwrap(api.post(`/f1-customers/${customerId}/assessments`, payload));

export const updateAssessment = (customerId, assessmentId, payload) =>
  unwrap(
    api.patch(
      `/f1-customers/${customerId}/assessments/${assessmentId}`,
      payload,
    ),
  );

export const getAssessmentStarterSuggestions = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/assessment-starter-suggestions`));

// =========================
// AI REPORT
// =========================
export const getLatestAiReport = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/ai-reports/latest`));

export const generateAiReport = (customerId, payload) =>
  unwrap(
    api.post(`/f1-customers/${customerId}/ai-reports/generate`, payload),
  );

export const approveAiReport = (customerId, reportId, payload) =>
  unwrap(
    api.patch(
      `/f1-customers/${customerId}/ai-reports/${reportId}/approve`,
      payload,
    ),
  );

// =========================
// FORECAST
// =========================
export const getLatestOutcomeForecast = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/forecasts/latest`));

export const generateOutcomeForecast = (customerId, payload) =>
  unwrap(
    api.post(`/f1-customers/${customerId}/forecasts/generate`, payload),
  );

// =========================
// RESULT PREDICTION
// =========================
// Đổi cách dựng giai đoạn (hệ thống đề xuất hoặc HLV tự thiết kế): chỉ một lần cho mỗi khách.
export const switchPlanMode = (customerId, mode) =>
  unwrap(api.post(`/f1-customers/${customerId}/result-predictions/switch-mode`, { mode }));

export const getLatestResultPrediction = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/result-predictions/latest`));

export const generateResultPrediction = (customerId, payload) =>
  unwrap(
    api.post(
      `/f1-customers/${customerId}/result-predictions/generate`,
      payload,
    ),
  );

// Xem trước giai đoạn 1 do HLV thiết kế (gợi ý và bảng dự đoán của hệ thống, không lưu).
export const previewStageDesign = (customerId, customStage) =>
  unwrap(api.post(`/f1-customers/${customerId}/result-predictions/preview`, { customStage }));

// =========================
// PHASE REVIEW (đánh giá cuối giai đoạn)
// =========================
export const previewNextStageDesign = (customerId, stageOrder, customStage) =>
  unwrap(
    api.post(`/f1-customers/${customerId}/phase-reviews/${stageOrder}/design-preview`, { customStage }),
  );

export const saveNextStageDesign = (customerId, stageOrder, customStage) =>
  unwrap(api.put(`/f1-customers/${customerId}/phase-reviews/${stageOrder}/design`, { customStage }));

export const deleteLatestStage = (customerId, stageOrder) =>
  unwrap(api.delete(`/f1-customers/${customerId}/phase-reviews/${stageOrder}`));

export const getPhaseReviews = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/phase-reviews`));

export const savePhaseReview = (customerId, stageOrder, payload) =>
  unwrap(
    api.put(`/f1-customers/${customerId}/phase-reviews/${stageOrder}`, payload),
  );

export const saveStageProfile = (customerId, stageOrder, payload) =>
  unwrap(api.put(`/f1-customers/${customerId}/phase-reviews/${stageOrder}/profile`, payload));

// Ảnh của giai đoạn 2 trở đi (tải ảnh hiện tại và tạo ảnh dự đoán).
export const uploadStagePhoto = (customerId, stageOrder, form) =>
  unwrap(api.post(`/f1-customers/${customerId}/phase-reviews/${stageOrder}/photos`, form));

export const generateStageVisual = (customerId, stageOrder, payload) =>
  unwrap(
    api.post(`/f1-customers/${customerId}/phase-reviews/${stageOrder}/generate-images`, payload),
  );

export const generateResultPredictionStageImages = (
  customerId,
  predictionId,
  phaseKey,
  payload = {},
) =>
  unwrap(
    api.post(
      `/f1-customers/${customerId}/result-predictions/${predictionId}/visual-stages/${phaseKey}/generate-images`,
      payload,
    ),
  );
