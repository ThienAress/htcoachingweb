const STAGING_DATABASE = "htcoaching_staging";
const PRODUCTION_ORIGINS = new Set([
  "https://htcoachingweb.io.vn",
  "https://htcoachingweb.netlify.app",
  "https://htcoachingweb.onrender.com",
  "https://api.htcoachingweb.io.vn",
]);

const splitOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getOrigin = (value) => {
  try {
    return new URL(String(value || "")).origin;
  } catch {
    return "";
  }
};

const getMongoDatabase = (value) => {
  try {
    return decodeURIComponent(new URL(String(value || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0];
  } catch {
    return "";
  }
};

export const validateStagingEnvironment = (env = process.env) => {
  if (String(env.APP_ENV || "").toLowerCase() !== "staging") {
    return { valid: true, errors: [] };
  }

  const errors = [];
  const addError = (code, message) => errors.push({ code, message });
  const clientOrigin = getOrigin(env.CLIENT_URL);
  const publicApiOrigin = getOrigin(env.PUBLIC_API_ORIGIN);
  const allowedOrigins = splitOrigins(env.ALLOWED_ORIGINS).map(getOrigin);

  if (getMongoDatabase(env.MONGO_URI) !== STAGING_DATABASE) {
    addError(
      "STAGING_DATABASE_REQUIRED",
      `APP_ENV=staging requires the ${STAGING_DATABASE} database.`,
    );
  }
  if (String(env.BACKGROUND_JOBS_ENABLED || "").toLowerCase() !== "false") {
    addError(
      "STAGING_BACKGROUND_JOBS_FORBIDDEN",
      "Background jobs must be disabled in staging.",
    );
  }
  if (String(env.EMAIL_DELIVERY_MODE || "").toLowerCase() !== "disabled") {
    addError(
      "STAGING_EMAIL_DELIVERY_FORBIDDEN",
      "Outbound email delivery must be disabled in staging.",
    );
  }
  if (!clientOrigin || !clientOrigin.includes("staging")) {
    addError(
      "STAGING_CLIENT_ORIGIN_REQUIRED",
      "CLIENT_URL must point to the staging frontend.",
    );
  }
  if (!publicApiOrigin || !publicApiOrigin.includes("staging")) {
    addError(
      "STAGING_API_ORIGIN_REQUIRED",
      "PUBLIC_API_ORIGIN must point to the staging API.",
    );
  }
  if (!allowedOrigins.includes(clientOrigin)) {
    addError(
      "STAGING_CLIENT_ORIGIN_NOT_ALLOWED",
      "The staging CLIENT_URL must be present in ALLOWED_ORIGINS.",
    );
  }
  if (
    [clientOrigin, publicApiOrigin, ...allowedOrigins].some((origin) =>
      PRODUCTION_ORIGINS.has(origin),
    )
  ) {
    addError(
      "STAGING_PRODUCTION_ORIGIN_FORBIDDEN",
      "Staging configuration must not reference a production origin.",
    );
  }
  if (String(env.F1_RETENTION_ENFORCE || "").toLowerCase() !== "false") {
    addError(
      "STAGING_RETENTION_ENFORCEMENT_FORBIDDEN",
      "F1 retention enforcement must be disabled in staging.",
    );
  }
  if (String(env.NETLIFY_BUILD_HOOK_URL || "").trim()) {
    addError(
      "STAGING_BUILD_HOOK_FORBIDDEN",
      "Staging must not hold a production Netlify build hook.",
    );
  }

  return { valid: errors.length === 0, errors };
};

export const assertStagingEnvironment = (env = process.env) => {
  const result = validateStagingEnvironment(env);
  if (!result.valid) {
    const error = new Error(
      "Staging configuration rejected: " +
        result.errors.map((finding) => finding.code).join(", "),
    );
    error.code = "STAGING_CONFIG_INVALID";
    error.findings = result.errors;
    throw error;
  }
  return result;
};
