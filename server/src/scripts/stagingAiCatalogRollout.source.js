import {
  STAGING_AI_CATALOG_EXERCISES,
  stagingAiCatalogError,
} from "./stagingAiCatalogRollout.contract.js";
import { createStagingAiCatalogSource } from "./stagingAiCatalogRollout.sourceContract.js";

const PRODUCTION_API_BASE = "https://api.htcoachingweb.io.vn/api";

const requestJson = async (url, fetchImpl) => {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "HTCoaching-Staging-AI-Catalog/1",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_SOURCE_REQUEST_FAILED");
  }
  const payload = await response.json();
  if (payload?.success !== true) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_SOURCE_RESPONSE_INVALID");
  }
  return payload.data;
};

export const loadStagingAiCatalogSource = async ({
  fetchImpl = globalThis.fetch,
} = {}) => {
  const [foods, ...exercises] = await Promise.all([
    requestJson(`${PRODUCTION_API_BASE}/foods?all=true`, fetchImpl),
    ...STAGING_AI_CATALOG_EXERCISES.map(({ id }) =>
      requestJson(
        `${PRODUCTION_API_BASE}/exercises/${encodeURIComponent(id)}`,
        fetchImpl,
      )),
  ]);
  if (!Array.isArray(foods) || exercises.some((exercise) => !exercise)) {
    throw stagingAiCatalogError("STAGING_AI_CATALOG_SOURCE_RESPONSE_INVALID");
  }
  return createStagingAiCatalogSource({ exercises, foods });
};
