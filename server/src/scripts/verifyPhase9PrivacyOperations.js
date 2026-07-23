import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import { verifyPhase9PrivacyOperations } from "../migrations/20260720-phase9-privacy-operations.js";

await connectDB();
try {
  const result = await verifyPhase9PrivacyOperations();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.totalIssues > 0) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
