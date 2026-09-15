import { validateStagingOperation } from "../config/stagingOperationSafety.js";

export const EXPECTED_CLIENT_URL = "https://staging--htcoachingweb.netlify.app";
export const EXPECTED_API_ORIGIN = "https://htcoachingweb-staging.onrender.com";
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const EXPECTED_EMBEDDING_VERSION = "gemini-embedding-2:768:question-answering-v1";

const databaseName = (uri) => {
  try {
    return decodeURIComponent(new URL(String(uri || "")).pathname)
      .replace(/^\/+/, "")
      .split("/", 1)[0];
  } catch {
    return "";
  }
};

export const validateAcceptanceConfig = (env = process.env) => {
  const findings = new Set(
    validateStagingOperation({
      env,
      confirmationVariable: "CONFIRM_STAGING_AI_ACCEPTANCE",
    }).errors,
  );
  if (env.APP_ENV !== "staging") findings.add("APP_ENV_EXACT");
  if (databaseName(env.MONGO_URI) !== "htcoaching_staging") findings.add("DATABASE_EXACT");
  if (env.CLIENT_URL !== EXPECTED_CLIENT_URL) findings.add("CLIENT_URL_EXACT");
  if (env.PUBLIC_API_ORIGIN !== EXPECTED_API_ORIGIN) findings.add("PUBLIC_API_ORIGIN_EXACT");
  if (env.STAGING_AI_ACCEPTANCE_ENABLED !== "true") findings.add("CAPABILITY_DISABLED");
  if (env.EXPECTED_KB_EMBEDDING_VERSION !== EXPECTED_EMBEDDING_VERSION) {
    findings.add("EMBEDDING_VERSION_EXACT");
  }
  const releaseSha = String(env.RELEASE_SHA || "");
  if (!SHA_PATTERN.test(releaseSha)) findings.add("RELEASE_SHA_EXACT");
  if (!SHA_PATTERN.test(String(env.RENDER_GIT_COMMIT || "")) ||
      env.RENDER_GIT_COMMIT !== releaseSha) {
    findings.add("RENDER_GIT_COMMIT_MISMATCH");
  }
  return { valid: findings.size === 0, findings: [...findings], releaseSha };
};

export const assertAcceptanceConfig = (env = process.env) => {
  const result = validateAcceptanceConfig(env);
  if (!result.valid) {
    const error = new Error(`Staging AI acceptance rejected: ${result.findings.join(", ")}`);
    error.code = "STAGING_AI_ACCEPTANCE_REJECTED";
    error.findings = result.findings;
    throw error;
  }
  for (const name of [
    "JWT_SECRET",
    "ADMIN_EMAIL",
    "STAGING_AI_ACCEPTANCE_OUTPUT",
    "STAGING_AI_ACCEPTANCE_RECOVERY_OUTPUT",
    "EXPECTED_KB_EMBEDDING_VERSION",
  ]) {
    if (!String(env[name] || "").trim()) {
      const error = new Error(`Staging AI acceptance requires ${name}`);
      error.code = "STAGING_AI_ACCEPTANCE_CONFIG_MISSING";
      throw error;
    }
  }
  if (!String(env.STAGING_RENDER_TOPOLOGY_EVIDENCE || "").trim()) {
    const error = new Error("Staging AI acceptance requires STAGING_RENDER_TOPOLOGY_EVIDENCE");
    error.code = "STAGING_AI_ACCEPTANCE_CONFIG_MISSING";
    throw error;
  }
  return result;
};

export const validateTopologyEvidence = (document, releaseSha, { now = Date.now() } = {}) => {
  const topKeys = Object.keys(document || {}).sort();
  const topologyKeys = Object.keys(document?.serviceTopology || {}).sort();
  const checkedAt = new Date(document?.checkedAt).getTime();
  const valid = Boolean(
    document?.schemaVersion === 1 &&
      document.kind === "render-single-instance-topology" &&
      JSON.stringify(topKeys) === JSON.stringify(["checkedAt", "kind", "releaseSha", "schemaVersion", "serviceTopology"]) &&
      JSON.stringify(topologyKeys) === JSON.stringify(["configuredInstances", "currentInstances"]) &&
      SHA_PATTERN.test(document.releaseSha) &&
      document.releaseSha === releaseSha &&
      document.serviceTopology.configuredInstances === 1 &&
      document.serviceTopology.currentInstances === 1 &&
      Number.isFinite(checkedAt) &&
      new Date(checkedAt).toISOString() === document.checkedAt &&
      checkedAt <= now + 60_000 &&
      now - checkedAt <= 15 * 60_000,
  );
  if (!valid) {
    const error = new Error("Render topology evidence is missing, stale, mismatched, or not single-instance");
    error.code = "STAGING_AI_TOPOLOGY_INCONCLUSIVE";
    throw error;
  }
  return { checkedAt: new Date(checkedAt).toISOString(), topology: "single_instance" };
};
