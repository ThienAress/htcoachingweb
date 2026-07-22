import { validateStagingEnvironment } from "./stagingSafety.js";

const STAGING_DATABASE = "htcoaching_staging";

const getMongoDatabase = (value) => {
  try {
    return decodeURIComponent(new URL(String(value || "")).pathname)
      .replace(/^\/+/, "")
      .split("/")[0];
  } catch {
    return "";
  }
};

export const validateStagingOperation = ({
  env = process.env,
  confirmationVariable,
} = {}) => {
  const errors = [];
  const addError = (code) => errors.push(code);

  if (String(env.APP_ENV || "").toLowerCase() !== "staging") {
    addError("STAGING_OPERATION_ENV_REQUIRED");
  }
  if (getMongoDatabase(env.MONGO_URI) !== STAGING_DATABASE) {
    addError("STAGING_OPERATION_DATABASE_REQUIRED");
  }

  const environmentResult = validateStagingEnvironment(env);
  for (const finding of environmentResult.errors) {
    if (!errors.includes(finding.code)) errors.push(finding.code);
  }

  if (
    !confirmationVariable ||
    String(env[confirmationVariable] || "").toLowerCase() !== "yes"
  ) {
    addError("STAGING_OPERATION_CONFIRMATION_REQUIRED");
  }

  return { valid: errors.length === 0, errors };
};

export const assertStagingOperation = (options) => {
  const result = validateStagingOperation(options);
  if (!result.valid) {
    const error = new Error(
      `Staging operation rejected: ${result.errors.join(", ")}`,
    );
    error.code = "STAGING_OPERATION_REJECTED";
    error.findings = result.errors;
    throw error;
  }
  return result;
};
