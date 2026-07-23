import { observeMetric } from "./metrics.js";
import { safeLog } from "../utils/safeLogger.js";

const SLOW_QUERY_MS = Math.max(
  Number.parseInt(process.env.DB_SLOW_QUERY_MS, 10) || 250,
  10,
);

export const trackDbQuery = async (pattern, operation) => {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    observeMetric("db.query_latency_ms", durationMs);
    if (durationMs >= SLOW_QUERY_MS) {
      safeLog.warn("db.slow_query", "Query exceeded configured threshold", {
        pattern,
        durationMs,
        thresholdMs: SLOW_QUERY_MS,
      });
    }
  }
};
