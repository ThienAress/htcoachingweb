import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import F1Intake from "../models/F1Intake.js";
import F1Media from "../models/F1Media.js";
import F1MediaDeletionJob from "../models/F1MediaDeletionJob.js";
import { incrementMetric, observeMetric } from "../observability/metrics.js";
import { safeLog } from "../utils/safeLogger.js";
import {
  fetchF1ImageReference,
  processF1Image,
} from "./f1MediaImage.service.js";
import {
  deleteObject,
  getF1MediaStorageProvider,
  getMetadata,
  putProcessedImage,
} from "./f1MediaStorage.service.js";

const ACTIVE_MEDIA_STATUSES = ["pending_upload", "ready"];
const MAX_MEDIA_PER_CUSTOMER = Math.max(
  Number(process.env.F1_MEDIA_MAX_PER_CUSTOMER || 30),
  1,
);
const MAX_MEDIA_PER_SCOPE_TYPE = Math.max(
  Number(process.env.F1_MEDIA_MAX_PER_SCOPE_TYPE || 3),
  1,
);
const MAX_STORAGE_BYTES_PER_CUSTOMER = Math.max(
  Number(process.env.F1_MEDIA_MAX_STORAGE_BYTES || 100 * 1024 * 1024),
  1024,
);
const DELETE_MAX_ATTEMPTS = Math.max(
  Number(process.env.F1_MEDIA_DELETE_MAX_ATTEMPTS || 5),
  1,
);
const DELETE_CLAIM_TIMEOUT_MS = Math.max(
  Number(process.env.F1_MEDIA_DELETE_CLAIM_TIMEOUT_MS || 5 * 60 * 1000),
  10_000,
);

const lifecycleError = (message, code, status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const nextRetryAt = (attempts) =>
  new Date(Date.now() + Math.min(60 * 60 * 1000, 30_000 * 2 ** attempts));

const normalizeActorRole = (role) =>
  ["admin", "trainer", "user"].includes(role) ? role : "user";

const ensureQuota = async ({
  customerId,
  intakeId,
  predictionId,
  type,
  nextSizeBytes,
}) => {
  const scopeFilter = predictionId
    ? { predictionId }
    : { intakeId: intakeId || null };
  const [totalCount, perTypeCount, storage] = await Promise.all([
    F1Media.countDocuments({
      customerId,
      status: { $in: ACTIVE_MEDIA_STATUSES },
    }),
    F1Media.countDocuments({
      customerId,
      ...scopeFilter,
      type,
      status: { $in: ACTIVE_MEDIA_STATUSES },
    }),
    F1Media.aggregate([
      {
        $match: {
          customerId: new mongoose.Types.ObjectId(customerId),
          status: { $in: ACTIVE_MEDIA_STATUSES },
        },
      },
      { $group: { _id: null, bytes: { $sum: "$sizeBytes" } } },
    ]),
  ]);

  const currentBytes = Number(storage[0]?.bytes || 0);
  if (
    totalCount >= MAX_MEDIA_PER_CUSTOMER ||
    perTypeCount >= MAX_MEDIA_PER_SCOPE_TYPE ||
    currentBytes + nextSizeBytes > MAX_STORAGE_BYTES_PER_CUSTOMER
  ) {
    incrementMetric("f1.media_quota_rejected");
    throw lifecycleError(
      "Khách hàng đã đạt giới hạn lưu trữ ảnh F1",
      "F1_MEDIA_QUOTA_EXCEEDED",
      409,
    );
  }
};

export const serializeF1Media = (media) => {
  const value = media?.toObject ? media.toObject() : media;
  return {
    _id: value._id,
    customerId: value.customerId,
    intakeId: value.intakeId || null,
    predictionId: value.predictionId || null,
    phaseKey: value.phaseKey || "",
    type: value.type,
    status: value.status,
    mimeType: value.mimeType,
    sizeBytes: value.sizeBytes,
    width: value.width,
    height: value.height,
    createdAt: value.createdAt,
    readyAt: value.readyAt,
    contentPath:
      value.status === "ready"
        ? `/api/f1-customers/${value.customerId}/media/${value._id}/content`
        : null,
  };
};

export const recomputeIntakeMediaSummary = async (
  customerId,
  intakeId,
  actorId,
  session = null,
) => {
  if (!intakeId) return;
  const query = F1Media.find({
    customerId,
    intakeId,
    status: "ready",
  });
  if (session) query.session(session);
  const media = await query;
  const postureMediaSummary = {
    frontImageUploaded: media.some((item) => item.type === "posture_front"),
    backImageUploaded: media.some((item) => item.type === "posture_back"),
    sideImageUploaded: media.some((item) => item.type === "posture_side"),
  };
  await F1Intake.updateOne(
    { _id: intakeId, customerId },
    { $set: { postureMediaSummary, updatedBy: actorId } },
    session ? { session } : undefined,
  );
};

export const createF1MediaFromBuffer = async ({
  customerId,
  intakeId = null,
  predictionId = null,
  phaseKey = "",
  type,
  buffer,
  actorId,
  actorRole,
  requestContext = {},
}) => {
  const startedAt = performance.now();
  const processed = await processF1Image(buffer);
  await ensureQuota({
    customerId,
    intakeId,
    predictionId,
    type,
    nextSizeBytes: processed.sizeBytes,
  });

  const duplicate = await F1Media.findOne({
    customerId,
    intakeId: intakeId || null,
    predictionId: predictionId || null,
    type,
    checksum: processed.checksum,
    status: "ready",
  });
  if (duplicate) return { media: duplicate, idempotentReplay: true };

  const media = await F1Media.create({
    customerId,
    intakeId,
    predictionId,
    phaseKey,
    type,
    provider: getF1MediaStorageProvider(),
    checksum: processed.checksum,
    format: processed.format,
    mimeType: processed.mimeType,
    sizeBytes: processed.sizeBytes,
    width: processed.width,
    height: processed.height,
    uploadedBy: actorId,
    status: "pending_upload",
  });

  let stored = null;
  try {
    stored = await putProcessedImage(processed.buffer, {
      customerId: String(customerId),
      mediaId: String(media._id),
      format: processed.format,
      checksum: processed.checksum,
    });
    const ready = await F1Media.findOneAndUpdate(
      { _id: media._id, status: "pending_upload", revision: 0 },
      {
        $set: {
          provider: stored.provider,
          storageKey: stored.storageKey,
          publicId: "",
          url: "",
          status: "ready",
          readyAt: new Date(),
          failureCode: "",
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    );
    if (!ready) {
      throw lifecycleError(
        "Media upload state changed concurrently",
        "F1_MEDIA_STATE_CONFLICT",
        409,
      );
    }
    incrementMetric("f1.media_uploaded");
    observeMetric(
      "f1.media_processing_ms",
      Number((performance.now() - startedAt).toFixed(2)),
    );
    await AuditLog.create({
      actorId,
      actorRole: normalizeActorRole(actorRole),
      action: "upload_f1_media",
      targetType: "f1_media",
      targetId: ready._id,
      metadata: {
        customerId: String(customerId),
        type,
        sizeBytes: ready.sizeBytes,
        requestId: requestContext.requestId || "",
      },
      ipAddress: requestContext.ipAddress || "",
      userAgent: requestContext.userAgent || "",
    });
    if (intakeId) {
      await recomputeIntakeMediaSummary(customerId, intakeId, actorId);
    }
    return { media: ready, idempotentReplay: false };
  } catch (error) {
    incrementMetric("f1.media_upload_failed");
    const failureCode = String(error.code || "F1_MEDIA_PROVIDER_FAILED").slice(
      0,
      100,
    );
    if (stored?.storageKey) {
      await F1Media.updateOne(
        { _id: media._id },
        {
          $set: {
            provider: stored.provider,
            storageKey: stored.storageKey,
            status: "delete_pending",
            failureCode,
            deleteRequestedAt: new Date(),
          },
        },
      ).catch(() => undefined);
      await F1MediaDeletionJob.updateOne(
        { mediaId: media._id },
        {
          $setOnInsert: {
            customerId,
            provider: stored.provider,
            storageKey: stored.storageKey,
          },
          $set: { status: "pending", nextAttemptAt: new Date() },
        },
        { upsert: true },
      ).catch(() => undefined);
    } else {
      await F1Media.updateOne(
        { _id: media._id },
        { $set: { status: "failed", failureCode } },
      ).catch(() => undefined);
    }
    safeLog.error("f1.media.upload_failed", error, {
      customerId: String(customerId),
      mediaId: String(media._id),
      requestId: requestContext.requestId || "",
      failureCode,
    });
    throw error;
  }
};

export const createF1MediaFromReference = async (options) => {
  const buffer = await fetchF1ImageReference(options.reference);
  return createF1MediaFromBuffer({ ...options, buffer });
};

export const queueF1MediaDeletion = async ({
  media,
  actorId,
  actorRole,
  requestContext = {},
  session = null,
}) => {
  if (!media || ["deleted", "delete_pending"].includes(media.status)) {
    return media;
  }
  const storageKey = media.storageKey || media.publicId || "";
  if (!storageKey) {
    return F1Media.findByIdAndUpdate(
      media._id,
      {
        $set: { status: "deleted", deletedAt: new Date() },
        $inc: { revision: 1 },
      },
      { returnDocument: "after", ...(session ? { session } : {}) },
    );
  }

  const options = session ? { session } : {};
  const updated = await F1Media.findOneAndUpdate(
    { _id: media._id, status: { $nin: ["deleted", "delete_pending"] } },
    {
      $set: {
        status: "delete_pending",
        deleteRequestedAt: new Date(),
      },
      $inc: { revision: 1 },
    },
    { returnDocument: "after", ...options },
  );
  if (!updated) return F1Media.findById(media._id).session(session || null);

  await F1MediaDeletionJob.updateOne(
    { mediaId: media._id },
    {
      $setOnInsert: {
        customerId: media.customerId,
        provider: media.provider,
        storageKey,
        requestedBy: actorId,
      },
      $set: {
        status: "pending",
        nextAttemptAt: new Date(),
        lastErrorCode: "",
      },
    },
    { upsert: true, ...options },
  );
  await AuditLog.create(
    [
      {
        actorId,
        actorRole: normalizeActorRole(actorRole),
        action: "request_f1_media_deletion",
        targetType: "f1_media",
        targetId: media._id,
        metadata: {
          customerId: String(media.customerId),
          requestId: requestContext.requestId || "",
        },
        ipAddress: requestContext.ipAddress || "",
        userAgent: requestContext.userAgent || "",
      },
    ],
    options,
  );
  return updated;
};

const claimDeletionJob = (now) =>
  F1MediaDeletionJob.findOneAndUpdate(
    {
      attempts: { $lt: DELETE_MAX_ATTEMPTS },
      nextAttemptAt: { $lte: now },
      $or: [
        { status: { $in: ["pending", "failed"] } },
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

export const processF1MediaDeletionBatch = async ({
  batchSize = 10,
  now = new Date(),
} = {}) => {
  const result = { claimed: 0, deleted: 0, failed: 0 };
  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimDeletionJob(now);
    if (!job) break;
    result.claimed += 1;
    try {
      const deletion = await deleteObject({
        provider: job.provider,
        storageKey: job.storageKey,
      });
      if (!deletion.deleted) {
        throw lifecycleError(
          "Storage provider did not confirm deletion",
          "F1_MEDIA_DELETE_UNCONFIRMED",
          502,
        );
      }
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await F1Media.updateOne(
            { _id: job.mediaId },
            {
              $set: {
                status: "deleted",
                deletedAt: new Date(),
                storageKey: "",
                publicId: "",
                url: "",
                failureCode: "",
              },
              $inc: { revision: 1 },
            },
            { session },
          );
          await F1MediaDeletionJob.updateOne(
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
        });
      } finally {
        await session.endSession();
      }
      incrementMetric("f1.media_deleted");
      result.deleted += 1;
    } catch (error) {
      incrementMetric("f1.media_cleanup_failed");
      result.failed += 1;
      await F1MediaDeletionJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "failed",
            nextAttemptAt: nextRetryAt(job.attempts),
            lastErrorCode: String(
              error.code || "F1_MEDIA_DELETE_FAILED",
            ).slice(0, 100),
          },
        },
      );
      safeLog.error("f1.media.cleanup_failed", error, {
        mediaId: String(job.mediaId),
        attempt: job.attempts,
      });
    }
  }
  return result;
};

export const scanF1MediaIntegrity = async ({ limit = 50 } = {}) => {
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
  const [stalePending, readyWithoutKey, deletionWithoutJob, readyMedia] =
    await Promise.all([
      F1Media.find({
        status: "pending_upload",
        createdAt: { $lte: staleBefore },
      })
        .select("_id")
        .limit(limit)
        .lean(),
      F1Media.find({ status: "ready", storageKey: "" })
        .select("_id")
        .limit(limit)
        .lean(),
      F1Media.aggregate([
        { $match: { status: "delete_pending" } },
        {
          $lookup: {
            from: F1MediaDeletionJob.collection.name,
            localField: "_id",
            foreignField: "mediaId",
            as: "jobs",
          },
        },
        { $match: { jobs: { $size: 0 } } },
        { $limit: limit },
        { $project: { _id: 1 } },
      ]),
      F1Media.find({ status: "ready", storageKey: { $ne: "" } })
        .select("_id provider storageKey format")
        .limit(Math.min(limit, 20)),
    ]);

  const missingProviderObjects = [];
  for (const media of readyMedia) {
    const metadata = await getMetadata(media);
    if (!metadata) missingProviderObjects.push(media._id);
  }
  const totalIssues =
    stalePending.length +
    readyWithoutKey.length +
    deletionWithoutJob.length +
    missingProviderObjects.length;
  if (totalIssues > 0) incrementMetric("f1.media_orphans", totalIssues);
  return {
    stalePending: stalePending.map((item) => item._id),
    readyWithoutKey: readyWithoutKey.map((item) => item._id),
    deletionWithoutJob: deletionWithoutJob.map((item) => item._id),
    missingProviderObjects,
    totalIssues,
  };
};

export const F1_MEDIA_QUOTAS = {
  maxPerCustomer: MAX_MEDIA_PER_CUSTOMER,
  maxPerScopeType: MAX_MEDIA_PER_SCOPE_TYPE,
  maxStorageBytesPerCustomer: MAX_STORAGE_BYTES_PER_CUSTOMER,
};
