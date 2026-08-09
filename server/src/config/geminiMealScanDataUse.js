const enabled = (value) => String(value || "").trim().toLowerCase() === "true";

export const resolveGeminiMealScanDataUseMode = (env = process.env) => {
  const paidConfirmed = enabled(env.GEMINI_PAID_SERVICE_CONFIRMED);
  const unpaidAccepted = enabled(
    env.GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED,
  );

  if (paidConfirmed && unpaidAccepted) return "ambiguous";
  if (paidConfirmed) return "paid";
  if (unpaidAccepted) return "unpaid";
  return null;
};

export const isGeminiMealScanDataUseApproved = (env = process.env) =>
  ["paid", "unpaid"].includes(resolveGeminiMealScanDataUseMode(env));
