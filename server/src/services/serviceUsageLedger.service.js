import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { ipKeyGenerator } from "express-rate-limit";
import mongoose from "mongoose";

import ServiceUsageBucket from "../models/ServiceUsageBucket.js";
import {
  buildServiceUsageBucketUpdate,
  buildServiceUsageRefundUpdate,
  normalizeServiceQuotaWindows,
  resolveServiceUsagePolicyGroup,
  serializeServiceUsageQuota,
  updateServiceUsageBucket,
} from "./serviceUsageLedgerRuntime.js";

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
  if (
    req.mealScanActor?.kind === "guest" &&
    HASH_PATTERN.test(req.mealScanActor.guestKey || "")
  ) {
    return { kind: "guest", guestKey: req.mealScanActor.guestKey };
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
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("Service usage timestamp is invalid");
  }

  const windows = normalizeServiceQuotaWindows(serviceKey, policy);
  const actor = normalizeActor(rawActor);
  const policyGroup = resolveServiceUsagePolicyGroup(tier);
  const bucketId = digest(
    `v2|${serviceKey}|${policyGroup}|${actor.actorKind}|${actor.actorKey}`,
  );
  const operationHash = digest(
    String(operationKey || randomUUID()).slice(0, 200),
  );
  const bucket = await updateServiceUsageBucket({
    model,
    bucketId,
    upsert: true,
    update: buildServiceUsageBucketUpdate({
      actor,
      serviceKey,
      tier,
      policyGroup,
      windows,
      operationHash,
      now,
    }),
  });
  if (!bucket || bucket.lastOperationHash !== operationHash) {
    throw new Error("Service usage bucket update returned no operation state");
  }

  const allowed = bucket.lastOperationAccepted === true;
  return {
    allowed,
    consumed: bucket.lastOperationConsumed === true,
    quota: serializeServiceUsageQuota({
      serviceKey,
      tier,
      windows,
      events: bucket.usageEvents || [],
      allowed,
      now,
    }),
    reservation: {
      bucketId,
      operationHash,
      serviceKey,
      tier,
      windows,
    },
  };
}

export async function refundServiceUsage({
  reservation,
  now = new Date(),
  model = ServiceUsageBucket,
}) {
  if (
    !reservation?.bucketId ||
    !HASH_PATTERN.test(reservation.operationHash || "")
  ) {
    throw new Error("Service usage reservation is invalid");
  }
  const windows = normalizeServiceQuotaWindows(reservation.serviceKey, {
    mode: "quota",
    windows: reservation.windows,
  });
  const bucket = await updateServiceUsageBucket({
    model,
    bucketId: reservation.bucketId,
    update: buildServiceUsageRefundUpdate({
      operationHash: reservation.operationHash,
      windows,
      now,
    }),
    upsert: false,
  });
  return serializeServiceUsageQuota({
    serviceKey: reservation.serviceKey,
    tier: reservation.tier,
    windows,
    events: bucket?.usageEvents || [],
    allowed: true,
    now,
  });
}
