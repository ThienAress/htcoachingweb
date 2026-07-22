import crypto from "crypto";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import Counter from "../models/Counter.js";
import F1AiReport from "../models/F1AiReport.js";
import F1Assessment from "../models/F1Assessment.js";
import F1Customer from "../models/F1Customer.js";
import F1DataDeletionJob from "../models/F1DataDeletionJob.js";
import F1Intake from "../models/F1Intake.js";
import F1Media from "../models/F1Media.js";
import F1MediaDeletionJob from "../models/F1MediaDeletionJob.js";
import F1OutcomeForecast from "../models/F1OutcomeForecast.js";
import F1ResultPrediction from "../models/F1ResultPrediction.js";
import {
  createF1MediaFromReference,
  scanF1MediaIntegrity,
} from "../services/f1MediaLifecycle.service.js";
import {
  fetchF1ImageReference,
  processF1Image,
} from "../services/f1MediaImage.service.js";
import { putProcessedImage } from "../services/f1MediaStorage.service.js";
import {
  destroyCloudinaryAsset,
  getCloudinaryPublicIdFromUrl,
} from "../utils/cloudinaryUpload.js";

const MODELS_WITH_PHASE8_INDEXES = [
  Counter,
  F1Customer,
  F1Intake,
  F1Media,
  F1MediaDeletionJob,
  F1DataDeletionJob,
  F1Assessment,
  F1AiReport,
  F1OutcomeForecast,
  F1ResultPrediction,
];

const legacyLocalPath = (media) => {
  const filename =
    String(media.url || "").split("/uploads/f1-media/")[1] ||
    media.publicId ||
    "";
  if (!filename) return null;
  return path.resolve("uploads/f1-media", path.basename(filename));
};

const isCloudinaryUrl = (value) =>
  /^https:\/\/res\.cloudinary\.com\//i.test(String(value || ""));

const getLegacyBuffer = async (media) => {
  if (
    String(media.url || "").startsWith("data:image/") ||
    isCloudinaryUrl(media.url)
  ) {
    return fetchF1ImageReference(media.url);
  }
  const absolute = legacyLocalPath(media);
  if (!absolute) {
    const error = new Error(`Legacy F1 media ${media._id} has no source`);
    error.code = "PHASE8_MEDIA_SOURCE_MISSING";
    throw error;
  }
  return fsPromises.readFile(absolute);
};

const duplicateAssessments = () =>
  F1Assessment.aggregate([
    { $group: { _id: "$intakeId", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 100 },
  ]);

const findMissingLocalMedia = async () => {
  const legacy = await F1Media.find({
    $or: [
      { storageKey: { $exists: false } },
      { storageKey: "" },
      { provider: { $exists: false } },
      { provider: "legacy_local" },
      { url: { $regex: /.+/ } },
    ],
  }).lean();
  const missing = [];
  for (const media of legacy) {
    if (isCloudinaryUrl(media.url) || String(media.url || "").startsWith("data:image/")) {
      continue;
    }
    const absolute = legacyLocalPath(media);
    if (!absolute) {
      missing.push(media._id);
      continue;
    }
    try {
      await fsPromises.access(absolute);
    } catch {
      missing.push(media._id);
    }
  }
  return { legacy, missing };
};

export const preflightPhase8 = async () => {
  const [assessmentConflicts, media] = await Promise.all([
    duplicateAssessments(),
    findMissingLocalMedia(),
  ]);
  return {
    assessmentConflicts,
    legacyMediaCount: media.legacy.length,
    missingLegacyMediaIds: media.missing,
    blockingIssues: assessmentConflicts.length + media.missing.length,
  };
};

const getMaxF1Code = async () => {
  const customers = await F1Customer.find({ code: /^F1-\d+$/ })
    .select("code")
    .lean();
  return customers.reduce((max, customer) => {
    const value = Number(String(customer.code).slice(3));
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
};

const seedCounter = async () => {
  const maxCode = await getMaxF1Code();
  await Counter.updateOne(
    { key: "f1_customer" },
    { $max: { value: maxCode }, $setOnInsert: { key: "f1_customer" } },
    { upsert: true },
  );
  return maxCode;
};

const cleanupLegacySource = async (media) => {
  if (isCloudinaryUrl(media.url)) {
    const publicId =
      media.publicId || getCloudinaryPublicIdFromUrl(media.url);
    if (publicId) await destroyCloudinaryAsset(publicId).catch(() => undefined);
    return;
  }
  const absolute = legacyLocalPath(media);
  if (absolute) await fsPromises.unlink(absolute).catch(() => undefined);
};

const migrateLegacyMedia = async (legacyMedia) => {
  let migrated = 0;
  for (const record of legacyMedia) {
    const current = await F1Media.findById(record._id);
    if (
      current?.status === "ready" &&
      current.storageKey &&
      !current.url &&
      current.provider !== "legacy_local"
    ) {
      continue;
    }
    const input = await getLegacyBuffer(record);
    const processed = await processF1Image(input);
    const stored = await putProcessedImage(processed.buffer, {
      customerId: String(record.customerId),
      mediaId: String(record._id),
      format: processed.format,
      checksum: processed.checksum,
    });
    await F1Media.updateOne(
      { _id: record._id },
      {
        $set: {
          provider: stored.provider,
          storageKey: stored.storageKey,
          checksum: processed.checksum,
          format: processed.format,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          width: processed.width,
          height: processed.height,
          status: "ready",
          readyAt: record.readyAt || record.createdAt || new Date(),
          url: "",
          publicId: "",
          failureCode: "",
        },
      },
    );
    await cleanupLegacySource(record);
    migrated += 1;
  }
  return migrated;
};

const fingerprintFor = async (artifact, sourceFields) => {
  const parts = [];
  for (const [field, Model] of sourceFields) {
    const document = await Model.findById(artifact[field])
      .select("_id updatedAt")
      .lean();
    parts.push({
      id: String(document?._id || artifact[field] || ""),
      updatedAt: document?.updatedAt
        ? new Date(document.updatedAt).toISOString()
        : "",
    });
  }
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        engineVersion: artifact.engineVersion,
        source: parts,
      }),
    )
    .digest("hex");
};

const backfillArtifactModel = async (Model, sourceFields) => {
  const artifacts = await Model.find().sort({ customerId: 1, createdAt: 1 });
  const latestBySource = new Map();
  const sourceKeys = new Map();
  for (const artifact of artifacts) {
    const key = [
      String(artifact.customerId),
      ...sourceFields.map(([field]) => String(artifact[field] || "")),
      artifact.engineVersion,
    ].join(":");
    sourceKeys.set(String(artifact._id), key);
    latestBySource.set(key, String(artifact._id));
  }
  const versions = new Map();
  for (const artifact of artifacts) {
    const customerKey = String(artifact.customerId);
    const version = (versions.get(customerKey) || 0) + 1;
    versions.set(customerKey, version);
    const fingerprint = await fingerprintFor(artifact, sourceFields);
    const sourceKey = sourceKeys.get(String(artifact._id));
    const canonical = latestBySource.get(sourceKey) === String(artifact._id);
    await Model.updateOne(
      { _id: artifact._id },
      {
        $set: {
          sourceFingerprint: fingerprint,
          generationKey: canonical
            ? "canonical"
            : `legacy-${artifact._id}`,
          requestId:
            artifact.requestId || `legacy-${artifact._id}`,
          version,
        },
      },
    );
  }
  return artifacts.length;
};

const migrateGeneratedPredictionMedia = async () => {
  const predictions = await F1ResultPrediction.find({
    visualStages: {
      $elemMatch: {
        $or: [
          { "images.frontUrl": { $regex: /.+/ } },
          { "images.sideUrl": { $regex: /.+/ } },
        ],
      },
    },
  });
  let migrated = 0;
  for (const prediction of predictions) {
    const customer = await F1Customer.findById(prediction.customerId);
    if (!customer) continue;
    for (const stage of prediction.visualStages) {
      let changed = false;
      for (const view of ["front", "side"]) {
        const urlField = `${view}Url`;
        const mediaField = `${view}MediaId`;
        if (!stage.images?.[urlField] || stage.images?.[mediaField]) continue;
        const result = await createF1MediaFromReference({
          customerId: prediction.customerId,
          intakeId: prediction.intakeId,
          predictionId: prediction._id,
          phaseKey: stage.phaseKey,
          type: `prediction_${view}`,
          reference: stage.images[urlField],
          actorId: customer.createdBy,
          actorRole: "admin",
          requestContext: { requestId: "phase8-migration" },
        });
        stage.images[mediaField] = result.media._id;
        stage.images[urlField] = "";
        changed = true;
        migrated += 1;
      }
      if (changed) prediction.markModified("visualStages");
    }
    if (prediction.isModified("visualStages")) await prediction.save();
  }
  return migrated;
};

const backfillConsent = () =>
  F1Intake.updateMany(
    {
      "consent.version": { $in: [null, ""] },
      $or: [
        { "consent.allowDataStorage": true },
        { "consent.allowMediaStorage": true },
        { "consent.allowAiAnalysis": true },
      ],
    },
    [
      {
        $set: {
          "consent.version": "legacy-unversioned",
          "consent.collectedAt": { $ifNull: ["$submittedAt", "$updatedAt"] },
          "consent.collectedBy": { $ifNull: ["$updatedBy", "$createdBy"] },
        },
      },
    ],
    { updatePipeline: true },
  );

export const verifyPhase8Integrity = async ({
  verifyProviderObjects = false,
} = {}) => {
  const maxCode = await getMaxF1Code();
  const counter = await Counter.findOne({ key: "f1_customer" }).lean();
  const [
    assessmentConflicts,
    mediaWithoutPrivateKey,
    mediaWithPublicUrl,
    reportMissingIntegrity,
    forecastMissingIntegrity,
    predictionMissingIntegrity,
    predictionPublicUrls,
    lifecycleIssues,
  ] = await Promise.all([
    duplicateAssessments(),
    F1Media.countDocuments({ status: "ready", storageKey: "" }),
    F1Media.countDocuments({
      $or: [{ url: { $regex: /.+/ } }, { publicId: { $regex: /.+/ } }],
    }),
    F1AiReport.countDocuments({
      $or: [
        { sourceFingerprint: { $in: [null, ""] } },
        { requestId: { $in: [null, ""] } },
        { version: null },
      ],
    }),
    F1OutcomeForecast.countDocuments({
      $or: [
        { sourceFingerprint: { $in: [null, ""] } },
        { requestId: { $in: [null, ""] } },
        { version: null },
      ],
    }),
    F1ResultPrediction.countDocuments({
      $or: [
        { sourceFingerprint: { $in: [null, ""] } },
        { requestId: { $in: [null, ""] } },
        { version: null },
      ],
    }),
    F1ResultPrediction.countDocuments({
      visualStages: {
        $elemMatch: {
          $or: [
            { "images.frontUrl": { $regex: /.+/ } },
            { "images.sideUrl": { $regex: /.+/ } },
          ],
        },
      },
    }),
    verifyProviderObjects
      ? scanF1MediaIntegrity({ limit: 100 })
      : Promise.resolve({ totalIssues: 0 }),
  ]);
  const issues = {
    assessmentConflicts: assessmentConflicts.length,
    mediaWithoutPrivateKey,
    mediaWithPublicUrl,
    counterBehind: Number(counter?.value || 0) < maxCode ? 1 : 0,
    reportMissingIntegrity,
    forecastMissingIntegrity,
    predictionMissingIntegrity,
    predictionPublicUrls,
    mediaLifecycleIssues: lifecycleIssues.totalIssues,
  };
  return {
    issues,
    totalIssues: Object.values(issues).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    ),
    maxCode,
    counterValue: Number(counter?.value || 0),
  };
};

export const runPhase8Migration = async ({
  migrateMedia = true,
  verifyProviderObjects = false,
} = {}) => {
  const preflight = await preflightPhase8();
  if (preflight.blockingIssues > 0) {
    const error = new Error(
      "Phase 8 preflight failed. Resolve duplicate assessments and missing legacy media first.",
    );
    error.preflight = preflight;
    throw error;
  }
  const seededCounter = await seedCounter();
  const media = migrateMedia
    ? await migrateLegacyMedia((await findMissingLocalMedia()).legacy)
    : 0;
  await backfillConsent();
  const reports = await backfillArtifactModel(F1AiReport, [
    ["intakeId", F1Intake],
    ["assessmentId", F1Assessment],
  ]);
  const forecasts = await backfillArtifactModel(F1OutcomeForecast, [
    ["intakeId", F1Intake],
    ["assessmentId", F1Assessment],
    ["aiReportId", F1AiReport],
  ]);
  const predictions = await backfillArtifactModel(F1ResultPrediction, [
    ["intakeId", F1Intake],
    ["assessmentId", F1Assessment],
    ["aiReportId", F1AiReport],
  ]);
  const generatedMedia = migrateMedia
    ? await migrateGeneratedPredictionMedia()
    : 0;
  for (const Model of MODELS_WITH_PHASE8_INDEXES) {
    await Model.createIndexes();
  }
  const verification = await verifyPhase8Integrity({
    verifyProviderObjects,
  });
  return {
    preflight,
    migrated: {
      seededCounter,
      media,
      reports,
      forecasts,
      predictions,
      generatedMedia,
    },
    verification,
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  if (process.env.CONFIRM_PHASE8_F1_MIGRATION !== "yes") {
    throw new Error(
      "Set CONFIRM_PHASE8_F1_MIGRATION=yes after backup and preflight review.",
    );
  }
  await connectDB();
  try {
    const result = await runPhase8Migration({
      migrateMedia: true,
      verifyProviderObjects: true,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
