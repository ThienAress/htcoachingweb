import "../config/env.js";
import mongoose from "mongoose";
import { PHASE4_INDEXES } from "../migrations/20260719-phase4-index-performance.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
try {
  const missing = [];
  for (const [collectionName, _key, name] of PHASE4_INDEXES) {
    const indexes = await mongoose.connection
      .collection(collectionName)
      .listIndexes()
      .toArray();
    if (!indexes.some((index) => index.name === name)) {
      missing.push(`${collectionName}.${name}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing Phase 4 indexes:\n${missing.join("\n")}`);
  }
  console.log("All Phase 4 indexes are present");
} finally {
  await mongoose.disconnect();
}
