import mongodb from "mongodb";

import {
  LOCAL_ACCOUNT_MONGO_URI,
  assertSyncContext,
  resolveAccountSyncEmail,
} from "./singleAccountSync.contract.js";
import {
  accountGraphCounts,
  accountGraphFingerprint,
  assertProductionSourceReadOnly,
  listSourceAccountGraph,
  preflightTargetAccount,
  syncAccountGraphToTarget,
} from "./singleAccountSync.runtime.js";

const { MongoClient } = mongodb;

const args = new Set(process.argv.slice(2));
const targetArg = process.argv.find((value) => value.startsWith("--target="));
const target = targetArg?.split("=")[1] || "";
const apply = args.has("--apply");

const sourceUri = process.env.PRODUCTION_ACCOUNT_SYNC_READONLY_URI;
const targetUri =
  target === "local"
    ? process.env.LOCAL_ACCOUNT_SYNC_URI || LOCAL_ACCOUNT_MONGO_URI
    : process.env.STAGING_ACCOUNT_SYNC_URI;

const run = async () => {
  assertSyncContext({ sourceUri, targetUri, target, env: process.env });
  const accountEmail = resolveAccountSyncEmail(process.env.ACCOUNT_SYNC_EMAIL);

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  try {
    await sourceClient.connect();
    await targetClient.connect();
    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();
    await assertProductionSourceReadOnly(sourceDb);
    const { accountUser, graph } = await listSourceAccountGraph(sourceDb, {
      accountEmail,
    });
    await preflightTargetAccount(targetDb, accountUser, {
      accountEmail,
    });
    const counts = accountGraphCounts(graph);
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const fingerprint = accountGraphFingerprint(graph);
    const { written } = await syncAccountGraphToTarget({
      targetDb,
      targetClient,
      graph,
      apply,
    });

    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "dry-run",
        target,
        userIdSuffix: String(accountUser._id).slice(-6),
        collections: counts,
        total,
        written,
        fingerprint: fingerprint.slice(0, 16),
      }),
    );
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
};

run().catch((error) => {
  console.error(
    JSON.stringify({
      status: "failed",
      code: error?.code || "ACCOUNT_SYNC_FAILED",
      ...(error?.collection ? { collection: error.collection } : {}),
      ...(error?.indexFields?.length
        ? { indexFields: error.indexFields }
        : {}),
    }),
  );
  process.exitCode = 1;
});
