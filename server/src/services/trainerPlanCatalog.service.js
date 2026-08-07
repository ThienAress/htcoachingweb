import crypto from "crypto";

import {
  TRAINER_CATALOG_CURRENCY,
  TRAINER_CATALOG_PROTOCOL_VERSION,
  TRAINER_PLAN_BENEFIT_DEFINITIONS,
  TRAINER_PLAN_DEFINITIONS,
} from "../constants/trainerPlans.js";

const planByCode = new Map(
  TRAINER_PLAN_DEFINITIONS.map((plan) => [plan.code, plan]),
);
const codeByTitle = new Map(
  TRAINER_PLAN_DEFINITIONS.map((plan) => [
    plan.title.toLocaleLowerCase("vi"),
    plan.code,
  ]),
);

const clonePlan = (plan) => ({
  ...plan,
  prices: { ...plan.prices },
  billingCycles: [...plan.billingCycles],
  entitlements: { ...plan.entitlements },
});

const cloneBenefit = (benefit) => ({
  ...benefit,
  category: { ...benefit.category },
  includedPlanCodes: [...benefit.includedPlanCodes],
});

const canonicalizePlans = (plans) =>
  [...plans]
    .map((plan) => ({
      code: plan.code,
      title: plan.title,
      prices: Object.fromEntries(
        Object.entries(plan.prices).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      billingCycles: [...plan.billingCycles].sort(),
      durationDays: plan.durationDays,
      maxClients: plan.maxClients,
      entitlements: Object.fromEntries(
        Object.entries(plan.entitlements).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    }))
    .sort((left, right) => left.code.localeCompare(right.code));

const canonicalizeBenefits = (benefits) =>
  [...benefits]
    .map((benefit) => ({
      key: benefit.key,
      label: benefit.label,
      category: {
        key: benefit.category.key,
        label: benefit.category.label,
      },
      valueType: benefit.valueType,
      includedPlanCodes: [...benefit.includedPlanCodes].sort(),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));

export const createTrainerCatalogFingerprint = (
  plans = TRAINER_PLAN_DEFINITIONS,
  benefits = TRAINER_PLAN_BENEFIT_DEFINITIONS,
) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        currency: TRAINER_CATALOG_CURRENCY,
        protocolVersion: TRAINER_CATALOG_PROTOCOL_VERSION,
        plans: canonicalizePlans(plans),
        benefits: canonicalizeBenefits(benefits),
      }),
    )
    .digest("hex");

const catalogFingerprint = createTrainerCatalogFingerprint();

export const getTrainerPlanCatalogMeta = () => ({
  currency: TRAINER_CATALOG_CURRENCY,
  catalogFingerprint,
  protocolVersion: TRAINER_CATALOG_PROTOCOL_VERSION,
});

export const resolveTrainerPlanCode = (value) => {
  const normalized = String(value || "").trim().toLocaleLowerCase("vi");
  if (!normalized) return null;
  if (planByCode.has(normalized)) return normalized;
  return codeByTitle.get(normalized) || null;
};

export const getTrainerPlan = (value) => {
  const code = resolveTrainerPlanCode(value);
  const plan = code ? planByCode.get(code) : null;
  return plan ? clonePlan(plan) : null;
};

export const listTrainerPlans = () => TRAINER_PLAN_DEFINITIONS.map(clonePlan);

export const listTrainerPlanBenefits = () =>
  TRAINER_PLAN_BENEFIT_DEFINITIONS.map(cloneBenefit);

export const getTrainerPlanAmount = (planValue, billingCycle) => {
  const plan = getTrainerPlan(planValue);
  if (!plan || !plan.billingCycles.includes(billingCycle)) return null;
  return plan.prices[billingCycle];
};

export const getMaxClientsByPlan = (planValue) =>
  getTrainerPlan(planValue)?.maxClients || 0;

const addCalendarMonthsClamped = (value, months) => {
  const result = new Date(value);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
};

export const calculateTrainerPlanEndDate = (
  planValue,
  billingCycle,
  startDate = new Date(),
) => {
  const plan = getTrainerPlan(planValue);
  if (!plan || !plan.billingCycles.includes(billingCycle)) return null;

  const endDate = new Date(startDate);
  if (billingCycle === "trial") {
    endDate.setUTCDate(endDate.getUTCDate() + plan.durationDays);
    return endDate;
  } else if (billingCycle === "month") {
    return addCalendarMonthsClamped(endDate, 1);
  }
  return addCalendarMonthsClamped(endDate, 12);
};
