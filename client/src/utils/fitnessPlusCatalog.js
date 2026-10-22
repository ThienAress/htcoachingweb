const SUPPORTED_PROTOCOL_VERSION = 1;
const REQUIRED_PLAN_CODES = [
  "fitness_plus_essential",
  "fitness_plus_smart",
  "fitness_plus_max",
];

const hasQuotaWindows = (policy, requiredKeys) => {
  if (!Array.isArray(policy?.windows)) return false;
  const byKey = new Map(policy.windows.map((window) => [window?.key, window]));
  return (
    byKey.size === requiredKeys.length &&
    requiredKeys.every((key) => {
      const window = byKey.get(key);
      return Number.isSafeInteger(window?.limit) && window.limit > 0;
    })
  );
};

const hasValidPlanShape = (plan) => {
  if (
    !plan ||
    typeof plan.code !== "string" ||
    !REQUIRED_PLAN_CODES.includes(plan.code) ||
    typeof plan.title !== "string" ||
    typeof plan.titleEn !== "string" ||
    typeof plan.subtitle !== "string" ||
    typeof plan.subtitleEn !== "string" ||
    !plan.prices ||
    !Array.isArray(plan.billingCycles) ||
    !Array.isArray(plan.features) ||
    !plan.quotas?.aiCredits
  ) {
    return false;
  }
  return (
    [plan.title, plan.titleEn, plan.subtitle, plan.subtitleEn].every(
      (value) => value.trim().length > 0,
    ) &&
    plan.billingCycles.length === 2 &&
    plan.billingCycles.every((cycle) => ["month", "year"].includes(cycle)) &&
    ["month", "year"].every(
      (cycle) => Number.isSafeInteger(plan.prices[cycle]) && plan.prices[cycle] >= 0,
    ) &&
    Number.isSafeInteger(plan.quotas.aiCredits.limit) &&
    hasQuotaWindows(plan.quotas.aiCredits, ["burst", "monthly"]) &&
    plan.features.every((feature) => typeof feature === "string")
  );
};

export const normalizeFitnessPlusCatalogResponse = (response) => {
  const plans = response?.data?.data;
  const meta = response?.data?.meta;
  if (
    !Array.isArray(plans) ||
    !meta ||
    meta.currency !== "VND" ||
    !/^[a-f0-9]{64}$/.test(String(meta.catalogFingerprint || "")) ||
    meta.protocolVersion !== SUPPORTED_PROTOCOL_VERSION
  ) {
    throw new Error("HT Fitness+ catalog response is invalid");
  }

  const planCodes = plans.map((plan) => plan?.code);
  if (
    plans.length !== REQUIRED_PLAN_CODES.length ||
    new Set(planCodes).size !== REQUIRED_PLAN_CODES.length ||
    REQUIRED_PLAN_CODES.some((code) => !planCodes.includes(code)) ||
    plans.some((plan) => !hasValidPlanShape(plan))
  ) {
    throw new Error("HT Fitness+ catalog response is incomplete");
  }

  return {
    plans,
    byCode: Object.fromEntries(plans.map((plan) => [plan.code, plan])),
    meta,
  };
};

export const createFitnessPlusPurchasePayload = ({
  catalog,
  planCode,
  billingCycle,
  requestId,
  quotedAmount,
}) => {
  const plan = catalog?.byCode?.[planCode];
  // quotedAmount: số tiền server đã báo (có thể đã trừ phần gói tháng chưa dùng); mặc định là giá niêm yết.
  const expectedAmount = quotedAmount ?? plan?.prices?.[billingCycle];
  if (!plan || !Number.isSafeInteger(expectedAmount)) {
    throw new Error("HT Fitness+ plan selection is not in the active catalog");
  }
  return {
    planCode,
    billingCycle,
    requestId,
    expectedAmount,
    catalogFingerprint: catalog.meta.catalogFingerprint,
    protocolVersion: catalog.meta.protocolVersion,
  };
};
