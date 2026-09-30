import mongodb from "mongodb";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  validateStagingKnowledgeBaseReviewImportAuthorization,
} from "./stagingKnowledgeBaseReviewImport.contract.js";
import {
  applyReviewImportPlan,
  assertProductionKnowledgeSourceReadOnly,
  buildReviewImportPlan,
  loadProductionReviewSourceEntries,
  loadTargetReviewEntries,
  resolveStagingReviewer,
  verifyReviewImportPostState,
} from "./stagingKnowledgeBaseReviewImport.runtime.js";

const { MongoClient } = mongodb;
const MANIFEST_URL = new URL(
  "./stagingKnowledgeBaseReviewManifest.json",
  import.meta.url,
);

const readManifest = async () =>
  JSON.parse(await readFile(MANIFEST_URL, "utf8"));

export const runStagingKnowledgeBaseReviewImport = async ({
  argv = process.argv.slice(2),
  env = process.env,
  now = new Date(),
} = {}) => {
  const authorization = validateStagingKnowledgeBaseReviewImportAuthorization({
    argv,
    env,
  });
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
    const manifest = await readManifest();
    const [sourceEntries, targetEntries] = await Promise.all([
      loadProductionReviewSourceEntries(sourceDb),
      loadTargetReviewEntries(targetDb),
    ]);
    const plan = buildReviewImportPlan({
      manifest,
      sourceEntries,
      targetEntries,
      reviewerId,
      now,
    });
    if (
      authorization.apply &&
      authorization.expectedPlanDigest !== plan.planDigest
    ) {
      throw Object.assign(new Error("KB_REVIEW_IMPORT_PLAN_DIGEST_MISMATCH"), {
        code: "KB_REVIEW_IMPORT_PLAN_DIGEST_MISMATCH",
      });
    }
    if (!authorization.apply) {
      return {
        success: true,
        mode: "preflight",
        target: authorization.target,
        planDigest: plan.planDigest,
        manifestDigest: plan.manifestDigest,
        summary: plan.summary,
      };
    }
    const result = await applyReviewImportPlan({
      targetDb,
      targetClient,
      plan,
    });
    const verification = await verifyReviewImportPostState({ targetDb, plan });
    return {
      success: true,
      mode: "apply",
      target: authorization.target,
      planDigest: plan.planDigest,
      manifestDigest: plan.manifestDigest,
      summary: plan.summary,
      result,
      verification,
    };
  } finally {
    await Promise.allSettled([sourceClient.close(), targetClient.close()]);
  }
};

export {
  validateStagingKnowledgeBaseReviewImportAuthorization,
} from "./stagingKnowledgeBaseReviewImport.contract.js";
export * from "./stagingKnowledgeBaseReviewImport.runtime.js";

const main = async () => {
  process.stdout.write(
    `${JSON.stringify(await runStagingKnowledgeBaseReviewImport(), null, 2)}\n`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${JSON.stringify({ code: error.code || "KB_REVIEW_IMPORT_FAILED" })}\n`,
    );
    process.exitCode = 1;
  });
}
