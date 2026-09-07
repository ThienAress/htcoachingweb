import { incrementMetric } from "./metrics.js";

const GEMINI_SURFACES = new Set([
  "chat",
  "meal_scan",
  "search_grounding",
  "embedding",
  "kb_suggestion",
]);
const positiveInteger = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

export const recordGeminiRequest = (surface) => {
  if (!GEMINI_SURFACES.has(surface)) throw new Error("Unknown Gemini surface");
  incrementMetric(`provider.gemini_${surface}_requests`);
};

export const recordGeminiResult = (surface, { success, usage = {} } = {}) => {
  if (!GEMINI_SURFACES.has(surface)) throw new Error("Unknown Gemini surface");
  incrementMetric(
    `provider.gemini_${surface}_${success ? "succeeded" : "failed"}`,
  );
  const values = {
    prompt_tokens: positiveInteger(
      usage.promptTokens ?? usage.promptTokenCount,
    ),
    output_tokens: positiveInteger(
      usage.outputTokens ?? usage.candidatesTokenCount,
    ),
    total_tokens: positiveInteger(usage.totalTokens ?? usage.totalTokenCount),
  };
  for (const [unit, amount] of Object.entries(values)) {
    if (amount > 0) incrementMetric(`provider.gemini_${surface}_${unit}`, amount);
  }
};

export const recordResendUsage = (outcome) => {
  if (!new Set(["attempts", "sent", "failed", "disabled"]).has(outcome)) {
    throw new Error("Unknown Resend usage outcome");
  }
  incrementMetric(`provider.resend_${outcome}`);
};

export const recordCloudinaryUsage = ({ operation, success, bytes = 0 }) => {
  if (!new Set(["upload", "delete"]).has(operation)) {
    throw new Error("Unknown Cloudinary operation");
  }
  if (operation === "upload") {
    incrementMetric(
      success
        ? "provider.cloudinary_uploads"
        : "provider.cloudinary_upload_failures",
    );
    const byteCount = positiveInteger(bytes);
    if (success && byteCount > 0) {
      incrementMetric("provider.cloudinary_upload_bytes", byteCount);
    }
    return;
  }
  incrementMetric(
    success
      ? "provider.cloudinary_deletes"
      : "provider.cloudinary_delete_failures",
  );
};

export const recordSePayApiUsage = ({ success, transactions = 0 }) => {
  incrementMetric("provider.sepay_api_requests");
  if (!success) {
    incrementMetric("provider.sepay_api_failures");
    return;
  }
  incrementMetric("provider.sepay_api_pages");
  const count = positiveInteger(transactions);
  if (count > 0) incrementMetric("provider.sepay_transactions_received", count);
};

export const recordNetlifyBuildUsage = (outcome) => {
  if (
    !new Set(["scheduled", "coalesced", "triggered", "failed", "skipped"]).has(
      outcome,
    )
  ) {
    throw new Error("Unknown Netlify build outcome");
  }
  incrementMetric(`provider.netlify_build_${outcome}`);
};
