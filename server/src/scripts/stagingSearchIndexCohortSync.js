import { pathToFileURL } from "node:url";

import mongoose from "mongoose";

import {
  PLAN_043_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_KEY,
  STAGING_SEARCH_INDEX_EXERCISES,
  createStagingSearchIndexCohortPlanDigest,
  validateStagingSearchIndexCohortAuthorization,
} from "./stagingSearchIndexCohortSync.contract.js";
import {
  applyStagingSearchIndexCohortPlan,
  loadStagingSearchIndexCohortState,
} from "./stagingSearchIndexCohortSync.mongo.js";
import { buildStagingSearchIndexCohortPlan } from "./stagingSearchIndexCohortSync.plan.js";
import { verifyStagingSearchIndexCohortPostState } from "./stagingSearchIndexCohortSync.verify.js";

export {
  PLAN_043_FIXTURE_KEY,
  STAGING_SEARCH_COHORT_FIXTURE_KEY,
  STAGING_SEARCH_INDEX_EXERCISES,
  createStagingSearchIndexCohortPlanDigest,
  validateStagingSearchIndexCohortAuthorization,
} from "./stagingSearchIndexCohortSync.contract.js";
export {
  applyStagingSearchIndexCohortPlan,
  loadStagingSearchIndexCohortState,
} from "./stagingSearchIndexCohortSync.mongo.js";
export { buildStagingSearchIndexCohortPlan } from "./stagingSearchIndexCohortSync.plan.js";
export { verifyStagingSearchIndexCohortPostState } from "./stagingSearchIndexCohortSync.verify.js";

const PRODUCTION_API_BASE = "https://api.htcoachingweb.io.vn/api";

const syncError = (code, message = code) =>
  Object.assign(new Error(`${code}: ${message}`), { code });

export const loadSearchIndexCohortSource = async ({
  fetchImpl = globalThis.fetch,
} = {}) =>
  Promise.all(
    STAGING_SEARCH_INDEX_EXERCISES.map(async ({ id }) => {
      const response = await fetchImpl(
        `${PRODUCTION_API_BASE}/exercises/${encodeURIComponent(id)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "HTCoaching-Staging-Search-Cohort/1",
          },
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok) {
        throw syncError("STAGING_SEARCH_COHORT_SOURCE_REQUEST_FAILED");
      }
      const payload = await response.json();
      if (payload?.success !== true || !payload.data) {
        throw syncError("STAGING_SEARCH_COHORT_SOURCE_RESPONSE_INVALID");
      }
      return payload.data;
    }),
  );

const defaultDependencies = {
  connect: (uri) => mongoose.connect(uri, { autoIndex: false }),
  disconnect: () => mongoose.disconnect(),
  assertConnectedTarget: ({ targetDatabase }) => {
    if (mongoose.connection.name !== targetDatabase) {
      throw syncError("STAGING_SEARCH_COHORT_CONNECTED_DATABASE_MISMATCH");
    }
  },
  loadSourceExercises: loadSearchIndexCohortSource,
  loadTargetState: loadStagingSearchIndexCohortState,
  applyPlan: applyStagingSearchIndexCohortPlan,
};

export const runStagingSearchIndexCohortSync = async ({
  argv = process.argv.slice(2),
  env = process.env,
  dependencies = {},
  now = new Date(),
} = {}) => {
  const authorization = validateStagingSearchIndexCohortAuthorization({
    argv,
    env,
  });
  const runtime = { ...defaultDependencies, ...dependencies };
  let connected = false;
  try {
    await runtime.connect(env.MONGO_URI);
    connected = true;
    await runtime.assertConnectedTarget(authorization);
    const sourceExercises =
      authorization.operation === "sync"
        ? await runtime.loadSourceExercises()
        : [];
    const state = await runtime.loadTargetState();
    const planDigest = createStagingSearchIndexCohortPlanDigest({
      operation: authorization.operation,
      sourceExercises,
      ...state,
    });
    const plan = buildStagingSearchIndexCohortPlan({
      operation: authorization.operation,
      sourceExercises,
      ...state,
      now,
    });
    if (
      authorization.apply &&
      planDigest !== authorization.expectedPlanDigest
    ) {
      throw syncError(
        "STAGING_SEARCH_COHORT_PLAN_DIGEST_MISMATCH",
        "The current source or target state does not match the reviewed preflight",
      );
    }
    let result = null;
    let verification = null;
    if (authorization.apply) {
      result = await runtime.applyPlan({ plan });
      const postState = await runtime.loadTargetState();
      verification = verifyStagingSearchIndexCohortPostState({
        operation: authorization.operation,
        sourceExercises,
        ...postState,
        now,
      });
    }
    return {
      mode: authorization.apply ? "apply" : "preflight",
      operation: authorization.operation,
      success: true,
      planDigest,
      summary: plan.summary,
      result,
      verification,
    };
  } finally {
    if (connected) await runtime.disconnect();
  }
};

const main = async () => {
  const result = await runStagingSearchIndexCohortSync();
  console.log(JSON.stringify(result, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.code || "STAGING_SEARCH_COHORT_SYNC_FAILED");
    process.exitCode = 1;
  });
}
