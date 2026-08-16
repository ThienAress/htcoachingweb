import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { ipKeyGenerator } from "express-rate-limit";
import mongoose from "mongoose";

import ServiceUsageBucket from "../models/ServiceUsageBucket.js";

const fallbackGuestSecret = randomBytes(32);
const SERVICE_KEYS = new Set(["ai_chat", "meal_scan"]);
const HASH_PATTERN = /^[a-f0-9]{64}$/;

const digest = (value) =>
  createHash("sha256").update(String(value)).digest("hex");

const guestHashSecret = () =>
  process.env.AI_USAGE_HASH_SECRET ||
  process.env.AI_GUEST_RATE_LIMIT_SECRET ||
  process.env.LOG_HASH_SECRET ||
  process.env.JWT_SECRET ||
  fallbackGuestSecret;

export const hashServiceUsageGuestNetwork = (ip) =>
  createHmac("sha256", guestHashSecret())
    .update(ipKeyGenerator(String(ip || "")))
    .digest("hex");

export const resolveServiceUsageActor = (req) => {
  if (req.user?.id) {
    return { kind: "user", userId: req.user.id };
  }
  return {
    kind: "guest",
    guestKey: hashServiceUsageGuestNetwork(req.ip),
  };
};

const normalizeActor = (actor) => {
  if (actor?.kind === "user" && actor.userId) {
    if (!mongoose.isValidObjectId(actor.userId)) {
      throw new Error("Service usage user actor is invalid");
    }
    const userId = new mongoose.Types.ObjectId(String(actor.userId));
    return {
      actorKind: "user",
      actorKey: String(userId),
      userId,
      guestKey: null,
    };
  }
  if (actor?.kind === "guest" && HASH_PATTERN.test(actor.guestKey || "")) {
    return {
      actorKind: "guest",
      actorKey: actor.guestKey,
      userId: null,
      guestKey: actor.guestKey,
    };
  }
  throw new Error("Service usage actor is invalid");
};

const buildBucketUpdate = ({
  actor,
  serviceKey,
  tier,
  limit,
  windowMs,
  operationHash,
  now,
}) => {
  const activeWindow = {
    $gt: [{ $ifNull: ["$resetAt", new Date(0)] }, now],
  };
  const operationHashes = { $ifNull: ["$operationHashes", []] };
  const currentCount = { $ifNull: ["$count", 0] };
  const duplicateOperation = {
    $and: [activeWindow, { $in: [operationHash, operationHashes] }],
  };
  const hasCapacity = {
    $or: [{ $not: [activeWindow] }, { $lt: [currentCount, limit] }],
  };
  const nextCount = {
    $cond: [
      duplicateOperation,
      currentCount,
      {
        $cond: [
          activeWindow,
          {
            $cond: [
              { $lt: [currentCount, limit] },
              { $add: [currentCount, 1] },
              currentCount,
            ],
          },
          1,
        ],
      },
    ],
  };
  const nextOperationHashes = {
    $cond: [
      duplicateOperation,
      operationHashes,
      {
        $cond: [
          activeWindow,
          {
            $cond: [
              hasCapacity,
              {
                $slice: [
                  { $concatArrays: [operationHashes, [operationHash]] },
                  -limit,
                ],
              },
              operationHashes,
            ],
          },
          [operationHash],
        ],
      },
    ],
  };

  return [
    {
      $set: {
        serviceKey,
        actorKind: actor.actorKind,
        userId: actor.userId,
        guestKey: actor.guestKey,
        tier,
        limit,
        count: nextCount,
        operationHashes: nextOperationHashes,
        windowStartedAt: { $cond: [activeWindow, "$windowStartedAt", now] },
        resetAt: {
          $cond: [
            activeWindow,
            "$resetAt",
            new Date(now.getTime() + windowMs),
          ],
        },
        createdAt: { $ifNull: ["$createdAt", now] },
        updatedAt: now,
      },
    },
  ];
};

export async function consumeServiceUsage({
  serviceKey,
  tier,
  policy,
  actor: rawActor,
  operationKey = randomUUID(),
  now = new Date(),
  model = ServiceUsageBucket,
}) {
  if (!SERVICE_KEYS.has(serviceKey)) {
    throw new Error(`Unsupported shared usage service: ${serviceKey}`);
  }
  if (
    policy?.mode !== "quota" ||
    !Number.isSafeInteger(policy.limit) ||
    policy.limit < 1 ||
    !Number.isSafeInteger(policy.windowMs) ||
    policy.windowMs < 1
  ) {
    throw new Error(`Service ${serviceKey} requires a bounded quota policy`);
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("Service usage timestamp is invalid");
  }

  const actor = normalizeActor(rawActor);
  const bucketId = digest(`v1|${serviceKey}|${actor.actorKind}|${actor.actorKey}`);
  const operationHash = digest(
    String(operationKey || randomUUID()).slice(0, 200),
  );
  const update = buildBucketUpdate({
    actor,
    serviceKey,
    tier,
    limit: policy.limit,
    windowMs: policy.windowMs,
    operationHash,
    now,
  });

  let bucket;
  try {
    bucket = await model.findOneAndUpdate({ _id: bucketId }, update, {
      upsert: true,
      returnDocument: "after",
      lean: true,
      updatePipeline: true,
      projection: { count: 1, operationHashes: 1, resetAt: 1 },
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    bucket = await model.findOneAndUpdate({ _id: bucketId }, update, {
      returnDocument: "after",
      lean: true,
      updatePipeline: true,
      projection: { count: 1, operationHashes: 1, resetAt: 1 },
    });
  }
  if (!bucket) throw new Error("Service usage bucket update returned no state");

  return {
    allowed: bucket.operationHashes?.includes(operationHash) === true,
    quota: {
      serviceKey,
      tier,
      limit: policy.limit,
      remaining: Math.max(policy.limit - bucket.count, 0),
      resetAt: new Date(bucket.resetAt).toISOString(),
    },
  };
}
