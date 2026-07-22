import "../config/env.js";
import mongoose from "mongoose";

export const PHASE4_INDEXES = [
  ["blogposts", { status: 1, category: 1, publishedAt: -1 }, "status_1_category_1_publishedAt_-1"],
  ["orders", { trainerId: 1, createdAt: -1 }, "trainerId_1_createdAt_-1"],
  ["orders", { userId: 1, createdAt: -1 }, "userId_1_createdAt_-1"],
  ["checkins", { orderId: 1, time: -1 }, "orderId_1_time_-1"],
  ["coachingdays", { userId: 1, date: -1 }, "userId_1_date_-1"],
  ["coachingdays", { trainerId: 1, userId: 1, date: -1 }, "trainerId_1_userId_1_date_-1"],
  [
    "knowledgeentries",
    { status: 1, category: 1, usageCount: -1, updatedAt: -1 },
    "status_1_category_1_usageCount_-1_updatedAt_-1",
  ],
  ["recipes", { isPublished: 1, createdAt: -1 }, "isPublished_1_createdAt_-1"],
  [
    "recipes",
    { isPublished: 1, category: 1, createdAt: -1 },
    "isPublished_1_category_1_createdAt_-1",
  ],
  [
    "recipes",
    { isPublished: 1, area: 1, createdAt: -1 },
    "isPublished_1_area_1_createdAt_-1",
  ],
];

export const runPhase4IndexMigration = async () => {
  const created = [];
  for (const [collectionName, key, name] of PHASE4_INDEXES) {
    const collection = mongoose.connection.collection(collectionName);
    await collection.createIndex(key, { name, background: true });
    created.push({ collection: collectionName, name });
  }
  return created;
};

const runFromCli = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (process.env.CONFIRM_PHASE4_INDEX_MIGRATION !== "yes") {
    throw new Error("Set CONFIRM_PHASE4_INDEX_MIGRATION=yes after backup and staging verification");
  }
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const created = await runPhase4IndexMigration();
    console.table(created);
    console.log("Phase 4 index migration completed");
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1]?.endsWith("20260719-phase4-index-performance.js")) {
  runFromCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
