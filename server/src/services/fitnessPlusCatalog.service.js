import crypto from "crypto";

import {
  FITNESS_PLUS_BILLING_CYCLES,
  FITNESS_PLUS_CATALOG_CURRENCY,
  FITNESS_PLUS_CATALOG_PROTOCOL_VERSION,
  FITNESS_PLUS_PLAN_DEFINITIONS,
} from "../constants/fitnessPlusPlans.js";
import { getServiceAccessPolicy } from "../constants/serviceAccessPolicies.js";

const planByCode = new Map(
  FITNESS_PLUS_PLAN_DEFINITIONS.map((plan) => [plan.code, plan]),
);
const planByTitle = new Map(
  FITNESS_PLUS_PLAN_DEFINITIONS.flatMap((plan) => [
    [plan.title.toLocaleLowerCase("vi"), plan.code],
    [plan.titleEn.toLocaleLowerCase("en"), plan.code],
  ]),
);

const cloneQuotaPolicy = (policy) => ({
  ...policy,
  windows: (policy.windows || []).map((window) => ({ ...window })),
});

const getPlanQuotas = (planCode, resolvePolicy = getServiceAccessPolicy) => ({
  aiChat: cloneQuotaPolicy(resolvePolicy("ai_chat", planCode)),
  mealScan: cloneQuotaPolicy(resolvePolicy("meal_scan", planCode)),
});

const clonePlan = (plan, resolvePolicy = getServiceAccessPolicy) => ({
  ...plan,
  prices: { ...plan.prices },
  billingCycles: [...plan.billingCycles],
  entitlements: { ...plan.entitlements },
  features: [...plan.features],
  quotas: getPlanQuotas(plan.code, resolvePolicy),
});

const canonicalizePlans = (plans, resolvePolicy) =>
  [...plans]
    .map((plan) => ({
      code: plan.code,
      title: plan.title,
      titleEn: plan.titleEn,
      subtitle: plan.subtitle,
      subtitleEn: plan.subtitleEn,
      prices: Object.fromEntries(
        Object.entries(plan.prices).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      billingCycles: [...plan.billingCycles].sort(),
      durationDays: plan.durationDays,
      featured: Boolean(plan.featured),
      entitlements: Object.fromEntries(
        Object.entries(plan.entitlements).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
      features: [...plan.features].sort(),
      quotas: getPlanQuotas(plan.code, resolvePolicy),
    }))
    .sort((left, right) => left.code.localeCompare(right.code));

export const createFitnessPlusCatalogFingerprint = (
  plans = FITNESS_PLUS_PLAN_DEFINITIONS,
  resolvePolicy = getServiceAccessPolicy,
) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        currency: FITNESS_PLUS_CATALOG_CURRENCY,
        protocolVersion: FITNESS_PLUS_CATALOG_PROTOCOL_VERSION,
        plans: canonicalizePlans(plans, resolvePolicy),
      }),
    )
    .digest("hex");

const catalogFingerprint = createFitnessPlusCatalogFingerprint();

export const getFitnessPlusCatalogMeta = () => ({
  currency: FITNESS_PLUS_CATALOG_CURRENCY,
  catalogFingerprint,
  protocolVersion: FITNESS_PLUS_CATALOG_PROTOCOL_VERSION,
});

export const resolveFitnessPlusPlanCode = (value) => {
  const normalized = String(value || "").trim().toLocaleLowerCase("vi");
  if (!normalized) return null;
  if (planByCode.has(normalized)) return normalized;
  return planByTitle.get(normalized) || null;
};

export const getFitnessPlusPlan = (value) => {
  const planCode = resolveFitnessPlusPlanCode(value);
  const plan = planCode ? planByCode.get(planCode) : null;
  return plan ? clonePlan(plan) : null;
};

export const listFitnessPlusPlans = () =>
  FITNESS_PLUS_PLAN_DEFINITIONS.map((plan) => clonePlan(plan));

export const getFitnessPlusPlanAmount = (planValue, billingCycle) => {
  const plan = getFitnessPlusPlan(planValue);
  if (!plan || !FITNESS_PLUS_BILLING_CYCLES.includes(billingCycle)) {
    return null;
  }
  return plan.prices[billingCycle];
};

const addCalendarMonthsClamped = (value, months) => {
  const result = new Date(value);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
};

export const calculateFitnessPlusPlanEndDate = (
  planValue,
  billingCycle,
  startDate = new Date(),
) => {
  const plan = getFitnessPlusPlan(planValue);
  if (!plan || !FITNESS_PLUS_BILLING_CYCLES.includes(billingCycle)) {
    return null;
  }
  return addCalendarMonthsClamped(
    startDate,
    billingCycle === "year" ? 12 : 1,
  );
};
