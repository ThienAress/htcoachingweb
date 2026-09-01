import {
  SERVICE_ACCESS_POLICY_REGISTRY,
  SERVICE_ACCESS_POLICY_VERSION,
  SERVICE_ACCESS_TIERS,
  getServiceAccessPolicy,
  getServicePolicyWindows,
} from "../constants/serviceAccessPolicies.js";
import {
  COMMUNITY_FEATURE_CATALOG,
  COMMUNITY_FEATURE_CATALOG_VERSION,
  getCommunityFeatureAudienceKeys,
} from "../constants/communityFeatureCatalog.js";
import {
  EMAIL_NOTIFICATION_CATALOG,
  EMAIL_NOTIFICATION_CATALOG_VERSION,
} from "../constants/emailNotificationCatalog.js";
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

const GENERIC_TIER_PRIORITY = Object.freeze([
  SERVICE_ACCESS_TIERS.ADMIN,
  SERVICE_ACCESS_TIERS.TRAINER,
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
  SERVICE_ACCESS_TIERS.COACHING_CUSTOMER,
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART,
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_ESSENTIAL,
  SERVICE_ACCESS_TIERS.USER,
]);

const snapshotFields =
  "+entitlementPolicyVersion +entitlementPolicySnapshot createdAt";

const entitlementCandidate = (tier, source, document = null) => ({
  tier,
  source,
  policyVersion: document?.entitlementPolicyVersion || null,
  policySnapshot: document?.entitlementPolicyVersion
    ? document.entitlementPolicySnapshot || null
    : null,
});

const quotaWindowStrength = (window) => [
  window.key === "monthly" ? 2 : window.windowMs ? 1 : 0,
  Number(window.windowMs) || 0,
  Number(window.limit) || 0,
];

const compareNumberVectors = (left, right) => {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

const policyStrength = (policy) => {
  if (policy?.mode === "unlimited") return [2];
  if (policy?.mode !== "quota") return [0];
  const windows = [...getServicePolicyWindows(policy)].sort((left, right) =>
    compareNumberVectors(quotaWindowStrength(right), quotaWindowStrength(left)),
  );
  return [
    1,
    ...windows.flatMap((window) => [
      Number(window.windowMs) || 0,
      Number(window.limit) || 0,
    ]),
  ];
};

const mergePolicySnapshotFloor = (currentPolicy, snapshotPolicy) => {
  if (!snapshotPolicy || typeof snapshotPolicy !== "object") {
    return currentPolicy;
  }
  if (currentPolicy.mode === "unlimited" || snapshotPolicy.mode === "unlimited") {
    return currentPolicy.mode === "unlimited" ? currentPolicy : snapshotPolicy;
  }
  if (currentPolicy.mode !== "quota" || snapshotPolicy.mode !== "quota") {
    return currentPolicy;
  }

  const windowsByKey = new Map(
    getServicePolicyWindows(currentPolicy).map((window) => [
      window.key,
      { ...window },
    ]),
  );
  getServicePolicyWindows(snapshotPolicy).forEach((snapshotWindow) => {
    if (
      !snapshotWindow?.key ||
      !Number.isSafeInteger(snapshotWindow.limit) ||
      snapshotWindow.limit < 1
    ) {
      return;
    }
    const currentWindow = windowsByKey.get(snapshotWindow.key);
    if (!currentWindow) {
      windowsByKey.set(snapshotWindow.key, { ...snapshotWindow });
      return;
    }
    windowsByKey.set(snapshotWindow.key, {
      ...currentWindow,
      limit: Math.max(currentWindow.limit, snapshotWindow.limit),
    });
  });

  const windows = [...windowsByKey.values()];
  const primary = windows[0];
  return {
    ...currentPolicy,
    limit: primary.limit,
    period: primary.period,
    periodLabel: primary.periodLabel,
    windowMs: primary.windowMs ?? null,
    windows,
  };
};

const selectStrongestServicePolicy = (serviceKey, candidates) =>
  candidates
    .map((candidate) => ({
      ...candidate,
      policy: mergePolicySnapshotFloor(
        getServiceAccessPolicy(serviceKey, candidate.tier),
        candidate.policySnapshot?.[serviceKey],
      ),
    }))
    .sort((left, right) =>
      compareNumberVectors(
        policyStrength(right.policy),
        policyStrength(left.policy),
      ),
    )[0];

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

export const resolveServiceAccessCandidates = async (
  actor,
  {
    now = new Date(),
    orderModel = Order,
    trainerSubscriptionModel = TrainerSubscription,
    fitnessSubscriptionModel = FitnessSubscription,
  } = {},
) => {
  if (!actor) {
    return [entitlementCandidate(SERVICE_ACCESS_TIERS.GUEST, "guest")];
  }

  const userId = actor.id || actor._id;
  if (!userId) throw new Error("Authenticated service access actor requires an id");

  const [activeTrainerSubscription, activeCoachingOrders, activeFitnessSubscription] = await Promise.all([
    trainerSubscriptionModel
      .findOne({
        userId,
        status: "active",
        isActive: true,
        endDate: { $gt: now },
      })
      .select(snapshotFields)
      .sort({ createdAt: -1 })
      .lean(),
    orderModel
      .find({
        userId,
        status: "approved",
        sessions: { $gt: 0 },
      })
      .select(snapshotFields)
      .sort({ approvedAt: -1, createdAt: -1 })
      .lean(),
    fitnessSubscriptionModel
      .findOne({
        userId,
        status: "active",
        isActive: true,
        endDate: { $gt: now },
      })
      .select(`planCode ${snapshotFields}`)
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const candidates = [];
  if (actor.role === "admin") {
    candidates.push(entitlementCandidate(SERVICE_ACCESS_TIERS.ADMIN, "role"));
  } else if (actor.role === "trainer") {
    candidates.push(entitlementCandidate(SERVICE_ACCESS_TIERS.TRAINER, "role"));
  }
  if (activeTrainerSubscription) {
    candidates.push(
      entitlementCandidate(
        SERVICE_ACCESS_TIERS.TRAINER,
        "trainer_subscription",
        activeTrainerSubscription,
      ),
    );
  }
  activeCoachingOrders.forEach((activeCoachingOrder) => {
    candidates.push(
      entitlementCandidate(
        SERVICE_ACCESS_TIERS.COACHING_CUSTOMER,
        "coaching_order",
        activeCoachingOrder,
      ),
    );
  });
  if (
    activeFitnessSubscription?.planCode &&
    FITNESS_PLUS_TIERS.has(activeFitnessSubscription.planCode)
  ) {
    candidates.push(
      entitlementCandidate(
        activeFitnessSubscription.planCode,
        "fitness_subscription",
        activeFitnessSubscription,
      ),
    );
  }
  if (candidates.length === 0) {
    candidates.push(entitlementCandidate(SERVICE_ACCESS_TIERS.USER, "account"));
  }
  return candidates;
};

export const resolveServiceAccessTier = async (actor, options = {}) => {
  const candidates = await resolveServiceAccessCandidates(actor, options);
  return (
    GENERIC_TIER_PRIORITY.find((tier) =>
      candidates.some((candidate) => candidate.tier === tier),
    ) || candidates[0].tier
  );
};

export const resolveRequestServiceAccessTier = async (req) => {
  if (req.serviceAccessTier && req.serviceAccessCandidates) {
    return req.serviceAccessTier;
  }
  if (req.serviceAccessTier) {
    req.serviceAccessCandidates = [
      entitlementCandidate(req.serviceAccessTier, "request_context"),
    ];
    return req.serviceAccessTier;
  }
  const candidates = await resolveServiceAccessCandidates(req.user || null);
  const tier =
    GENERIC_TIER_PRIORITY.find((candidateTier) =>
      candidates.some((candidate) => candidate.tier === candidateTier),
    ) || candidates[0].tier;
  req.serviceAccessCandidates = candidates;
  req.serviceAccessTier = tier;
  return tier;
};

export const resolveRequestServicePolicy = async (req, serviceKey) => {
  await resolveRequestServiceAccessTier(req);
  const selected = selectStrongestServicePolicy(
    serviceKey,
    req.serviceAccessCandidates,
  );
  const resolved = {
    serviceKey,
    tier: selected.tier,
    entitlementTiers: [
      ...new Set(req.serviceAccessCandidates.map(({ tier }) => tier)),
    ],
    policy: selected.policy,
  };
  req.serviceAccessPolicy = resolved;
  return resolved;
};

export const serializeRequestQuota = (req, serviceKey) => {
  const sharedQuota = req.serviceUsageQuota;
  if (sharedQuota?.serviceKey === serviceKey) return { ...sharedQuota };

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
          { key: SERVICE_ACCESS_TIERS.ADMIN, label: "Admin" },
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
    emailNotifications: {
      version: EMAIL_NOTIFICATION_CATALOG_VERSION,
      items: EMAIL_NOTIFICATION_CATALOG,
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
