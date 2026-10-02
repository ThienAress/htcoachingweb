import "../config/env.js";
import mongoose from "mongoose";
import { reconcileWallets } from "../services/walletReconciliation.service.js";

if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");

const walletLimit = Number.parseInt(
  process.env.RECONCILE_WALLET_LIMIT || "5000",
  10,
);
const issueLimit = Number.parseInt(
  process.env.RECONCILE_ISSUE_LIMIT || "1000",
  10,
);
const allowLegacyTrainerReference =
  process.env.ALLOW_LEGACY_TRAINER_REFERENCE === "true";

await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
try {
  const report = await reconcileWallets({
    walletLimit,
    issueLimit,
    allowLegacyTrainerReference,
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.totalIssues > 0) process.exitCode = 2;
} finally {
  await mongoose.disconnect();
}
