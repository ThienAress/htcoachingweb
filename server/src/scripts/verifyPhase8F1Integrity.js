import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import { verifyPhase8Integrity } from "../migrations/20260720-phase8-f1-private-integrity.js";

await connectDB();
try {
  const result = await verifyPhase8Integrity({ verifyProviderObjects: true });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.totalIssues > 0) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
