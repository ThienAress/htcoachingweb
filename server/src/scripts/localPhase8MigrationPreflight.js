import crypto from "node:crypto";
import mongoose from "mongoose";
import {
  preflightPhase8,
  runPhase8Migration,
} from "../migrations/20260720-phase8-f1-private-integrity.js";
import F1Media from "../models/F1Media.js";

const EXPECTED_HOST = "127.0.0.1";
const EXPECTED_PORT = "27019";
const EXPECTED_DATABASE = "htcoaching_f1_migration_preflight";

const parseExpectedMissingMedia = () => {
  const value = Number(process.env.EXPECTED_PHASE8_MISSING_MEDIA);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Set EXPECTED_PHASE8_MISSING_MEDIA to the approved count");
  }
  return value;
};

const assertLocalTarget = () => {
  if (process.env.ALLOW_LOCAL_PHASE8_MIGRATION_PREFLIGHT !== "true") {
    throw new Error(
      "Set ALLOW_LOCAL_PHASE8_MIGRATION_PREFLIGHT=true for the isolated preflight",
    );
  }
  const target = new URL(process.env.MONGO_URI || "");
  if (
    target.protocol !== "mongodb:" ||
    target.hostname !== EXPECTED_HOST ||
    target.port !== EXPECTED_PORT ||
    target.pathname !== `/${EXPECTED_DATABASE}` ||
    target.username ||
    target.password
  ) {
    throw new Error(
      "Phase 8 preflight target must be the approved isolated local database",
    );
  }
};

const documentIdentityFingerprint = async () => {
  const hash = crypto.createHash("sha256");
  const collections = (await mongoose.connection.db.listCollections().toArray())
    .map((collection) => collection.name)
    .filter((name) => name.startsWith("f1"))
    .sort();
  for (const name of collections) {
    const ids = await mongoose.connection.db
      .collection(name)
      .find({}, { projection: { _id: 1 } })
      .sort({ _id: 1 })
      .toArray();
    hash.update(name);
    hash.update(JSON.stringify(ids));
  }
  return { collections, fingerprint: hash.digest("hex") };
};

assertLocalTarget();
const expectedMissingMedia = parseExpectedMissingMedia();

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
try {
  if (
    mongoose.connection.host !== EXPECTED_HOST ||
    mongoose.connection.port !== Number(EXPECTED_PORT) ||
    mongoose.connection.name !== EXPECTED_DATABASE
  ) {
    throw new Error(
      "Connected Phase 8 preflight database does not match the local guard",
    );
  }

  const beforeIdentity = await documentIdentityFingerprint();
  const preflight = await preflightPhase8();
  if (preflight.assessmentConflicts.length > 0) {
    throw new Error("Phase 8 preflight found duplicate assessment blockers");
  }
  if (preflight.missingLegacyMediaIds.length !== expectedMissingMedia) {
    throw new Error(
      `Phase 8 expected ${expectedMissingMedia} missing media records but found ${preflight.missingLegacyMediaIds.length}`,
    );
  }

  const first = await runPhase8Migration({
    migrateMedia: false,
    verifyProviderObjects: false,
    missingMediaStrategy: "mark_failed",
  });
  const second = await runPhase8Migration({
    migrateMedia: false,
    verifyProviderObjects: false,
    missingMediaStrategy: "mark_failed",
  });
  const [afterIdentity, failedMissingMedia, publicLegacyReferences] =
    await Promise.all([
      documentIdentityFingerprint(),
      F1Media.countDocuments({
        status: "failed",
        failureCode: "PHASE8_MEDIA_SOURCE_MISSING",
      }),
      F1Media.countDocuments({
        $or: [{ url: { $regex: /.+/ } }, { publicId: { $regex: /.+/ } }],
      }),
    ]);

  const identityUnchanged =
    beforeIdentity.fingerprint === afterIdentity.fingerprint;
  const valid =
    first.migrated.failedMissingMedia === expectedMissingMedia &&
    first.verification.totalIssues === 0 &&
    second.migrated.failedMissingMedia === 0 &&
    second.verification.totalIssues === 0 &&
    failedMissingMedia === expectedMissingMedia &&
    publicLegacyReferences === 0 &&
    identityUnchanged;

  process.stdout.write(
    `${JSON.stringify(
      {
        target: {
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          database: mongoose.connection.name,
          localOnly: true,
        },
        collections: beforeIdentity.collections.length,
        before: {
          missingLegacyMedia: preflight.missingLegacyMediaIds.length,
          assessmentConflicts: preflight.assessmentConflicts.length,
        },
        firstRun: {
          failedMissingMedia: first.migrated.failedMissingMedia,
          reportsBackfilled: first.migrated.reports,
          forecastsBackfilled: first.migrated.forecasts,
          predictionsBackfilled: first.migrated.predictions,
          verificationIssues: first.verification.totalIssues,
        },
        secondRun: {
          failedMissingMedia: second.migrated.failedMissingMedia,
          verificationIssues: second.verification.totalIssues,
        },
        after: { failedMissingMedia, publicLegacyReferences },
        documentIdentityUnchanged: identityUnchanged,
        valid,
      },
      null,
      2,
    )}\n`,
  );

  if (!valid) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
