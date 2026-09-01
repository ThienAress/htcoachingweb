import AccountDeletionMediaJob from "../models/AccountDeletionMediaJob.js";
import { createRecurringJob } from "../operations/recurringJob.js";
import {
  deleteCoachingMediaAsset,
  isDeletableCoachingMedia,
} from "./coachingPrivateMedia.service.js";

const retryAt = (attempts, now) =>
  new Date(now.getTime() + Math.min(2 ** Math.min(attempts, 8), 360) * 60_000);
const CLAIM_TIMEOUT_MS = Math.max(
  Number(process.env.ACCOUNT_DELETION_MEDIA_CLAIM_TIMEOUT_MS || 10 * 60 * 1000),
  30_000,
);

const safeErrorCode = (error) =>
  String(error?.code || error?.name || "PROVIDER_FAILURE")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 80);

export const enqueueAccountDeletionMedia = async ({
  targetUserId,
  assets,
  session,
}) => {
  const uniqueAssets = new Map();
  for (const asset of assets || []) {
    if (isDeletableCoachingMedia(asset)) {
      uniqueAssets.set(`${asset.provider}:${asset.storageKey}`, asset);
    }
  }
  if (uniqueAssets.size === 0) return 0;

  const result = await AccountDeletionMediaJob.bulkWrite(
    [...uniqueAssets.values()].map((asset) => ({
      updateOne: {
        filter: {
          targetUserId,
          "asset.provider": asset.provider,
          "asset.storageKey": asset.storageKey,
        },
        update: {
          $setOnInsert: {
            targetUserId,
            asset,
            status: "pending",
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
    { ordered: false, session },
  );
  return result.upsertedCount;
};

export const processAccountDeletionMediaJobs = async ({
  targetUserId = null,
  batchSize = 20,
  now = new Date(),
} = {}) => {
  const filter = {
    nextAttemptAt: { $lte: now },
    $or: [
      { status: { $in: ["pending", "failed"] } },
      {
        status: "processing",
        claimedAt: { $lte: new Date(now.getTime() - CLAIM_TIMEOUT_MS) },
      },
    ],
    ...(targetUserId ? { targetUserId } : {}),
  };
  const candidates = await AccountDeletionMediaJob.find(filter)
    .select("_id")
    .sort({ nextAttemptAt: 1, _id: 1 })
    .limit(Math.min(Math.max(Number(batchSize) || 20, 1), 100))
    .lean();
  const summary = { completed: 0, failed: 0 };

  for (const candidate of candidates) {
    const job = await AccountDeletionMediaJob.findOneAndUpdate(
      {
        _id: candidate._id,
        nextAttemptAt: { $lte: now },
        $or: [
          { status: { $in: ["pending", "failed"] } },
          {
            status: "processing",
            claimedAt: { $lte: new Date(now.getTime() - CLAIM_TIMEOUT_MS) },
          },
        ],
      },
      {
        $set: { status: "processing", claimedAt: now },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after" },
    );
    if (!job) continue;

    try {
      const providerResult = await deleteCoachingMediaAsset(job.asset);
      if (!providerResult?.deleted && !providerResult?.notFound) {
        throw Object.assign(new Error("Provider did not confirm media deletion"), {
          code: "PROVIDER_DELETE_UNCONFIRMED",
        });
      }
      await AccountDeletionMediaJob.updateOne(
        { _id: job._id, status: "processing", claimedAt: job.claimedAt },
        {
          $set: {
            status: "completed",
            completedAt: now,
            claimedAt: null,
            lastErrorCode: "",
          },
        },
      );
      summary.completed += 1;
    } catch (error) {
      await AccountDeletionMediaJob.updateOne(
        { _id: job._id, status: "processing", claimedAt: job.claimedAt },
        {
          $set: {
            status: "failed",
            nextAttemptAt: retryAt(job.attempts, now),
            claimedAt: null,
            lastErrorCode: safeErrorCode(error),
          },
        },
      );
      summary.failed += 1;
    }
  }

  return summary;
};

let lifecycleJob = null;

export const startAccountDeletionMediaCron = () => {
  if (!lifecycleJob) {
    const intervalMs = Math.max(
      Number(process.env.ACCOUNT_DELETION_MEDIA_INTERVAL_MS || 5 * 60 * 1000),
      30_000,
    );
    lifecycleJob = createRecurringJob({
      name: "account_deletion_media",
      intervalMs,
      task: () => processAccountDeletionMediaJobs(),
    });
  }
  return lifecycleJob.start();
};

export const stopAccountDeletionMediaCron = () => {
  const stopped = lifecycleJob?.stop() || Promise.resolve();
  lifecycleJob = null;
  return stopped;
};

export const stopAccountDeletionMediaCronForTests =
  stopAccountDeletionMediaCron;
