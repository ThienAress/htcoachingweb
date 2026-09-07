const TRUE_VALUE = "true";
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export const isAuthCutoverMaintenanceEnabled = (env = process.env) =>
  String(env.AUTH_CUTOVER_MAINTENANCE || "").trim().toLowerCase() ===
  TRUE_VALUE;

export const getPublicReleaseSha = (env = process.env) => {
  const value = String(env.RENDER_GIT_COMMIT || "").trim();
  return RELEASE_SHA_PATTERN.test(value) ? value.toLowerCase() : "";
};
