const PLACEHOLDER_PATTERN =
  /(change[-_ ]?me|replace[-_ ]?me|placeholder|example|your[-_ ]|test[-_ ]secret|local[-_ ]secret)/i;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const addFinding = (findings, severity, code, message) => {
  findings[severity].push({ code, message });
};

const validateSecret = (
  env,
  findings,
  name,
  { minimum = 32, strictOnly = false } = {},
) => {
  const value = String(env[name] || "");
  const severity = strictOnly ? "warnings" : "errors";
  if (!value) {
    addFinding(
      findings,
      severity,
      name + "_MISSING",
      name + " is required for the production profile.",
    );
    return "";
  }
  if (value.length < minimum) {
    addFinding(
      findings,
      severity,
      name + "_WEAK",
      name + " must contain at least " + minimum + " characters.",
    );
  }
  if (PLACEHOLDER_PATTERN.test(value)) {
    addFinding(
      findings,
      severity,
      name + "_PLACEHOLDER",
      name + " still contains a placeholder value.",
    );
  }
  return value;
};

const validateHttpsUrl = (
  env,
  findings,
  name,
  { required = true, originOnly = false, strictOnly = false } = {},
) => {
  const value = String(env[name] || "").trim();
  const severity = strictOnly ? "warnings" : "errors";
  if (!value) {
    if (required) {
      addFinding(
        findings,
        severity,
        name + "_MISSING",
        name + " is required for the production profile.",
      );
    }
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      addFinding(
        findings,
        severity,
        name + "_HTTPS_REQUIRED",
        name + " must use HTTPS in production.",
      );
    }
    if (parsed.username || parsed.password) {
      addFinding(
        findings,
        severity,
        name + "_CREDENTIALS_FORBIDDEN",
        name + " must not contain embedded credentials.",
      );
    }
    if (
      originOnly &&
      (parsed.pathname !== "/" || parsed.search || parsed.hash)
    ) {
      addFinding(
        findings,
        severity,
        name + "_ORIGIN_REQUIRED",
        name + " must be an origin without a path, query, or fragment.",
      );
    }
    return parsed;
  } catch {
    addFinding(
      findings,
      severity,
      name + "_INVALID_URL",
      name + " must be a valid absolute URL.",
    );
    return null;
  }
};

const validateOriginList = (env, findings, name, { required = false } = {}) => {
  const values = splitList(env[name]);
  if (required && values.length === 0) {
    addFinding(
      findings,
      "errors",
      name + "_MISSING",
      name + " must contain at least one explicit HTTPS origin.",
    );
  }
  const origins = [];
  for (const value of values) {
    if (value.includes("*")) {
      addFinding(
        findings,
        "errors",
        name + "_WILDCARD_FORBIDDEN",
        name + " must not contain wildcard origins.",
      );
      continue;
    }
    try {
      const parsed = new URL(value);
      if (
        parsed.protocol !== "https:" ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error("invalid origin");
      }
      origins.push(parsed.origin);
    } catch {
      addFinding(
        findings,
        "errors",
        name + "_INVALID_ORIGIN",
        name + " entries must be explicit HTTPS origins.",
      );
    }
  }
  return [...new Set(origins)];
};

const validateMongoUri = (env, findings) => {
  const value = String(env.MONGO_URI || "").trim();
  if (!value) {
    addFinding(
      findings,
      "errors",
      "MONGO_URI_MISSING",
      "MONGO_URI is required.",
    );
    return;
  }
  try {
    const parsed = new URL(value);
    if (!["mongodb:", "mongodb+srv:"].includes(parsed.protocol)) {
      throw new Error("invalid MongoDB scheme");
    }
    const hostname = parsed.hostname.toLowerCase();
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
      addFinding(
        findings,
        "errors",
        "MONGO_URI_LOCALHOST",
        "Production must not use a localhost MongoDB target.",
      );
    }
    if (
      parsed.protocol === "mongodb:" &&
      !["true", "1"].includes(
        String(parsed.searchParams.get("tls") || parsed.searchParams.get("ssl")),
      )
    ) {
      addFinding(
        findings,
        "errors",
        "MONGO_URI_TLS_REQUIRED",
        "A mongodb:// production URI must explicitly enable TLS.",
      );
    }
  } catch {
    addFinding(
      findings,
      "errors",
      "MONGO_URI_INVALID",
      "MONGO_URI must be a valid MongoDB connection URI.",
    );
  }
};

const validateIntegerSetting = (
  env,
  findings,
  name,
  { minimum, maximum, strictOnly = false },
) => {
  const raw = String(env[name] || "").trim();
  if (!raw) {
    if (strictOnly) {
      addFinding(
        findings,
        "warnings",
        name + "_NOT_EXPLICIT",
        name + " should be explicitly configured for production.",
      );
    }
    return;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    addFinding(
      findings,
      "errors",
      name + "_INVALID",
      name + " must be an integer between " + minimum + " and " + maximum + ".",
    );
  }
};

const validateBooleanSetting = (
  env,
  findings,
  name,
  { required = false, strictOnly = false } = {},
) => {
  const raw = String(env[name] || "").trim().toLowerCase();
  if (!raw) {
    if (required) {
      addFinding(
        findings,
        "errors",
        name + "_REQUIRED",
        name + " must be explicitly configured as true or false.",
      );
    } else if (strictOnly) {
      addFinding(
        findings,
        "warnings",
        name + "_NOT_EXPLICIT",
        name + " should be explicitly configured as true or false.",
      );
    }
    return;
  }
  if (!["true", "false"].includes(raw)) {
    addFinding(
      findings,
      "errors",
      name + "_INVALID",
      name + " must be true or false.",
    );
  }
};

const validateRequiredText = (
  env,
  findings,
  name,
  { strictOnly = false, minimum = 1 } = {},
) => {
  const value = String(env[name] || "").trim();
  const severity = strictOnly ? "warnings" : "errors";
  if (!value) {
    addFinding(
      findings,
      severity,
      name + "_MISSING",
      name + " is required for the production profile.",
    );
    return;
  }
  if (value.length < minimum || PLACEHOLDER_PATTERN.test(value)) {
    addFinding(
      findings,
      severity,
      name + "_INVALID",
      name + " must contain an explicit non-placeholder value.",
    );
  }
};

export const validateProductionEnvironment = (
  env = process.env,
  { strict = false } = {},
) => {
  const findings = { errors: [], warnings: [] };
  if (env.NODE_ENV !== "production") {
    addFinding(
      findings,
      "errors",
      "NODE_ENV_NOT_PRODUCTION",
      "NODE_ENV must equal production.",
    );
  }

  validateMongoUri(env, findings);
  const jwtSecret = validateSecret(env, findings, "JWT_SECRET");
  const refreshSecret = validateSecret(env, findings, "REFRESH_SECRET");
  if (jwtSecret && refreshSecret && jwtSecret === refreshSecret) {
    addFinding(
      findings,
      "errors",
      "AUTH_SECRETS_NOT_DISTINCT",
      "JWT_SECRET and REFRESH_SECRET must be different values.",
    );
  }

  const clientUrl = validateHttpsUrl(env, findings, "CLIENT_URL", {
    originOnly: true,
  });
  const allowedOrigins = validateOriginList(
    env,
    findings,
    "ALLOWED_ORIGINS",
    { required: true },
  );
  validateOriginList(env, findings, "PREVIEW_ORIGINS");
  if (clientUrl && !allowedOrigins.includes(clientUrl.origin)) {
    addFinding(
      findings,
      "errors",
      "CLIENT_ORIGIN_NOT_ALLOWED",
      "CLIENT_URL must be present in ALLOWED_ORIGINS.",
    );
  }

  validateHttpsUrl(env, findings, "GOOGLE_CALLBACK_URL");
  validateSecret(env, findings, "GOOGLE_CLIENT_ID", { minimum: 12 });
  validateSecret(env, findings, "GOOGLE_CLIENT_SECRET", { minimum: 24 });

  if (String(env.F1_MEDIA_STORAGE_PROVIDER || "").toLowerCase() !== "cloudinary") {
    addFinding(
      findings,
      "errors",
      "F1_PRIVATE_STORAGE_REQUIRED",
      "F1_MEDIA_STORAGE_PROVIDER must equal cloudinary in production.",
    );
  }
  validateSecret(env, findings, "CLOUDINARY_CLOUD_NAME", { minimum: 2 });
  validateSecret(env, findings, "CLOUDINARY_API_KEY", { minimum: 6 });
  validateSecret(env, findings, "CLOUDINARY_API_SECRET", { minimum: 16 });

  const strictSecret = (name, minimum) =>
    validateSecret(env, findings, name, {
      minimum,
      strictOnly: !strict,
    });
  strictSecret("LOG_HASH_SECRET", 32);
  strictSecret("OPS_METRICS_TOKEN", 24);
  strictSecret("RESEND_API_KEY", 20);
  validateHttpsUrl(env, findings, "PUBLIC_API_ORIGIN", {
    originOnly: true,
    strictOnly: !strict,
  });

  if (String(env.AI_PROVIDER || "").toLowerCase() !== "gemini") {
    addFinding(
      findings,
      "errors",
      "AI_PROVIDER_NOT_PRODUCTION",
      "AI_PROVIDER must equal gemini for the production profile.",
    );
  }
  validateSecret(env, findings, "GEMINI_API_KEY", { minimum: 20 });

  if (String(env.AI_IMAGE_PROVIDER || "").toLowerCase() !== "openai") {
    addFinding(
      findings,
      "errors",
      "AI_IMAGE_PROVIDER_NOT_PRODUCTION",
      "AI_IMAGE_PROVIDER must equal openai for the production profile.",
    );
  }
  validateSecret(env, findings, "OPENAI_API_KEY", { minimum: 20 });

  validateRequiredText(env, findings, "F1_CONSENT_VERSION", {
    minimum: 2,
  });
  validateRequiredText(env, findings, "ADMIN_EMAIL", {
    minimum: 3,
  });

  for (const name of [
    "BANK_NAME",
    "BANK_CODE",
    "BANK_ACCOUNT",
    "BANK_HOLDER",
  ]) {
    validateRequiredText(env, findings, name, {
      strictOnly: !strict,
      minimum: 2,
    });
  }

  validateIntegerSetting(env, findings, "TRUST_PROXY_HOPS", {
    minimum: 0,
    maximum: 5,
    strictOnly: true,
  });
  validateIntegerSetting(env, findings, "SERVER_HEADERS_TIMEOUT_MS", {
    minimum: 5000,
    maximum: 120000,
  });
  validateIntegerSetting(env, findings, "SERVER_REQUEST_TIMEOUT_MS", {
    minimum: 15000,
    maximum: 600000,
  });
  validateIntegerSetting(env, findings, "SERVER_KEEP_ALIVE_TIMEOUT_MS", {
    minimum: 1000,
    maximum: 120000,
  });
  validateIntegerSetting(env, findings, "SERVER_SHUTDOWN_TIMEOUT_MS", {
    minimum: 5000,
    maximum: 60000,
  });
  validateBooleanSetting(env, findings, "BACKGROUND_JOBS_ENABLED", {
    required: true,
  });
  validateBooleanSetting(env, findings, "CSP_ENFORCE");
  validateBooleanSetting(env, findings, "F1_RETENTION_ENFORCE");

  if (
    String(env.F1_RETENTION_ENFORCE || "").toLowerCase() === "true" &&
    !OBJECT_ID_PATTERN.test(String(env.F1_RETENTION_ACTOR_ID || ""))
  ) {
    addFinding(
      findings,
      "errors",
      "F1_RETENTION_ACTOR_INVALID",
      "F1_RETENTION_ACTOR_ID must be a valid explicit ObjectId before enforcement.",
    );
  }

  if (String(env.CSP_ENFORCE || "").toLowerCase() !== "true") {
    addFinding(
      findings,
      "warnings",
      "CSP_REPORT_ONLY",
      "CSP is still in report-only mode.",
    );
  }

  return {
    valid: findings.errors.length === 0,
    fullyReady:
      findings.errors.length === 0 && findings.warnings.length === 0,
    strict,
    errors: findings.errors,
    warnings: findings.warnings,
    summary: {
      allowedOriginCount: allowedOrigins.length,
      hasExplicitTrustProxy: Boolean(String(env.TRUST_PROXY_HOPS || "").trim()),
      backgroundJobsExplicit: ["true", "false"].includes(
        String(env.BACKGROUND_JOBS_ENABLED || "").toLowerCase(),
      ),
      cspEnforced: String(env.CSP_ENFORCE || "").toLowerCase() === "true",
      retentionEnforced:
        String(env.F1_RETENTION_ENFORCE || "").toLowerCase() === "true",
    },
  };
};

export const assertProductionEnvironment = (
  env = process.env,
  options = {},
) => {
  const result = validateProductionEnvironment(env, options);
  if (result.errors.length > 0) {
    const error = new Error(
      "Production configuration rejected: " +
        result.errors.map((finding) => finding.code).join(", "),
    );
    error.code = "PRODUCTION_CONFIG_INVALID";
    error.findings = result.errors.map(({ code, message }) => ({
      code,
      message,
    }));
    throw error;
  }
  return result;
};
