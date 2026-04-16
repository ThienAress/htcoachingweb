import api from "../utils/api";

// =========================
// HELPER
// =========================
const unwrap = (promise) => promise.then((res) => res.data);

// =========================
// CUSTOMER
// =========================
export const getF1DashboardSummary = () =>
  unwrap(api.get("/f1-customers/dashboard/summary"));

export const getF1Customers = () => unwrap(api.get("/f1-customers"));

export const getF1CustomerById = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}`));

export const createF1Customer = (payload) =>
  unwrap(api.post("/f1-customers", payload));

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

export const createF1Media = (customerId, payload) =>
  unwrap(api.post(`/f1-customers/${customerId}/media`, payload));

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

export const generateAiReport = (customerId) =>
  unwrap(api.post(`/f1-customers/${customerId}/ai-reports/generate`));

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

export const generateOutcomeForecast = (customerId) =>
  unwrap(api.post(`/f1-customers/${customerId}/forecasts/generate`));

// =========================
// RESULT PREDICTION
// =========================
export const getLatestResultPrediction = (customerId) =>
  unwrap(api.get(`/f1-customers/${customerId}/result-predictions/latest`));

export const generateResultPrediction = (customerId) =>
  unwrap(api.post(`/f1-customers/${customerId}/result-predictions/generate`));

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
