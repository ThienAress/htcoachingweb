import mongodb from "mongodb";

import {
  LOCAL_SHOWCASE_DATABASE,
  LOCAL_SHOWCASE_MONGO_URI,
  PRODUCTION_SHOWCASE_DATABASE,
  SHOWCASE_TRAINER_SLUG,
  STAGING_SHOWCASE_DATABASE,
  assertShowcaseSyncContext,
} from "./showcaseDataSync.contract.js";
import {
  assertProductionSourceReadOnly,
  assertStagingTargetWriteScope,
  ensureTargetShowcaseIndexes,
  listSourceShowcaseGraph,
  preflightTargetShowcase,
  showcaseGraphCounts,
  showcaseGraphFingerprint,
  syncShowcaseGraphToTarget,
} from "./showcaseDataSync.runtime.js";

const { MongoClient } = mongodb;
const args = new Set(process.argv.slice(2));
const targetArg = process.argv.find((value) => value.startsWith("--target="));
const target = targetArg?.split("=")[1] || "";
const apply = args.has("--apply");
const sourceUri = process.env.PRODUCTION_SHOWCASE_SYNC_READONLY_URI;
const targetUri =
  target === "local"
    ? process.env.LOCAL_SHOWCASE_SYNC_URI || LOCAL_SHOWCASE_MONGO_URI
    : process.env.STAGING_SHOWCASE_SYNC_URI;

const run = async () => {
  assertShowcaseSyncContext({
    sourceUri,
    targetUri,
    target,
    apply,
    env: process.env,
  });

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);
  try {
    await sourceClient.connect();
    const sourceDb = sourceClient.db(PRODUCTION_SHOWCASE_DATABASE);
    await assertProductionSourceReadOnly(sourceDb);
    const { trainer, graph } = await listSourceShowcaseGraph(sourceDb);

    await targetClient.connect();
    const targetDatabase =
      target === "local" ? LOCAL_SHOWCASE_DATABASE : STAGING_SHOWCASE_DATABASE;
    const targetDb = targetClient.db(targetDatabase);
    if (target === "staging") {
      await assertStagingTargetWriteScope(targetDb);
    }
    await preflightTargetShowcase(targetDb, graph);
    const indexResult = await ensureTargetShowcaseIndexes({ targetDb, apply });

    const counts = showcaseGraphCounts(graph);
    const fingerprint = showcaseGraphFingerprint(graph);
    const { written } = await syncShowcaseGraphToTarget({
      targetDb,
      targetClient,
      graph,
      apply,
    });

    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "dry-run",
        target,
        trainerSlug: SHOWCASE_TRAINER_SLUG,
        trainerIdSuffix: String(trainer._id).slice(-6),
        collections: counts,
        total: counts.trainers + counts.customerstories,
        written,
        indexesPlanned: indexResult.planned.length,
        indexesCreated: indexResult.created,
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
      code: error?.code || "SHOWCASE_SYNC_FAILED",
      target: ["local", "staging"].includes(target) ? target : "invalid",
      ...(error?.collection ? { collection: error.collection } : {}),
      ...(error?.indexFields?.length
        ? { indexFields: error.indexFields }
        : {}),
    }),
  );
  process.exitCode = 1;
});
