import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import F1AiReport from "../models/F1AiReport.js";
import F1Assessment from "../models/F1Assessment.js";
import F1Customer from "../models/F1Customer.js";
import F1DataDeletionJob from "../models/F1DataDeletionJob.js";
import F1Intake from "../models/F1Intake.js";
import F1Media from "../models/F1Media.js";
import F1MediaDeletionJob from "../models/F1MediaDeletionJob.js";
import F1OutcomeForecast from "../models/F1OutcomeForecast.js";
import F1ResultPrediction from "../models/F1ResultPrediction.js";
import { incrementMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";
import { processF1MediaDeletionBatch } from "./f1MediaLifecycle.service.js";

const DELETE_CLAIM_TIMEOUT_MS = Math.max(
  Number(process.env.F1_DATA_DELETE_CLAIM_TIMEOUT_MS || 10 * 60 * 1000),
  30_000,
);
const DELETE_MAX_ATTEMPTS = Math.max(
  Number(process.env.F1_DATA_DELETE_MAX_ATTEMPTS || 10),
  1,
);
const RETENTION_BATCH_SIZE = Math.max(
  Number(process.env.F1_RETENTION_BATCH_SIZE || 25),
  1,
);

const normalizeActorRole = (role) =>
  ["admin", "trainer", "user"].includes(role) ? role : "user";

const buildDeletionJobWrites = (mediaList, actorId) =>
  mediaList
    .filter((media) => media.storageKey || media.publicId)
    .map((media) => ({
      updateOne: {
        filter: { mediaId: media._id },
        update: {
          $setOnInsert: {
            customerId: media.customerId,
            provider: media.provider,
            storageKey: media.storageKey || media.publicId,
            requestedBy: actorId,
          },
          $set: {
            status: "pending",
            nextAttemptAt: new Date(),
            lastErrorCode: "",
          },
        },
        upsert: true,
      },
    }));

export const requestF1CustomerDeletion = async ({
  customer,
  actorId,
  actorRole,
  reason = "admin_request",
  requestContext = {},
}) => {
  const session = await mongoose.startSession();
  let job;
  try {
    await session.withTransaction(async () => {
      const mediaList = await F1Media.find({
        customerId: customer._id,
        status: { $ne: "deleted" },
      }).session(session);
      const withObject = mediaList.filter(
        (media) => media.storageKey || media.publicId,
      );
      const withoutObject = mediaList.filter(
        (media) => !media.storageKey && !media.publicId,
      );

      if (withObject.length > 0) {
        await F1Media.updateMany(
          { _id: { $in: withObject.map((media) => media._id) } },
          {
            $set: {
              status: "delete_pending",
              deleteRequestedAt: new Date(),
            },
            $inc: { revision: 1 },
          },
          { session },
        );
        const writes = buildDeletionJobWrites(withObject, actorId);
        if (writes.length > 0) {
          await F1MediaDeletionJob.bulkWrite(writes, { session });
        }
      }
      if (withoutObject.length > 0) {
        await F1Media.updateMany(
          { _id: { $in: withoutObject.map((media) => media._id) } },
          {
            $set: { status: "deleted", deletedAt: new Date() },
            $inc: { revision: 1 },
          },
          { session },
        );
      }

      job = await F1DataDeletionJob.findOneAndUpdate(
        { customerId: customer._id },
        {
          $setOnInsert: {
            requestedBy: actorId,
            requestedByRole: normalizeActorRole(actorRole),
            reason,
          },
          $set: {
            status: "pending_media_cleanup",
            nextAttemptAt: new Date(),
            lastErrorCode: "",
          },
        },
        { upsert: true, returnDocument: "after", session },
      );

      await F1Customer.updateOne(
        { _id: customer._id },
        {
          $set: {
            status: "archived",
            archivedAt: customer.archivedAt || new Date(),
            deletionRequestedAt: new Date(),
          },
        },
        { session },
      );
      await AuditLog.create(
        [
          {
            actorId,
            actorRole: normalizeActorRole(actorRole),
            action: "request_f1_data_deletion",
            targetType: "f1_customer",
            targetId: customer._id,
            metadata: {
              reason,
              mediaCount: mediaList.length,
              requestId: requestContext.requestId || "",
            },
            ipAddress: requestContext.ipAddress || "",
            userAgent: requestContext.userAgent || "",
          },
        ],
        { session },
      );
    });
    return job;
  } finally {
    await session.endSession();
  }
};

const claimDataDeletionJob = (now) =>
  F1DataDeletionJob.findOneAndUpdate(
    {
      attempts: { $lt: DELETE_MAX_ATTEMPTS },
      nextAttemptAt: { $lte: now },
      $or: [
        { status: { $in: ["pending_media_cleanup", "failed"] } },
        {
          status: "processing",
          claimedAt: {
            $lte: new Date(now.getTime() - DELETE_CLAIM_TIMEOUT_MS),
          },
        },
      ],
    },
    {
      $set: { status: "processing", claimedAt: now },
      $inc: { attempts: 1 },
    },
    { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
  );

const pseudonymizeCustomer = (customerId, session) =>
  F1Customer.updateOne(
    { _id: customerId },
    {
      $set: {
        fullName: "Deleted F1 Customer",
        occupation: "",
        phone: "",
        email: "",
        assignedTrainerId: null,
        notesInternal: "",
        readinessStatus: "pending",
        status: "archived",
        lastIntakeId: null,
        lastAssessmentId: null,
        lastAiReportId: null,
        lastOutcomeForecastId: null,
        lastResultPredictionId: null,
        deletedAt: new Date(),
      },
    },
    { session },
  );

export const processF1DataDeletionBatch = async ({
  batchSize = 5,
  now = new Date(),
} = {}) => {
  await processF1MediaDeletionBatch({
    batchSize: Math.max(batchSize * 4, 10),
    now,
  });
  const result = { claimed: 0, completed: 0, waiting: 0, failed: 0 };

  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimDataDeletionJob(now);
    if (!job) break;
    result.claimed += 1;
    try {
      const pendingMedia = await F1Media.countDocuments({
        customerId: job.customerId,
        status: { $nin: ["deleted", "failed"] },
      });
      if (pendingMedia > 0) {
        result.waiting += 1;
        await F1DataDeletionJob.updateOne(
          { _id: job._id },
          {
            $set: {
              status: "pending_media_cleanup",
              nextAttemptAt: new Date(Date.now() + 60_000),
            },
          },
        );
        continue;
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await Promise.all([
            F1Intake.deleteMany({ customerId: job.customerId }).session(session),
            F1Assessment.deleteMany({ customerId: job.customerId }).session(
              session,
            ),
            F1AiReport.deleteMany({ customerId: job.customerId }).session(
              session,
            ),
            F1OutcomeForecast.deleteMany({
              customerId: job.customerId,
            }).session(session),
            F1ResultPrediction.deleteMany({
              customerId: job.customerId,
            }).session(session),
            F1Media.deleteMany({ customerId: job.customerId }).session(session),
            F1MediaDeletionJob.deleteMany({
              customerId: job.customerId,
            }).session(session),
          ]);
          await pseudonymizeCustomer(job.customerId, session);
          await F1DataDeletionJob.updateOne(
            { _id: job._id },
            {
              $set: {
                status: "completed",
                completedAt: new Date(),
                lastErrorCode: "",
              },
            },
            { session },
          );
          await AuditLog.create(
            [
              {
                actorId: job.requestedBy,
                actorRole: normalizeActorRole(job.requestedByRole),
                action: "complete_f1_data_deletion",
                targetType: "f1_customer",
                targetId: job.customerId,
                metadata: { reason: job.reason },
              },
            ],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      incrementMetric("f1.deletion_completed");
      result.completed += 1;
    } catch (error) {
      result.failed += 1;
      await F1DataDeletionJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "failed",
            nextAttemptAt: new Date(
              Date.now() + Math.min(6 * 60 * 60 * 1000, 60_000 * 2 ** job.attempts),
            ),
            lastErrorCode: String(
              error.code || "F1_DATA_DELETE_FAILED",
            ).slice(0, 100),
          },
        },
      );
      safeLog.error("f1.data_deletion.failed", error, {
        customerId: String(job.customerId),
        attempt: job.attempts,
      });
    }
  }
  return result;
};

export const runF1RetentionSweep = async ({
  now = new Date(),
  enforce = process.env.F1_RETENTION_ENFORCE === "true",
} = {}) => {
  const candidates = await F1Customer.find({
    status: "archived",
    deletedAt: null,
    deletionRequestedAt: null,
    retentionExpiresAt: { $ne: null, $lte: now },
  })
    .sort({ retentionExpiresAt: 1 })
    .limit(RETENTION_BATCH_SIZE);

  if (candidates.length > 0) {
    incrementMetric("f1.retention_candidates", candidates.length);
  }
  if (!enforce) {
    safeLog.info("f1.retention.dry_run", {
      candidateCount: candidates.length,
      customerIds: candidates.map((item) => String(item._id)),
    });
    return { dryRun: true, candidates: candidates.length, queued: 0 };
  }

  const actorId = process.env.F1_RETENTION_ACTOR_ID;
  if (!mongoose.Types.ObjectId.isValid(actorId)) {
    throw new Error(
      "F1_RETENTION_ACTOR_ID must be an explicit valid user id before enforcement",
    );
  }
  let queued = 0;
  for (const customer of candidates) {
    await requestF1CustomerDeletion({
      customer,
      actorId,
      actorRole: "admin",
      reason: "retention_expired",
    });
    queued += 1;
  }
  return { dryRun: false, candidates: candidates.length, queued };
};

let lifecycleTimer = null;

export const startF1LifecycleCron = () => {
  if (lifecycleTimer) return lifecycleTimer;
  const intervalMs = Math.max(
    Number(process.env.F1_LIFECYCLE_INTERVAL_MS || 5 * 60 * 1000),
    30_000,
  );
  const run = async () => {
    try {
      await processF1DataDeletionBatch();
      await runF1RetentionSweep();
    } catch (error) {
      safeLog.error("f1.lifecycle.tick_failed", error);
    }
  };
  lifecycleTimer = setInterval(run, intervalMs);
  lifecycleTimer.unref?.();
  run();
  return lifecycleTimer;
};

export const stopF1LifecycleCronForTests = () => {
  if (lifecycleTimer) clearInterval(lifecycleTimer);
  lifecycleTimer = null;
};
