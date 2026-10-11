import { inspectStagingAiCatalogReadiness } from "./stagingAiCatalogReadiness.js";
import { stagingAiCatalogError } from "./stagingAiCatalogRollout.contract.js";
import { buildStagingAiCatalogPlan } from "./stagingAiCatalogRollout.plan.js";

const markerCount = (target) => [
  ...(target.exercises || []),
  ...(target.foods || []),
  ...(target.priceObservations || []),
].filter((row) => row?._stagingAiCatalogRollout).length;

export const verifyStagingAiCatalogPostState = async ({
  operation,
  source,
  target,
  db,
  now = new Date(),
} = {}) => {
  const rerun = buildStagingAiCatalogPlan({ operation, source, target, now });
  if (rerun.operations.length !== 0) {
    throw stagingAiCatalogError(
      "STAGING_AI_CATALOG_POST_VERIFY_NOT_IDEMPOTENT",
    );
  }
  if (operation === "rollback") {
    const residue = markerCount(target);
    if (residue !== 0) {
      throw stagingAiCatalogError("STAGING_AI_CATALOG_ROLLBACK_RESIDUE");
    }
    return { rolledBack: true, residue };
  }
  const readiness = await inspectStagingAiCatalogReadiness({ db, now });
  if (!readiness.ready) {
    throw stagingAiCatalogError(
      "STAGING_AI_CATALOG_POST_VERIFY_NOT_READY",
      readiness.gaps.join(", "),
    );
  }
  return { ready: true, residue: 0, readiness };
};
