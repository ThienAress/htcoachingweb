import "../config/env.js";
import mongoose from "mongoose";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";

import Contract from "../models/Contract.js";
import F1Intake from "../models/F1Intake.js";
import Recipe from "../models/Recipe.js";

const normalizeSlug = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const assertNoDuplicates = async (
  collection,
  pipeline,
  invariantName,
) => {
  const duplicates = await collection.aggregate(pipeline).toArray();
  if (duplicates.length > 0) {
    const error = new Error(
      `Migration stopped: duplicate ${invariantName} records detected`,
    );
    error.duplicates = duplicates;
    throw error;
  }
};

const dropMatchingIndexes = async (collection, predicate) => {
  const indexes = await collection.indexes();
  for (const index of indexes) {
    if (index.name !== "_id_" && predicate(index)) {
      await collection.dropIndex(index.name);
    }
  }
};

const migrateContracts = async () => {
  await assertNoDuplicates(
    Contract.collection,
    [
      { $match: { status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: "$orderId",
          count: { $sum: 1 },
          contractIds: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ],
    "active contracts per order",
  );

  await Contract.collection.updateMany(
    {},
    [{ $set: { isActive: { $ne: ["$status", "cancelled"] } } }],
  );

  await dropMatchingIndexes(
    Contract.collection,
    (index) =>
      index.key?.orderId === 1 &&
      Object.keys(index.key).length === 1,
  );
  await Contract.collection.createIndex(
    { orderId: 1 },
    {
      name: "uniq_active_contract_per_order",
      unique: true,
      partialFilterExpression: { isActive: true },
    },
  );
};

const migrateF1Intakes = async () => {
  await assertNoDuplicates(
    F1Intake.collection,
    [
      {
        $group: {
          _id: { customerId: "$customerId", version: "$version" },
          count: { $sum: 1 },
          intakeIds: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ],
    "F1 intake versions",
  );
  await assertNoDuplicates(
    F1Intake.collection,
    [
      { $match: { isLatest: true } },
      {
        $group: {
          _id: "$customerId",
          count: { $sum: 1 },
          intakeIds: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ],
    "latest F1 intakes",
  );

  await dropMatchingIndexes(
    F1Intake.collection,
    (index) =>
      index.name === "customerId_1_version_-1" ||
      index.name === "uniq_f1_intake_customer_version" ||
      index.name === "uniq_latest_f1_intake_per_customer",
  );
  await F1Intake.collection.createIndex(
    { customerId: 1, version: -1 },
    { name: "uniq_f1_intake_customer_version", unique: true },
  );
  await F1Intake.collection.createIndex(
    { customerId: 1 },
    {
      name: "uniq_latest_f1_intake_per_customer",
      unique: true,
      partialFilterExpression: { isLatest: true },
    },
  );
};

const migrateRecipeSlugs = async () => {
  const recipes = await Recipe.collection
    .find({}, { projection: { slug: 1, thumbnail: 1, thumbnailPublicId: 1 } })
    .toArray();
  const slugOwners = new Map();
  const operations = [];

  for (const recipe of recipes) {
    const slug = normalizeSlug(String(recipe.slug || ""));
    if (!slug) {
      throw new Error(`Recipe ${recipe._id} has an empty normalized slug`);
    }
    const owner = slugOwners.get(slug);
    if (owner) {
      throw new Error(
        `Recipe slug collision after normalization: ${owner} and ${recipe._id} -> ${slug}`,
      );
    }
    slugOwners.set(slug, recipe._id);

    const set = { slug };
    if (!recipe.thumbnailPublicId && recipe.thumbnail) {
      const parts = recipe.thumbnail.split("/");
      const folderIndex = parts.indexOf("htcoaching");
      if (folderIndex !== -1) {
        set.thumbnailPublicId = parts
          .slice(folderIndex)
          .join("/")
          .replace(/\.[^.]+$/, "");
      }
    }
    operations.push({
      updateOne: {
        filter: { _id: recipe._id },
        update: { $set: set },
      },
    });
  }

  if (operations.length > 0) {
    await Recipe.collection.bulkWrite(operations, { ordered: true });
  }
};

export const runPhase1IntegrityMigration = async () => {
  await migrateContracts();
  await migrateF1Intakes();
  await migrateRecipeSlugs();
};

const runFromCli = async () => {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_PHASE1_INTEGRITY_MIGRATION",
  });
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    await runPhase1IntegrityMigration();
    console.log("Phase 1 integrity migration completed");
  } catch (error) {
    console.error(error.message);
    if (error.duplicates) {
      console.error(JSON.stringify(error.duplicates, null, 2));
    }
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1]?.endsWith("20260719-phase1-integrity.js")) {
  runFromCli();
}
