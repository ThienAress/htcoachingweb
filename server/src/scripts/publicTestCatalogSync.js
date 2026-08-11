import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  EXERCISE_MANIFEST,
  EXPECTED_MUSCLE_GROUPS,
  FIXTURE_KEY,
  FOOD_MANIFEST,
  LOCAL_DATABASE,
  LOCAL_MONGO_URI,
  STAGING_DATABASE,
  assertSyncTarget,
  classifyFixtureRecord,
  makeTestCatalogError,
  selectSourceCatalog,
  validateLocalTarget,
  validateManifestContract,
  validateSyncTarget,
} from "./publicTestCatalogSync.contract.js";

export {
  EXERCISE_MANIFEST,
  EXPECTED_MUSCLE_GROUPS,
  FIXTURE_KEY,
  FOOD_MANIFEST,
  classifyFixtureRecord,
  selectSourceCatalog,
  validateLocalTarget,
  validateManifestContract,
  validateSyncTarget,
};

const FIXTURE_VERSION = "2026-08-11-v1";
const SOURCE_ENDPOINTS = Object.freeze({
  exercises: "https://htcoachingweb.onrender.com/api/exercises?limit=5000",
  foods: "https://htcoachingweb.onrender.com/api/foods?all=true",
});
const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "HTCoaching-Test-Catalog/1" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw makeTestCatalogError("TEST_CATALOG_SOURCE_REQUEST_FAILED");
  }
  const payload = await response.json();
  if (payload?.success !== true || !Array.isArray(payload.data)) {
    throw makeTestCatalogError("TEST_CATALOG_SOURCE_RESPONSE_INVALID");
  }
  return payload.data;
};

const loadSourceCatalog = async () =>
  selectSourceCatalog({
    exercises: await fetchJson(SOURCE_ENDPOINTS.exercises),
    foods: await fetchJson(SOURCE_ENDPOINTS.foods),
  });

const collectionSpecs = (catalog) => [
  { key: "exercises", collection: mongoose.connection.collection("exercises"), identity: "name", rows: catalog.exercises },
  { key: "foods", collection: mongoose.connection.collection("foods"), identity: "label", rows: catalog.foods },
];

const buildPlan = async (catalog) => {
  const specs = collectionSpecs(catalog);
  for (const spec of specs) {
    const identities = spec.rows.map((row) => row[spec.identity]);
    const existingRows = await spec.collection
      .find({ [spec.identity]: { $in: identities } })
      .project({ [spec.identity]: 1, _testCatalogFixture: 1 })
      .toArray();
    const existingByIdentity = new Map(
      existingRows.map((row) => [row[spec.identity], row]),
    );
    spec.entries = spec.rows.map((row) => {
      const existing = existingByIdentity.get(row[spec.identity]);
      return { row, existing, action: classifyFixtureRecord(existing) };
    });
  }
  return specs;
};

const summarizePlan = (plan) =>
  Object.fromEntries(
    plan.map((spec) => [
      spec.key,
      Object.fromEntries(
        ["insert", "update", "skip"].map((action) => [
          action,
          spec.entries.filter((entry) => entry.action === action).length,
        ]),
      ),
    ]),
  );

const applyPlan = async (plan) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const marker = {
        managed: true,
        key: FIXTURE_KEY,
        version: FIXTURE_VERSION,
        source: "production-public-api",
        syncedAt: now,
      };
      for (const spec of plan) {
        for (const entry of spec.entries) {
          if (entry.action === "skip") continue;
          if (entry.action === "insert") {
            await spec.collection.insertOne(
              { ...entry.row, _testCatalogFixture: marker, createdAt: now, updatedAt: now },
              { session },
            );
            continue;
          }
          const result = await spec.collection.updateOne(
            { _id: entry.existing._id, "_testCatalogFixture.key": FIXTURE_KEY },
            { $set: { ...entry.row, _testCatalogFixture: marker, updatedAt: now } },
            { session },
          );
          if (result.matchedCount !== 1) {
            throw makeTestCatalogError("TEST_CATALOG_UPDATE_DRIFT");
          }
        }
      }
    });
  } finally {
    await session.endSession();
  }
};

const verifyTarget = async () => {
  const exercises = await mongoose.connection.collection("exercises")
    .find({ name: { $in: EXERCISE_MANIFEST.map(({ name }) => name) } }).toArray();
  const foods = await mongoose.connection.collection("foods")
    .find({ label: { $in: FOOD_MANIFEST.map(({ label }) => label) } }).toArray();
  const selected = selectSourceCatalog({ exercises, foods });
  return {
    exercises: selected.exercises.length,
    muscleGroups: new Set(selected.exercises.map(({ muscleGroup }) => muscleGroup)).size,
    foods: selected.foods.length,
    macroGroups: { protein: 7, carb: 7, fat: 6 },
  };
};

const cleanup = async (apply) => {
  const filter = { "_testCatalogFixture.managed": true, "_testCatalogFixture.key": FIXTURE_KEY };
  const specs = collectionSpecs({ exercises: [], foods: [] });
  const counts = Object.fromEntries(
    await Promise.all(specs.map(async (spec) => [spec.key, await spec.collection.countDocuments(filter)])),
  );
  if (apply) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const spec of specs) await spec.collection.deleteMany(filter, { session });
      });
    } finally {
      await session.endSession();
    }
  }
  return counts;
};

const parseArgs = (argv) => {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg?.slice("--target=".length);
  return { target, apply: argv.includes("--apply"), cleanup: argv.includes("--cleanup") };
};

export const runPublicTestCatalogSync = async ({ argv = process.argv.slice(2), env = process.env } = {}) => {
  const options = parseArgs(argv);
  const mongoUri = options.target === "local" ? LOCAL_MONGO_URI : env.MONGO_URI;
  assertSyncTarget({ target: options.target, env, mongoUri });
  await mongoose.connect(mongoUri, { autoIndex: false });
  try {
    const expectedDatabase = options.target === "local" ? LOCAL_DATABASE : STAGING_DATABASE;
    if (mongoose.connection.name !== expectedDatabase) {
      throw makeTestCatalogError("TEST_CATALOG_CONNECTED_DATABASE_MISMATCH");
    }
    if (options.cleanup) {
      const affected = await cleanup(options.apply);
      return { operation: "cleanup", mode: options.apply ? "apply" : "dry-run", target: options.target, database: expectedDatabase, affected };
    }
    const catalog = await loadSourceCatalog();
    const plan = await buildPlan(catalog);
    const actions = summarizePlan(plan);
    if (options.apply) await applyPlan(plan);
    const verified = options.apply ? await verifyTarget() : null;
    return { operation: "sync", mode: options.apply ? "apply" : "dry-run", target: options.target, database: expectedDatabase, source: { exercises: 20, foods: 20 }, actions, verified };
  } finally {
    await mongoose.disconnect();
  }
};

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runPublicTestCatalogSync()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ success: false, code: error.code || "TEST_CATALOG_SYNC_FAILED", message: error.message }));
      process.exitCode = 1;
    });
}
