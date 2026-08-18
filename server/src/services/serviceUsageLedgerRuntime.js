import { getServicePolicyWindows } from "../constants/serviceAccessPolicies.js";

const WINDOW_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;

export const normalizeServiceQuotaWindows = (serviceKey, policy) => {
  if (policy?.mode !== "quota") {
    throw new Error(`Service ${serviceKey} requires a bounded quota policy`);
  }
  const windows = getServicePolicyWindows(policy).map((window) => ({
    key: String(window?.key || ""),
    limit: window?.limit,
    period: String(window?.period || ""),
    periodLabel: String(window?.periodLabel || ""),
    windowMs: window?.windowMs ?? null,
  }));
  if (windows.length === 0 || windows.length > 3) {
    throw new Error(`Service ${serviceKey} requires one to three quota windows`);
  }
  const keys = new Set();
  windows.forEach((window) => {
    const validWindowMs =
      window.windowMs === null ||
      (Number.isSafeInteger(window.windowMs) &&
        window.windowMs > 0 &&
        window.windowMs <= MAX_WINDOW_MS);
    if (
      !WINDOW_KEY_PATTERN.test(window.key) ||
      keys.has(window.key) ||
      !Number.isSafeInteger(window.limit) ||
      window.limit < 1 ||
      !validWindowMs
    ) {
      throw new Error(`Service ${serviceKey} has an invalid quota window`);
    }
    keys.add(window.key);
  });
  return windows;
};

export const resolveServiceUsagePolicyGroup = (tier) =>
  tier === "guest" || tier === "user" ? tier : "entitled";

const finiteMaxWindowMs = (windows) => {
  const finite = windows
    .map((window) => window.windowMs)
    .filter(Number.isSafeInteger);
  return finite.length > 0 ? Math.max(...finite) : null;
};

const retainedEventsExpression = (windows, now) => {
  const maxWindowMs = finiteMaxWindowMs(windows);
  if (maxWindowMs === null) return { $ifNull: ["$usageEvents", []] };
  return {
    $filter: {
      input: { $ifNull: ["$usageEvents", []] },
      as: "usageEvent",
      cond: {
        $gt: [
          "$$usageEvent.consumedAt",
          new Date(now.getTime() - maxWindowMs),
        ],
      },
    },
  };
};

const activeWindowEventsExpression = (window, now) =>
  window.windowMs === null
    ? "$usageEvents"
    : {
        $filter: {
          input: "$usageEvents",
          as: "usageEvent",
          cond: {
            $gt: [
              "$$usageEvent.consumedAt",
              new Date(now.getTime() - window.windowMs),
            ],
          },
        },
      };

const operationHashesExpression = () => ({
  $map: {
    input: "$usageEvents",
    as: "usageEvent",
    in: "$$usageEvent.operationHash",
  },
});

const summaryStages = ({ windows, now }) => {
  const maxWindowMs = finiteMaxWindowMs(windows);
  const eventCount = { $size: "$usageEvents" };
  return [
    {
      $set: {
        count: eventCount,
        operationHashes: operationHashesExpression(),
        limit: windows[0].limit,
        windowStartedAt: {
          $cond: [
            { $gt: [eventCount, 0] },
            { $arrayElemAt: ["$usageEvents.consumedAt", 0] },
            null,
          ],
        },
        resetAt:
          maxWindowMs === null
            ? null
            : {
                $cond: [
                  { $gt: [eventCount, 0] },
                  {
                    $add: [
                      { $arrayElemAt: ["$usageEvents.consumedAt", -1] },
                      maxWindowMs,
                    ],
                  },
                  new Date(now.getTime() + maxWindowMs),
                ],
              },
        updatedAt: now,
      },
    },
  ];
};

export const buildServiceUsageBucketUpdate = ({
  actor,
  serviceKey,
  tier,
  policyGroup,
  windows,
  operationHash,
  now,
}) => {
  const duplicateOperation = {
    $in: [operationHash, operationHashesExpression()],
  };
  const hasCapacity = {
    $and: windows.map((window) => ({
      $lt: [
        { $size: activeWindowEventsExpression(window, now) },
        window.limit,
      ],
    })),
  };
  const accepted = { $or: [duplicateOperation, hasCapacity] };
  const consumed = { $and: [{ $not: [duplicateOperation] }, hasCapacity] };

  return [
    {
      $set: {
        serviceKey,
        actorKind: actor.actorKind,
        userId: actor.userId,
        guestKey: actor.guestKey,
        tier,
        policyGroup,
        usageEvents: retainedEventsExpression(windows, now),
        createdAt: { $ifNull: ["$createdAt", now] },
      },
    },
    {
      $set: {
        usageEvents: {
          $cond: [
            consumed,
            {
              $concatArrays: [
                "$usageEvents",
                [{ operationHash, consumedAt: now }],
              ],
            },
            "$usageEvents",
          ],
        },
        lastOperationHash: operationHash,
        lastOperationAccepted: accepted,
        lastOperationConsumed: consumed,
      },
    },
    ...summaryStages({ windows, now }),
  ];
};

export const buildServiceUsageRefundUpdate = ({
  operationHash,
  windows,
  now,
}) => [
  {
    $set: {
      usageEvents: {
        $filter: {
          input: { $ifNull: ["$usageEvents", []] },
          as: "usageEvent",
          cond: { $ne: ["$$usageEvent.operationHash", operationHash] },
        },
      },
      lastOperationHash: operationHash,
      lastOperationAccepted: false,
      lastOperationConsumed: false,
    },
  },
  ...summaryStages({ windows, now }),
];

export const serializeServiceUsageQuota = ({
  serviceKey,
  tier,
  windows,
  events,
  allowed,
  now,
}) => {
  const serializedWindows = windows.map((window) => {
    const activeEvents = events.filter(
      (event) =>
        window.windowMs === null ||
        new Date(event.consumedAt).getTime() > now.getTime() - window.windowMs,
    );
    const firstConsumedAt = activeEvents[0]?.consumedAt;
    return {
      key: window.key,
      limit: window.limit,
      remaining: Math.max(window.limit - activeEvents.length, 0),
      resetAt:
        window.windowMs !== null && firstConsumedAt
          ? new Date(
              new Date(firstConsumedAt).getTime() + window.windowMs,
            ).toISOString()
          : null,
      period: window.period,
      periodLabel: window.periodLabel,
    };
  });
  const primary =
    (!allowed && serializedWindows.find((window) => window.remaining === 0)) ||
    serializedWindows[0];
  return {
    serviceKey,
    tier,
    limit: primary.limit,
    remaining: primary.remaining,
    resetAt: primary.resetAt,
    windows: serializedWindows,
  };
};

export const updateServiceUsageBucket = async ({
  model,
  bucketId,
  update,
  upsert,
}) => {
  const options = {
    upsert,
    returnDocument: "after",
    lean: true,
    updatePipeline: true,
    projection: {
      usageEvents: 1,
      lastOperationHash: 1,
      lastOperationAccepted: 1,
      lastOperationConsumed: 1,
    },
  };
  try {
    return await model.findOneAndUpdate({ _id: bucketId }, update, options);
  } catch (error) {
    if (!upsert || error?.code !== 11000) throw error;
    return model.findOneAndUpdate(
      { _id: bucketId },
      update,
      { ...options, upsert: false },
    );
  }
};
