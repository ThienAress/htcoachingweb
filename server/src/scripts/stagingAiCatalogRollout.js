import { pathToFileURL } from "node:url";

import mongoose from "mongoose";
import { resolveMongoConnectionOptions } from "../config/mongoConnectionOptions.js";

import {
  STAGING_AI_CATALOG_MONGO_CONNECT_OPTIONS,
  createStagingAiCatalogPlanDigest,
  stagingAiCatalogError,
  validateStagingAiCatalogAuthorization,
} from "./stagingAiCatalogRollout.contract.js";
import {
  applyStagingAiCatalogPlan,
  loadStagingAiCatalogState,
} from "./stagingAiCatalogRollout.mongo.js";
import { buildStagingAiCatalogPlan } from "./stagingAiCatalogRollout.plan.js";
import { loadStagingAiCatalogSource } from "./stagingAiCatalogRollout.source.js";
import { verifyStagingAiCatalogPostState } from "./stagingAiCatalogRollout.verify.js";

export * from "./stagingAiCatalogRollout.contract.js";
export { applyStagingAiCatalogPlan, loadStagingAiCatalogState };
export { buildStagingAiCatalogPlan };
export { loadStagingAiCatalogSource };
export { verifyStagingAiCatalogPostState };

const defaultDependencies = {
  connect: (uri) => mongoose.connect(
    uri,
    {
      ...resolveMongoConnectionOptions({ durable: true, autoIndex: false }),
      ...STAGING_AI_CATALOG_MONGO_CONNECT_OPTIONS,
    },
  ),
  disconnect: () => mongoose.disconnect(),
  assertConnectedTarget: ({ targetDatabase }) => {
    if (mongoose.connection.name !== targetDatabase) {
      throw stagingAiCatalogError(
        "STAGING_AI_CATALOG_CONNECTED_DATABASE_MISMATCH",
      );
    }
  },
  loadSource: loadStagingAiCatalogSource,
  loadTarget: loadStagingAiCatalogState,
  createDigest: createStagingAiCatalogPlanDigest,
  buildPlan: buildStagingAiCatalogPlan,
  applyPlan: applyStagingAiCatalogPlan,
  verifyPostState: verifyStagingAiCatalogPostState,
};

const safeFoodEvidence = (operation) => {
  if (operation.type !== "update_food") return null;
  const profile = operation.allergenProfile || {};
  const evidence = operation.marker?.evidence || {};
  const reviewedAt = new Date(profile.reviewedAt);
  return {
    sourceType: String(profile.sourceType || ""),
    sourceUrl: String(profile.sourceUrl || ""),
    taxonomySourceUrl: String(evidence.allergenTaxonomySourceUrl || ""),
    reviewedAt: Number.isNaN(reviewedAt.getTime())
      ? null
      : reviewedAt.toISOString(),
    reviewedScopes: Array.isArray(profile.reviewedScopes)
      ? profile.reviewedScopes.map(String)
      : [],
    scope: String(evidence.scope || ""),
    crossContactStatus: String(evidence.crossContactStatus || ""),
  };
};

const safeWrite = (operation) => {
  const evidence = safeFoodEvidence(operation);
  return {
    type: operation.type,
    ...(operation.id ? { id: String(operation.id) } : {}),
    ...(operation.document?.name ? { name: operation.document.name } : {}),
    ...(operation.document?.foodId
      ? { foodId: String(operation.document.foodId) }
      : {}),
    ...(operation.document?.sourceKey
      ? { sourceKey: operation.document.sourceKey }
      : {}),
    ...(operation.document?.observedAt
      ? { observedAt: new Date(operation.document.observedAt).toISOString() }
      : {}),
    ...(operation.marker?.sourceKey
      ? { label: operation.marker.sourceKey }
      : {}),
    ...(evidence ? { evidence } : {}),
  };
};

export const runStagingAiCatalogRollout = async ({
  argv = process.argv.slice(2),
  env = process.env,
  dependencies = {},
  now = new Date(),
} = {}) => {
  const authorization = validateStagingAiCatalogAuthorization({ argv, env });
  const runtime = { ...defaultDependencies, ...dependencies };
  let connected = false;
  try {
    await runtime.connect(env.MONGO_URI);
    connected = true;
    await runtime.assertConnectedTarget(authorization);
    const source = authorization.operation === "sync"
      ? await runtime.loadSource()
      : undefined;
    const target = await runtime.loadTarget();
    const digestInput = { operation: authorization.operation, source, target };
    const planDigest = runtime.createDigest(digestInput);
    const plan = runtime.buildPlan({
      operation: authorization.operation,
      source,
      target,
      now,
    });
    if (authorization.apply &&
      authorization.expectedPlanDigest !== planDigest) {
      throw stagingAiCatalogError(
        "STAGING_AI_CATALOG_PLAN_DIGEST_MISMATCH",
        "Source or staging state changed after the reviewed preflight",
      );
    }
    let result = null;
    let verification = null;
    if (authorization.apply) {
      result = await runtime.applyPlan({ plan });
      const postTarget = await runtime.loadTarget();
      verification = await runtime.verifyPostState({
        operation: authorization.operation,
        source,
        target: postTarget,
        db: mongoose.connection.db,
        now,
      });
    }
    return {
      success: true,
      mode: authorization.apply ? "apply" : "preflight",
      operation: authorization.operation,
      targetDatabase: authorization.targetDatabase,
      source: source
        ? {
            exercises: source.exercises.length,
            foods: source.foods.length,
            prices: source.prices.length,
          }
        : null,
      planDigest,
      summary: plan.summary,
      writes: plan.operations.map(safeWrite),
      result,
      verification,
    };
  } finally {
    if (connected) await runtime.disconnect();
  }
};

const main = async () => {
  process.stdout.write(
    `${JSON.stringify(await runStagingAiCatalogRollout(), null, 2)}\n`,
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.code || "STAGING_AI_CATALOG_ROLLOUT_FAILED"}\n`);
    process.exitCode = 1;
  });
}
