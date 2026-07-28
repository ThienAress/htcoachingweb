const SUPPORTED_PROTOCOL_VERSION = 1;
const REQUIRED_PLAN_CYCLES = Object.freeze({
  free: Object.freeze(["trial"]),
  standard: Object.freeze(["month", "year"]),
  professional: Object.freeze(["month", "year"]),
  premium: Object.freeze(["month", "year"]),
});

const hasValidPlanShape = (plan, requiredCycles) => {
  if (
    !plan ||
    typeof plan.title !== "string" ||
    !plan.title.trim() ||
    !Number.isSafeInteger(plan.maxClients) ||
    plan.maxClients <= 0 ||
    !plan.prices ||
    typeof plan.prices !== "object" ||
    !Array.isArray(plan.billingCycles) ||
    !plan.entitlements ||
    typeof plan.entitlements.f1CrmAi !== "boolean"
  ) {
    return false;
  }

  const receivedCycles = [...plan.billingCycles].sort();
  const expectedCycles = [...requiredCycles].sort();
  if (
    receivedCycles.length !== expectedCycles.length ||
    receivedCycles.some((cycle, index) => cycle !== expectedCycles[index])
  ) {
    return false;
  }

  const priceCycles = Object.keys(plan.prices).sort();
  const hasExactPrices =
    priceCycles.length === expectedCycles.length &&
    priceCycles.every((cycle, index) => cycle === expectedCycles[index]) &&
    receivedCycles.every(
      (cycle) =>
        Number.isSafeInteger(plan.prices[cycle]) && plan.prices[cycle] >= 0,
    );
  const hasValidDuration =
    plan.code === "free"
      ? Number.isSafeInteger(plan.durationDays) && plan.durationDays > 0
      : plan.durationDays === null;
  return hasExactPrices && hasValidDuration;
};

const CYCLE_LABELS = {
  month: "theo tháng",
  year: "theo năm",
};

const getCycleLabel = (plan, cycle) =>
  cycle === "trial"
    ? `${plan.durationDays} ngày`
    : CYCLE_LABELS[cycle] || cycle;

export const normalizeTrainerPlanCatalogResponse = (response) => {
  const plans = response?.data?.data;
  const meta = response?.data?.meta;
  if (
    !Array.isArray(plans) ||
    !meta ||
    meta.currency !== "VND" ||
    !/^[a-f0-9]{64}$/.test(String(meta.catalogFingerprint || "")) ||
    meta.protocolVersion !== SUPPORTED_PROTOCOL_VERSION
  ) {
    throw new Error("Trainer plan catalog response is invalid");
  }

  const planCodes = plans.map((plan) => plan?.code);
  const requiredCodes = Object.keys(REQUIRED_PLAN_CYCLES);
  const hasExactPlanSet =
    plans.length === requiredCodes.length &&
    new Set(planCodes).size === requiredCodes.length &&
    requiredCodes.every((code) => planCodes.includes(code)) &&
    plans.every((plan) =>
      hasValidPlanShape(plan, REQUIRED_PLAN_CYCLES[plan.code]),
    );
  if (!hasExactPlanSet) {
    throw new Error("Trainer plan catalog response is incomplete");
  }

  const byCode = Object.fromEntries(plans.map((plan) => [plan.code, plan]));
  return { plans, byCode, meta };
};

export const createTrainerPlanPurchasePayload = ({
  catalog,
  planCode,
  billingCycle,
  requestId,
}) => {
  const plan = catalog?.byCode?.[planCode];
  const expectedAmount = plan?.prices?.[billingCycle];
  if (!plan || !Number.isSafeInteger(expectedAmount)) {
    throw new Error("Trainer plan selection is not in the active catalog");
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

export const buildTrainerPlanOffers = (catalog) =>
  (catalog?.plans || []).flatMap((plan) =>
    plan.billingCycles.map((cycle) => ({
      "@type": "Offer",
      name: `${plan.title} - ${getCycleLabel(plan, cycle)}`,
      description:
        cycle === "trial"
          ? `Dùng thử một lần, tối đa ${plan.maxClients} khách hàng`
          : undefined,
      price: plan.prices[cycle],
      priceCurrency: catalog.meta.currency,
    })),
  );
