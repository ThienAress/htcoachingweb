import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  assertConnectedMigrationTarget,
  getMongoDatabaseName,
} from "../config/migrationSafety.js";
import CoachingDay from "../models/CoachingDay.js";
import {
  collectCoachingMediaDeletionInventory,
  isPrivateCoachingMedia,
} from "../services/coachingPrivateMedia.service.js";

const classifyLegacySource = (value) => {
  const inventory = collectCoachingMediaDeletionInventory({
    clientFeedbackVideo: value,
    exercises: [],
  });
  const asset = inventory.assets[0] || null;
  if (isPrivateCoachingMedia(value)) {
    return { sourceKind: "cleanup_pending", storageKey: value.storageKey };
  }
  if (asset?.provider === "local") {
    return { sourceKind: "legacy_local", storageKey: asset.storageKey };
  }
  if (asset?.provider === "cloudinary" && asset.deliveryType === "upload") {
    return { sourceKind: "cloudinary_public", storageKey: asset.storageKey };
  }
  return { sourceKind: "external_unknown", storageKey: null };
};

const toCandidate = ({ plan, value, location, exerciseId = null }) => {
  const classification = classifyLegacySource(value);
  return {
    planId: String(plan._id),
    location,
    exerciseId: exerciseId ? String(exerciseId) : null,
    ...classification,
    sourceUrl: typeof value === "string" ? value : "",
    media: isPrivateCoachingMedia(value) ? value : null,
  };
};

export const inspectLegacyCoachingFeedbackMedia = async ({ limit = 1000 } = {}) => {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) {
    throw new Error("Legacy coaching media scan limit must be 1..5000");
  }
  const plans = await CoachingDay.find({
    $or: [
      { clientFeedbackVideo: { $type: "string", $nin: ["", null] } },
      {
        "exercises.clientFeedbackVideo": {
          $type: "string",
          $nin: ["", null],
        },
      },
      { "clientFeedbackVideo.legacyPublicId": { $type: "string" } },
      {
        "exercises.clientFeedbackVideo.legacyPublicId": { $type: "string" },
      },
    ],
  })
    .select("clientFeedbackVideo exercises._id exercises.clientFeedbackVideo")
    .sort({ _id: 1 })
    .limit(limit)
    .lean();

  const candidates = [];
  for (const plan of plans) {
    if (
      (typeof plan.clientFeedbackVideo === "string" && plan.clientFeedbackVideo) ||
      (isPrivateCoachingMedia(plan.clientFeedbackVideo) &&
        plan.clientFeedbackVideo.legacyPublicId)
    ) {
      candidates.push(
        toCandidate({
          plan,
          value: plan.clientFeedbackVideo,
          location: "clientFeedbackVideo",
        }),
      );
    }
    for (const exercise of plan.exercises || []) {
      if (
        (typeof exercise.clientFeedbackVideo === "string" &&
          exercise.clientFeedbackVideo) ||
        (isPrivateCoachingMedia(exercise.clientFeedbackVideo) &&
          exercise.clientFeedbackVideo.legacyPublicId)
      ) {
        candidates.push(
          toCandidate({
            plan,
            value: exercise.clientFeedbackVideo,
            location: "exercises.clientFeedbackVideo",
            exerciseId: exercise._id,
          }),
        );
      }
    }
  }
  return candidates;
};

export const summarizeLegacyCoachingFeedbackMedia = (candidates) => ({
  total: candidates.length,
  cloudinaryPublic: candidates.filter(
    ({ sourceKind }) => sourceKind === "cloudinary_public",
  ).length,
  legacyLocal: candidates.filter(
    ({ sourceKind }) => sourceKind === "legacy_local",
  ).length,
  externalUnknown: candidates.filter(
    ({ sourceKind }) => sourceKind === "external_unknown",
  ).length,
  cleanupPending: candidates.filter(
    ({ sourceKind }) => sourceKind === "cleanup_pending",
  ).length,
});

const sanitizeCandidatesForOutput = (candidates) =>
  candidates.map(({ planId, location, exerciseId, sourceKind }) => ({
    planId,
    location,
    exerciseId,
    sourceKind,
  }));

export const authorizeCoachingMediaDryRunTarget = ({
  args,
  env = process.env,
}) => {
  if (args.has("--apply")) {
    throw new Error(
      "This migration is inventory-only; apply requires a separate approved runbook",
    );
  }
  const target = [...args]
    .find((argument) => argument.startsWith("--target="))
    ?.slice("--target=".length);
  if (!new Set(["staging", "production"]).has(target)) {
    throw new Error("Use an explicit --target=staging or --target=production");
  }
  if (env.APP_ENV !== target) {
    throw new Error("Coaching media scan target does not match APP_ENV");
  }
  const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
  const targetDatabase = String(env.MIGRATION_TARGET_DATABASE || "").trim();
  if (!uriDatabase || uriDatabase !== targetDatabase) {
    throw new Error("Coaching media scan database target lock failed");
  }
  return { valid: true, targetDatabase };
};

const main = async () => {
  const args = new Set(process.argv.slice(2));
  const authorization = authorizeCoachingMediaDryRunTarget({ args });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const candidates = await inspectLegacyCoachingFeedbackMedia();
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "dry-run",
          success: true,
          summary: summarizeLegacyCoachingFeedbackMedia(candidates),
          candidates: sanitizeCandidatesForOutput(candidates),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
