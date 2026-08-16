const API_BASE_URLS = Object.freeze({
  sandbox: "https://userapi-sandbox.sepay.vn/v2",
  live: "https://userapi.sepay.vn/v2",
});

export class SePayConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SePayConfigError";
    this.code = code;
    this.status = 503;
  }
}

const enabledFlag = (value) => String(value || "").trim().toLowerCase() === "true";

const normalizeAccountNumber = (value) =>
  String(value || "").trim().replace(/\s+/g, "").toUpperCase();

const UTC_ISO_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const parseSePayCutoverAt = (value) => {
  const normalized = String(value || "").trim();
  if (!UTC_ISO_PATTERN.test(normalized)) return new Date(Number.NaN);
  const parsed = new Date(normalized);
  const canonical = normalized.includes(".")
    ? normalized
    : normalized.replace("Z", ".000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === canonical
    ? parsed
    : new Date(Number.NaN);
};

export const resolveSePayConfig = (env = process.env) => {
  const enabled = enabledFlag(env.SEPAY_ENABLED);
  const mode = String(env.SEPAY_MODE || "").trim().toLowerCase();
  const cutoverAt = parseSePayCutoverAt(env.SEPAY_AUTOMATION_CUTOVER_AT);
  return {
    enabled,
    mode,
    apiBaseUrl: API_BASE_URLS[mode] || null,
    webhookSecret: String(env.SEPAY_WEBHOOK_SECRET || ""),
    dataHashSecret: String(env.SEPAY_DATA_HASH_SECRET || ""),
    apiToken: String(env.SEPAY_API_TOKEN || ""),
    accountNumber: normalizeAccountNumber(env.BANK_ACCOUNT),
    cutoverAt,
    reconciliationEnabled: enabledFlag(env.SEPAY_RECONCILIATION_ENABLED),
  };
};

export const requireSePayWebhookConfig = (env = process.env) => {
  const config = resolveSePayConfig(env);
  if (!config.enabled) {
    throw new SePayConfigError("SEPAY_DISABLED", "SePay webhook đang tắt");
  }
  if (
    !config.apiBaseUrl ||
    config.webhookSecret.length < 32 ||
    config.dataHashSecret.length < 32 ||
    !/^[A-Z0-9]{4,34}$/i.test(config.accountNumber) ||
    Number.isNaN(config.cutoverAt.getTime())
  ) {
    throw new SePayConfigError(
      "WEBHOOK_NOT_CONFIGURED",
      "SePay webhook chưa được cấu hình đầy đủ",
    );
  }
  return config;
};

export const requireSePayReconciliationConfig = (env = process.env) => {
  const config = requireSePayWebhookConfig(env);
  if (!config.reconciliationEnabled || config.apiToken.length < 16) {
    throw new SePayConfigError(
      "RECONCILIATION_NOT_CONFIGURED",
      "SePay reconciliation chưa được cấu hình đầy đủ",
    );
  }
  return config;
};
