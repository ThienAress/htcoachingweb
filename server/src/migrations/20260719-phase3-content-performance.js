import "../config/env.js";
import mongoose from "mongoose";

import BlogPost from "../models/BlogPost.js";
import Order from "../models/Order.js";
import Recipe from "../models/Recipe.js";

export const runPhase3ContentMigration = async () => {
  await Recipe.collection.updateMany(
    { isPublished: { $exists: false } },
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
};

const runFromCli = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    await runPhase3ContentMigration();
    console.log("Phase 3 content/performance migration completed");
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
