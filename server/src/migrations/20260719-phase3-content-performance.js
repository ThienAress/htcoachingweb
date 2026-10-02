import "../config/env.js";
import mongoose from "mongoose";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";

import BlogPost from "../models/BlogPost.js";
import Order from "../models/Order.js";
import Recipe from "../models/Recipe.js";

const LEGACY_MEALDB_QUERY = {
  source: "mealdb",
  isPublished: { $exists: false },
};

export const inspectLegacyRecipePublication = async () => {
  const candidates = await Recipe.collection.find(LEGACY_MEALDB_QUERY).toArray();
  let invalidCandidates = 0;
  const validationErrorFields = {};

  for (const document of candidates) {
    const validationError = new Recipe(document).validateSync();
    if (!validationError) continue;
    invalidCandidates += 1;
    for (const field of Object.keys(validationError.errors)) {
      validationErrorFields[field] = (validationErrorFields[field] || 0) + 1;
    }
  }

  const duplicateSlugs = await Recipe.collection
    .aggregate([
      { $match: { source: "mealdb" } },
      { $group: { _id: "$slug", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: "groups" },
    ])
    .toArray();

  return {
    candidates: candidates.length,
    validCandidates: candidates.length - invalidCandidates,
    invalidCandidates,
    validationErrorFields,
    duplicateSlugGroups: duplicateSlugs[0]?.groups || 0,
  };
};

export const runPhase3ContentMigration = async () => {
  const recipePreflight = await inspectLegacyRecipePublication();
  if (
    recipePreflight.invalidCandidates > 0 ||
    recipePreflight.duplicateSlugGroups > 0
  ) {
    const error = new Error("Phase 3 recipe publication preflight failed");
    error.code = "PHASE3_RECIPE_PREFLIGHT_FAILED";
    error.report = recipePreflight;
    throw error;
  }

  const publishedMealDb = await Recipe.collection.updateMany(
    LEGACY_MEALDB_QUERY,
    { $set: { isPublished: true } },
  );
  const draftedOtherSources = await Recipe.collection.updateMany(
    {
      source: { $ne: "mealdb" },
      isPublished: { $exists: false },
    },
    { $set: { isPublished: false } },
  );

  await BlogPost.collection.createIndex(
    { status: 1, views: -1, publishedAt: -1 },
    { name: "status_1_views_-1_publishedAt_-1" },
  );
  await BlogPost.collection.createIndex(
    { status: 1, category: 1, views: -1, publishedAt: -1 },
    { name: "status_1_category_1_views_-1_publishedAt_-1" },
  );
  await Order.collection.createIndex(
    { trainerId: 1, status: 1, sessions: 1 },
    { name: "trainerId_1_status_1_sessions_1" },
  );

  return {
    recipes: {
      preflight: recipePreflight,
      publishedMealDb: publishedMealDb.modifiedCount,
      draftedOtherSources: draftedOtherSources.modifiedCount,
    },
  };
};

const runFromCli = async () => {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_PHASE3_CONTENT_MIGRATION",
  });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runPhase3ContentMigration();
    console.log("Phase 3 content/performance migration completed");
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1]?.endsWith("20260719-phase3-content-performance.js")) {
  runFromCli();
}
