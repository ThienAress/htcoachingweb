import crypto from "node:crypto";
import mongoose from "mongoose";
import F1AiReport from "../models/F1AiReport.js";
import F1AiRule from "../models/F1AiRule.js";
import F1Assessment from "../models/F1Assessment.js";
import F1Customer from "../models/F1Customer.js";
import F1DataDeletionJob from "../models/F1DataDeletionJob.js";
import F1Intake from "../models/F1Intake.js";
import F1Media from "../models/F1Media.js";
import F1MediaDeletionJob from "../models/F1MediaDeletionJob.js";
import F1OutcomeForecast from "../models/F1OutcomeForecast.js";
import F1ResultPrediction from "../models/F1ResultPrediction.js";
import {
  preflightPhase8,
  verifyPhase8Integrity,
} from "../migrations/20260720-phase8-f1-private-integrity.js";
import { runF1RetentionSweep } from "../services/f1PrivacyLifecycle.service.js";

const EXPECTED_HOST = "127.0.0.1";
const EXPECTED_DATABASE = "htcoaching_f1_dryrun";

const assertLocalTarget = () => {
  if (process.env.ALLOW_LOCAL_F1_DRY_RUN !== "true") {
    throw new Error("Set ALLOW_LOCAL_F1_DRY_RUN=true for the isolated dry-run");
  }
  const target = new URL(process.env.MONGO_URI || "");
  if (
    target.protocol !== "mongodb:" ||
    target.hostname !== EXPECTED_HOST ||
    target.port !== "27019" ||
    target.pathname !== `/${EXPECTED_DATABASE}`
  ) {
    throw new Error("F1 dry-run target must be the approved isolated local database");
  }
};

const fingerprintCollections = async (collections) => {
  const hash = crypto.createHash("sha256");
  for (const name of collections) {
    const documents = await mongoose.connection.db
      .collection(name)
      .find({})
      .sort({ _id: 1 })
      .toArray();
    hash.update(name);
    hash.update(JSON.stringify(documents));
  }
  return hash.digest("hex");
};

const statusCounts = async (Model) => {
  const groups = await Model.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(
    groups.map((group) => [group._id || "unknown", group.count]),
  );
};

const mediaSourceProfiles = async () => {
  const profiles = new Map();
  const documents = await F1Media.find()
    .select("provider status storageKey url publicId")
    .lean();
  for (const media of documents) {
    let urlKind = "none";
    if (String(media.url || "").startsWith("data:image/")) urlKind = "data";
    else if (/^https:\/\/res\.cloudinary\.com\//i.test(media.url || "")) {
      urlKind = "cloudinary";
    } else if (media.url) urlKind = "other";
    const profile = JSON.stringify({
      provider: media.provider || "missing",
      status: media.status || "missing",
      hasStorageKey: Boolean(media.storageKey),
      urlKind,
      publicIdKind: String(media.publicId || "").startsWith("htcoaching/")
        ? "cloudinary_namespace"
        : media.publicId
          ? "other"
          : "none",
    });
    profiles.set(profile, (profiles.get(profile) || 0) + 1);
  }
  return [...profiles].map(([profile, count]) => ({
    ...JSON.parse(profile),
    count,
  }));
};

assertLocalTarget();
process.env.F1_RETENTION_ENFORCE = "false";

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
try {
  if (
    mongoose.connection.host !== EXPECTED_HOST ||
    mongoose.connection.name !== EXPECTED_DATABASE
  ) {
    throw new Error("Connected F1 dry-run database does not match the local guard");
  }

  const models = [
    F1Customer,
    F1Intake,
    F1Assessment,
    F1AiReport,
    F1AiRule,
    F1OutcomeForecast,
    F1ResultPrediction,
    F1Media,
    F1DataDeletionJob,
    F1MediaDeletionJob,
  ];
  const collections = (await mongoose.connection.db.listCollections().toArray())
    .map((collection) => collection.name)
    .filter((name) => name.startsWith("f1"))
    .sort();
  const before = await fingerprintCollections(collections);
  const schema = { collections: 0, documents: 0, invalid: 0 };

  for (const Model of models) {
    const documents = await Model.collection.find({}).toArray();
    schema.collections += 1;
    schema.documents += documents.length;
    for (const document of documents) {
      if (new Model(document).validateSync()) schema.invalid += 1;
    }
  }

  const phase8Preflight = await preflightPhase8();
  const phase8 = await verifyPhase8Integrity({
    verifyProviderObjects: false,
  });
  const retention = await runF1RetentionSweep({
    enforce: false,
    now: new Date(),
  });
  const [customers, media, deletionJobs, mediaSources] = await Promise.all([
    statusCounts(F1Customer),
    statusCounts(F1Media),
    statusCounts(F1DataDeletionJob),
    mediaSourceProfiles(),
  ]);
  const after = await fingerprintCollections(collections);

  process.stdout.write(
    `${JSON.stringify(
      {
        target: {
          host: mongoose.connection.host,
          database: mongoose.connection.name,
          localOnly: true,
        },
        restoredCollections: collections.length,
        schema,
        phase8Preflight: {
          legacyMediaCount: phase8Preflight.legacyMediaCount,
          missingLegacyMedia: phase8Preflight.missingLegacyMediaIds.length,
          assessmentConflicts: phase8Preflight.assessmentConflicts.length,
          blockingIssues: phase8Preflight.blockingIssues,
        },
        phase8,
        retention,
        aggregateCounts: { customers, media, deletionJobs },
        mediaSources,
        fingerprintUnchanged: before === after,
      },
      null,
      2,
    )}\n`,
  );

  if (schema.invalid > 0 || !retention.dryRun || before !== after) {
    process.exitCode = 1;
  }
} finally {
  await mongoose.disconnect();
}
