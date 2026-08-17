import {
  SERVICE_ACCESS_POLICY_REGISTRY,
  SERVICE_ACCESS_POLICY_VERSION,
  SERVICE_ACCESS_TIERS,
  getServiceAccessPolicy,
} from "../constants/serviceAccessPolicies.js";
import {
  COMMUNITY_FEATURE_CATALOG,
  COMMUNITY_FEATURE_CATALOG_VERSION,
  getCommunityFeatureAudienceKeys,
} from "../constants/communityFeatureCatalog.js";
import Order from "../models/Order.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import FitnessSubscription from "../models/FitnessSubscription.js";
import {
  listTrainerPlanBenefits,
  listTrainerPlans,
} from "./trainerPlanCatalog.service.js";
import { getCommunityFeatureReportOptions } from "./communityFeatureReport.service.js";

const FITNESS_PLUS_TIERS = new Set([
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_ESSENTIAL,
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART,
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
]);

const serializeCommunityFeature = (feature) => ({
  ...feature,
  audienceKeys: getCommunityFeatureAudienceKeys(feature.audiences),
  initialImprovement: feature.currentImprovement?.description || "",
  deliveryUpdates: (feature.improvementHistory || []).map((record) => {
    const latestMilestone = record.milestones?.at(-1);
    return {
      updateKey: record.improvementKey,
      label: record.opportunity,
      result: record.result,
      status: latestMilestone?.status || null,
      statusDate: latestMilestone?.statusDate || null,
    };
  }),
});

export const resolveServiceAccessTier = async (
  actor,
  {
    now = new Date(),
    orderModel = Order,
    trainerSubscriptionModel = TrainerSubscription,
    fitnessSubscriptionModel = FitnessSubscription,
  } = {},
) => {
  if (!actor) return SERVICE_ACCESS_TIERS.GUEST;

  const userId = actor.id || actor._id;
  if (!userId) throw new Error("Authenticated service access actor requires an id");
  if (actor.role === "admin" || actor.role === "trainer") {
    return SERVICE_ACCESS_TIERS.TRAINER;
  }

  const [activeTrainerSubscription, activeCoachingOrder, activeFitnessSubscription] = await Promise.all([
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
    fitnessSubscriptionModel
      .findOne({
        userId,
        status: "active",
        isActive: true,
        endDate: { $gt: now },
      })
      .select("planCode")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (activeTrainerSubscription) return SERVICE_ACCESS_TIERS.TRAINER;
  if (activeCoachingOrder) return SERVICE_ACCESS_TIERS.COACHING_CUSTOMER;
  if (
    activeFitnessSubscription?.planCode &&
    FITNESS_PLUS_TIERS.has(activeFitnessSubscription.planCode)
  ) {
    return activeFitnessSubscription.planCode;
  }
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
      {
        id: "fitness_plus",
        label: "HT Fitness+",
        tiers: [
          {
            key: SERVICE_ACCESS_TIERS.FITNESS_PLUS_ESSENTIAL,
            label: "Nền tảng",
          },
          {
            key: SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART,
            label: "Tăng tốc",
          },
          {
            key: SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
            label: "Toàn diện",
          },
        ],
      },
    ],
    services: SERVICE_ACCESS_POLICY_REGISTRY,
    communityFeatures: {
      version: COMMUNITY_FEATURE_CATALOG_VERSION,
      items: COMMUNITY_FEATURE_CATALOG.map(serializeCommunityFeature),
      reportOptions: getCommunityFeatureReportOptions(),
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
