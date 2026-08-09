import {
  SERVICE_ACCESS_POLICY_REGISTRY,
  SERVICE_ACCESS_POLICY_VERSION,
  SERVICE_ACCESS_TIERS,
  getServiceAccessPolicy,
} from "../constants/serviceAccessPolicies.js";
import {
  COMMUNITY_FEATURE_CATALOG,
  COMMUNITY_FEATURE_CATALOG_VERSION,
} from "../constants/communityFeatureCatalog.js";
import Order from "../models/Order.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import {
  listTrainerPlanBenefits,
  listTrainerPlans,
} from "./trainerPlanCatalog.service.js";

export const resolveServiceAccessTier = async (
  actor,
  {
    now = new Date(),
    orderModel = Order,
    trainerSubscriptionModel = TrainerSubscription,
  } = {},
) => {
  if (!actor) return SERVICE_ACCESS_TIERS.GUEST;

  const userId = actor.id || actor._id;
  if (!userId) throw new Error("Authenticated service access actor requires an id");
  if (actor.role === "admin" || actor.role === "trainer") {
    return SERVICE_ACCESS_TIERS.TRAINER;
  }

  const [activeTrainerSubscription, activeCoachingOrder] = await Promise.all([
    trainerSubscriptionModel.exists({
      userId,
      status: "active",
      isActive: true,
      endDate: { $gt: now },
    }),
    orderModel.exists({
      userId,
      status: "approved",
      sessions: { $gt: 0 },
    }),
  ]);

  if (activeTrainerSubscription) return SERVICE_ACCESS_TIERS.TRAINER;
  if (activeCoachingOrder) return SERVICE_ACCESS_TIERS.COACHING_CUSTOMER;
  return SERVICE_ACCESS_TIERS.USER;
};

export const resolveRequestServiceAccessTier = async (req) => {
  if (req.serviceAccessTier) return req.serviceAccessTier;
  const tier = await resolveServiceAccessTier(req.user || null);
  req.serviceAccessTier = tier;
  return tier;
};

export const resolveRequestServicePolicy = async (req, serviceKey) => {
  const tier = await resolveRequestServiceAccessTier(req);
  const policy = getServiceAccessPolicy(serviceKey, tier);
  const resolved = { serviceKey, tier, policy };
  req.serviceAccessPolicy = resolved;
  return resolved;
};

export const serializeRequestQuota = (req, serviceKey) => {
  const info = req.rateLimit;
  const resolved = req.serviceAccessPolicy;
  if (!info || !resolved || resolved.serviceKey !== serviceKey) return null;

  return {
    serviceKey,
    tier: resolved.tier,
    limit: info.limit,
    remaining: info.remaining,
    resetAt: info.resetTime?.toISOString?.() || null,
  };
};

export const getAdminServiceAccessPolicyMatrix = () => {
  const trainerPlans = listTrainerPlans();
  const trainerBenefits = listTrainerPlanBenefits();

  return {
    version: SERVICE_ACCESS_POLICY_VERSION,
    columns: [
    {
      id: "guest",
      label: "Guest",
      tiers: [{ key: SERVICE_ACCESS_TIERS.GUEST, label: "Guest" }],
    },
    {
      id: "user",
      label: "User thường",
      tiers: [{ key: SERVICE_ACCESS_TIERS.USER, label: "User thường" }],
    },
    {
      id: "paid",
      label: "User có gói / HLV",
      tiers: [
        {
          key: SERVICE_ACCESS_TIERS.COACHING_CUSTOMER,
          label: "User có gói",
        },
        { key: SERVICE_ACCESS_TIERS.TRAINER, label: "HLV" },
      ],
    },
    ],
    services: SERVICE_ACCESS_POLICY_REGISTRY,
    communityFeatures: {
      version: COMMUNITY_FEATURE_CATALOG_VERSION,
      items: COMMUNITY_FEATURE_CATALOG,
    },
    trainerPlans: {
      columns: trainerPlans.map((plan) => ({
        id: plan.code,
        label: plan.title,
        prices: plan.prices,
        billingCycles: plan.billingCycles,
        durationDays: plan.durationDays,
      })),
      benefits: trainerBenefits.map((benefit) => ({
        key: benefit.key,
        label: benefit.label,
        category: benefit.category,
        valueType: benefit.valueType,
        values: Object.fromEntries(
          trainerPlans.map((plan) => [
            plan.code,
            benefit.valueType === "capacity"
              ? plan.maxClients
              : benefit.includedPlanCodes.includes(plan.code),
          ]),
        ),
      })),
    },
  };
};
