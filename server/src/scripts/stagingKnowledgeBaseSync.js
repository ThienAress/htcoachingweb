import mongodb from "mongodb";
import { pathToFileURL } from "node:url";

import {
  validateStagingKnowledgeBaseSyncAuthorization,
} from "./stagingKnowledgeBaseSync.contract.js";
import {
  applyKnowledgeSyncPlan,
  assertProductionKnowledgeSourceReadOnly,
  buildKnowledgeSyncPlan,
  loadProductionKnowledgeEntries,
  loadTargetKnowledgeEntries,
  resolveStagingReviewer,
  verifyKnowledgeSyncPostState,
} from "./stagingKnowledgeBaseSync.runtime.js";

const { MongoClient } = mongodb;

export {
  validateStagingKnowledgeBaseSyncAuthorization,
} from "./stagingKnowledgeBaseSync.contract.js";
export * from "./stagingKnowledgeBaseSync.runtime.js";

export const runStagingKnowledgeBaseSync = async ({
  argv = process.argv.slice(2),
  env = process.env,
  now = new Date(),
} = {}) => {
  const authorization = validateStagingKnowledgeBaseSyncAuthorization({ argv, env });
  const sourceClient = new MongoClient(env.PRODUCTION_KB_READONLY_URI);
  const targetClient = new MongoClient(env.MONGO_URI);
  try {
    await sourceClient.connect();
    await targetClient.connect();
    const sourceDb = sourceClient.db();
    const targetDb = targetClient.db();
    await assertProductionKnowledgeSourceReadOnly(sourceDb);
    const reviewerId = await resolveStagingReviewer(
      targetDb,
      env.STAGING_KB_SYNC_REVIEWER_EMAIL,
    );
    const [sourceEntries, targetEntries] = await Promise.all([
      loadProductionKnowledgeEntries(sourceDb),
      loadTargetKnowledgeEntries(targetDb),
    ]);
    const plan = buildKnowledgeSyncPlan({
      sourceEntries,
      targetEntries,
      reviewerId,
      now,
    });
    if (authorization.apply && authorization.expectedPlanDigest !== plan.planDigest) {
      throw Object.assign(new Error("KB_SYNC_PLAN_DIGEST_MISMATCH"), {
        code: "KB_SYNC_PLAN_DIGEST_MISMATCH",
      });
    }
    if (!authorization.apply) {
      return {
        success: true,
        mode: "preflight",
        target: authorization.target,
        planDigest: plan.planDigest,
        summary: plan.summary,
      };
    }
    const result = await applyKnowledgeSyncPlan({
      targetDb,
      targetClient,
      plan,
    });
    const verification = await verifyKnowledgeSyncPostState({ targetDb, plan });
    return {
      success: true,
      mode: "apply",
      target: authorization.target,
      planDigest: plan.planDigest,
      summary: plan.summary,
      result,
      verification,
    };
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
};

const main = async () => {
  process.stdout.write(
    `${JSON.stringify(await runStagingKnowledgeBaseSync(), null, 2)}\n`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ code: error.code || "KB_SYNC_FAILED" })}\n`,
    );
    process.exitCode = 1;
  });
}

