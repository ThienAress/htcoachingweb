import crypto from "node:crypto";

const MARKER_PREFIX = "htcoaching-acceptance:";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertFunction = (value, name) => {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function`);
  }
};

const normalizeCleanupReport = (report) => {
  const residue = Number(report?.residue);
  if (!Number.isSafeInteger(residue) || residue < 0) {
    throw new Error("Cleanup verifier returned an invalid residue count");
  }
  const collections = report?.collections || {};
  for (const [name, count] of Object.entries(collections)) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Cleanup verifier returned an invalid count for ${name}`);
    }
  }
  return {
    verified: residue === 0,
    residue,
    ...(Object.keys(collections).length > 0 && { collections }),
  };
};

export const createAcceptanceIdentity = ({ runId = crypto.randomUUID() } = {}) => {
  const normalizedRunId = String(runId || "").toLowerCase();
  if (!UUID_PATTERN.test(normalizedRunId)) {
    throw new Error("Staging acceptance runId must be a UUID");
  }
  return {
    runId: normalizedRunId,
    marker: `${MARKER_PREFIX}${normalizedRunId}`,
  };
};

export const reconciliationIssueDelta = (current, baseline) => {
  if (
    !Number.isSafeInteger(current) ||
    current < 0 ||
    !Number.isSafeInteger(baseline) ||
    baseline < 0
  ) {
    throw new Error("Wallet reconciliation issue counts must be non-negative integers");
  }
  return Math.max(0, current - baseline);
};

export const runWithVerifiedCleanup = async ({ execute, cleanup, verify }) => {
  assertFunction(execute, "execute");
  assertFunction(cleanup, "cleanup");
  assertFunction(verify, "verify");

  let value;
  let executionError = null;
  try {
    value = await execute();
  } catch (error) {
    executionError = error;
  }

  let cleanupError = null;
  try {
    await cleanup();
  } catch (error) {
    cleanupError = error;
  }

  let cleanupReport;
  try {
    cleanupReport = normalizeCleanupReport(await verify());
  } catch (error) {
    cleanupError = cleanupError
      ? new AggregateError([cleanupError, error], "Staging cleanup and verification failed")
      : error;
  }

  if (cleanupError) {
    const errors = [executionError, cleanupError].filter(Boolean);
    const error = new AggregateError(
      errors,
      "Staging acceptance could not prove complete cleanup",
    );
    error.code = "STAGING_ACCEPTANCE_CLEANUP_FAILED";
    if (cleanupReport) error.cleanup = cleanupReport;
    throw error;
  }
  if (!cleanupReport.verified) {
    const error = new Error(
      `Staging acceptance cleanup left ${cleanupReport.residue} synthetic artifact(s)`,
    );
    error.code = "STAGING_ACCEPTANCE_CLEANUP_INCOMPLETE";
    error.cleanup = cleanupReport;
    if (executionError) error.cause = executionError;
    throw error;
  }
  if (executionError) {
    executionError.cleanup = cleanupReport;
    throw executionError;
  }

  return { value, cleanup: cleanupReport };
};
