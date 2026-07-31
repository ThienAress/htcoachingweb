import crypto from "node:crypto";
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import WellnessTarget from "../models/WellnessTarget.js";
import { incrementMetric } from "../observability/metrics.js";
import { getVietnamDateKey, parseDateKey } from "../utils/dateKey.js";
import {
  assertWellnessTargetWritesEnabled,
  resolveCoachClientTargetAccess,
  wellnessTargetError,
} from "./wellnessTargetAccess.service.js";
import { toWellnessTargetDto } from "./wellnessTargetDto.service.js";

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeInput = (input) => {
  const targets = {
    sleepHours: Number(input?.targets?.sleepHours),
    waterMl: Number(input?.targets?.waterMl),
    steps: Number(input?.targets?.steps),
  };
  if (
    !Number.isFinite(targets.sleepHours) ||
    targets.sleepHours < 1 ||
    targets.sleepHours > 24 ||
    !Number.isInteger(targets.waterMl) ||
    targets.waterMl < 250 ||
    targets.waterMl > 20000 ||
    !Number.isInteger(targets.steps) ||
    targets.steps < 100 ||
    targets.steps > 200000
  ) {
    throw wellnessTargetError(
      400,
      "Mục tiêu sức khỏe không hợp lệ",
      "INVALID_WELLNESS_TARGET",
    );
  }
  const expectedVersion = Number(input?.expectedVersion);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw wellnessTargetError(
      400,
      "expectedVersion không hợp lệ",
      "INVALID_EXPECTED_VERSION",
    );
  }
  if (!REQUEST_ID_PATTERN.test(String(input?.requestId || ""))) {
    throw wellnessTargetError(400, "requestId không hợp lệ", "INVALID_REQUEST_ID");
  }
  return {
    expectedVersion,
    requestId: input.requestId,
    targets,
    note: String(input?.note || "").trim().slice(0, 500),
  };
};

const fingerprintFor = ({ clientId, normalized }) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        clientId: String(clientId),
        expectedVersion: normalized.expectedVersion,
        targets: normalized.targets,
        note: normalized.note,
      }),
    )
    .digest("hex");

const findReplay = ({ actorId, requestId, session = null }) => {
  let query = WellnessTarget.findOne({
    updatedByActorId: actorId,
    commandRequestId: requestId,
  }).select("+updatedByActorId +commandRequestId +payloadFingerprint");
  if (session) query = query.session(session);
  return query;
};

const resolveReplay = (document, fingerprint) => {
  if (!document) return null;
  if (document.payloadFingerprint !== fingerprint) {
    throw wellnessTargetError(
      409,
      "requestId đã được dùng với dữ liệu khác",
      "REQUEST_ID_REUSED",
    );
  }
  return { data: toWellnessTargetDto(document), idempotentReplay: true };
};

export const setClientWellnessTarget = async ({ actor, clientId, input }) => {
  assertWellnessTargetWritesEnabled();
  const normalized = normalizeInput(input);
  const payloadFingerprint = fingerprintFor({ clientId, normalized });
  const prior = resolveReplay(
    await findReplay({ actorId: actor.id, requestId: normalized.requestId }),
    payloadFingerprint,
  );
  if (prior) return prior;

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const replay = resolveReplay(
        await findReplay({
          actorId: actor.id,
          requestId: normalized.requestId,
          session,
        }),
        payloadFingerprint,
      );
      if (replay) {
        result = replay;
        return;
      }
      const access = await resolveCoachClientTargetAccess({
        actor,
        clientId,
        session,
      });
      const current = await WellnessTarget.findOne({
        clientId,
        isLatest: true,
      }).session(session);
      const currentVersion = current?.version || 0;
      if (currentVersion !== normalized.expectedVersion) {
        incrementMetric("wellness_target.conflicts");
        throw wellnessTargetError(
          409,
          "Mục tiêu đã có phiên bản mới hơn",
          "WELLNESS_TARGET_VERSION_CONFLICT",
        );
      }
      if (current) {
        current.isLatest = false;
        current.status = "superseded";
        await current.save({ session });
      }
      const version = currentVersion + 1;
      const [created] = await WellnessTarget.create(
        [
          {
            clientId,
            trainerIdAtCreation: access.trainerId || actor.id,
            updatedByActorId: actor.id,
            updatedByRole: actor.isAdmin ? "admin" : "trainer",
            version,
            isLatest: true,
            status: "active",
            effectiveFromDateKey: getVietnamDateKey(),
            targets: normalized.targets,
            note: normalized.note,
            commandRequestId: normalized.requestId,
            payloadFingerprint,
            retentionExpiresAt: current?.retentionExpiresAt || null,
          },
        ],
        { session },
      );
      await AuditLog.create(
        [
          {
            actorId: actor.id,
            actorRole: actor.isAdmin ? "admin" : "trainer",
            action: "write_wellness_target",
            targetType: "wellness_target",
            targetId: created._id,
            metadata: {
              clientId: String(clientId),
              version,
              changedFields: ["sleepHours", "waterMl", "steps", "note"],
            },
          },
        ],
        { session },
      );
      result = {
        data: toWellnessTargetDto(created),
        idempotentReplay: false,
      };
    });
  } catch (error) {
    if (error?.code === 11000) {
      const replay = resolveReplay(
        await findReplay({ actorId: actor.id, requestId: normalized.requestId }),
        payloadFingerprint,
      );
      if (replay) return replay;
      throw wellnessTargetError(
        409,
        "Mục tiêu đã có phiên bản mới hơn",
        "WELLNESS_TARGET_VERSION_CONFLICT",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
  if (!result.idempotentReplay) incrementMetric("wellness_target.writes");
  return result;
};

export const getCoachClientWellnessTarget = async ({ actor, clientId }) => {
  await resolveCoachClientTargetAccess({ actor, clientId });
  return toWellnessTargetDto(
    await WellnessTarget.findOne({ clientId, isLatest: true }).lean(),
  );
};

export const getClientWellnessTargetForDate = async ({ clientId, dateKey }) => {
  parseDateKey(dateKey);
  return toWellnessTargetDto(
    await WellnessTarget.findOne({
      clientId,
      effectiveFromDateKey: { $lte: dateKey },
    })
      .sort({ effectiveFromDateKey: -1, version: -1 })
      .lean(),
  );
};
