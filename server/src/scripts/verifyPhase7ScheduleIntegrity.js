import "../config/env.js";
import mongoose from "mongoose";
import { verifyTrainingScheduleIntegrity } from "../services/trainingScheduleIntegrity.service.js";

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  try {
    const report = await verifyTrainingScheduleIntegrity();
    console.log(JSON.stringify(report, null, 2));
    if (report.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
