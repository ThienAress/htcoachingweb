import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import F1Customer from "../models/F1Customer.js";
import F1DataDeletionJob from "../models/F1DataDeletionJob.js";
import F1Media from "../models/F1Media.js";
import F1MediaDeletionJob from "../models/F1MediaDeletionJob.js";
import WebVitalSample from "../models/WebVitalSample.js";

const INDEX_MODELS = [
  F1Customer,
  F1DataDeletionJob,
  F1Media,
  F1MediaDeletionJob,
  WebVitalSample,
];

const retentionDays = () => {
  const value = Number(process.env.F1_RETENTION_DAYS || 365);
  if (!Number.isInteger(value) || value < 30 || value > 3650) {
    throw new Error("F1_RETENTION_DAYS must be an integer between 30 and 3650");
  }
  return value;
};

const hasWebVitalTtlIndex = async () => {
  const indexes = await WebVitalSample.collection.indexes().catch(() => []);
  return indexes.some(
    (index) =>
      index.key?.expiresAt === 1 && Number(index.expireAfterSeconds) === 0,
  );
};

const hasWebVitalBaselineIndex = async () => {
  const indexes = await WebVitalSample.collection.indexes().catch(() => []);
  return indexes.some(
    (index) =>
      index.key?.createdAt === -1 && Object.keys(index.key || {}).length === 1,
  );
};

export const verifyPhase9PrivacyOperations = async () => {
  const [
    archivedWithoutRetention,
    deletionJobsWithoutRole,
    readyMediaWithoutPrivateKey,
    mediaWithPublicReference,
    hasVitalTtl,
    hasVitalBaselineIndex,
  ] = await Promise.all([
    F1Customer.countDocuments({
      status: "archived",
      deletedAt: null,
      $or: [
        { retentionExpiresAt: null },
        { retentionExpiresAt: { $exists: false } },
      ],
    }),
    F1DataDeletionJob.countDocuments({
      $or: [
        { requestedByRole: null },
        { requestedByRole: { $exists: false } },
      ],
    }),
    F1Media.countDocuments({
      status: "ready",
      $or: [
        { storageKey: "" },
        { storageKey: null },
        { storageKey: { $exists: false } },
      ],
    }),
    F1Media.countDocuments({
      $or: [
        { url: { $regex: /.+/ } },
        { publicId: { $regex: /.+/ } },
      ],
    }),
    hasWebVitalTtlIndex(),
    hasWebVitalBaselineIndex(),
  ]);
  const issues = {
    archivedWithoutRetention,
    deletionJobsWithoutRole,
    readyMediaWithoutPrivateKey,
    mediaWithPublicReference,
    missingWebVitalTtlIndex: hasVitalTtl ? 0 : 1,
    missingWebVitalBaselineIndex: hasVitalBaselineIndex ? 0 : 1,
  };
  return {
    issues,
    totalIssues: Object.values(issues).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    ),
  };
};

export const runPhase9Migration = async () => {
  const days = retentionDays();
  const retentionMs = days * 24 * 60 * 60 * 1000;
  const retention = await F1Customer.updateMany(
    {
      status: "archived",
      deletedAt: null,
      $or: [
        { retentionExpiresAt: null },
        { retentionExpiresAt: { $exists: false } },
      ],
    },
    [
      {
        $set: {
          archivedAt: {
            $ifNull: ["$archivedAt", "$updatedAt"],
          },
          retentionExpiresAt: {
            $add: [
              { $ifNull: ["$archivedAt", "$updatedAt"] },
              retentionMs,
            ],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
  const deletionRoles = await F1DataDeletionJob.updateMany(
    {
      $or: [
        { requestedByRole: null },
        { requestedByRole: { $exists: false } },
      ],
    },
    { $set: { requestedByRole: "admin" } },
  );
  const webVitalExpiry = await WebVitalSample.updateMany(
    {
      $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
      ],
    },
    [
      {
        $set: {
          expiresAt: {
            $add: ["$createdAt", 30 * 24 * 60 * 60 * 1000],
          },
        },
      },
    ],
    { updatePipeline: true },
  );
  for (const Model of INDEX_MODELS) await Model.createIndexes();
  return {
    migrated: {
      retention: retention.modifiedCount,
      deletionRoles: deletionRoles.modifiedCount,
      webVitalExpiry: webVitalExpiry.modifiedCount,
      retentionDays: days,
    },
    verification: await verifyPhase9PrivacyOperations(),
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_PHASE9_PRIVACY_MIGRATION",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runPhase9Migration();
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.verification.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
