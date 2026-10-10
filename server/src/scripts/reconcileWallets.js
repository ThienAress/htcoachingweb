import path from "node:path";
import { fileURLToPath } from "node:url";

import "../config/env.js";
import mongoose from "mongoose";

import { resolveMongoConnectionOptions } from "../config/mongoConnectionOptions.js";
import { reconcileWallets } from "../services/walletReconciliation.service.js";

export const reconciliationExitCode = (report) =>
  report?.totalIssues === 0 && report?.coverageComplete === true ? 0 : 2;

export const runWalletReconciliationCli = async ({
  env = process.env,
  output = process.stdout,
} = {}) => {
  if (!env.MONGO_URI) throw new Error("MONGO_URI is required");

  await mongoose.connect(
    env.MONGO_URI,
    resolveMongoConnectionOptions({
      nodeEnv: env.NODE_ENV,
      appEnv: env.APP_ENV,
      durable: true,
      autoIndex: false,
    }),
  );
  try {
    const report = await reconcileWallets({
      walletLimit: Number.parseInt(env.RECONCILE_WALLET_LIMIT || "5000", 10),
      issueLimit: Number.parseInt(env.RECONCILE_ISSUE_LIMIT || "1000", 10),
      allowLegacyTrainerReference:
        env.ALLOW_LEGACY_TRAINER_REFERENCE === "true",
    });
    output.write(`${JSON.stringify(report, null, 2)}\n`);
    return reconciliationExitCode(report);
  } finally {
    await mongoose.disconnect();
  }
};

export const executeWalletReconciliationCli = async ({
  run = runWalletReconciliationCli,
  errorOutput = process.stderr,
} = {}) => {
  try {
    return await run();
  } catch (error) {
    errorOutput.write(
      `${JSON.stringify({
        error: "WALLET_RECONCILIATION_FAILED",
        code: error?.code || "RUNTIME_ERROR",
      })}\n`,
    );
    return 1;
  }
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  executeWalletReconciliationCli()
    .then((exitCode) => {
      process.exitCode = exitCode;
    });
}
