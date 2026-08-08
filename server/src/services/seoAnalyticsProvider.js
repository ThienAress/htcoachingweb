import fs from "node:fs";

import { parseDateKey } from "../utils/dateKey.js";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_TOKEN = /^[a-z0-9._-]+$/;
const SENSITIVE_QUERY = /@|https?:\/\/|\b\d{7,}\b|[\u0000-\u001f]/i;

export class AnalyticsProviderError extends Error {
  constructor(provider, code, message) {
    super(message);
    this.name = "AnalyticsProviderError";
    this.provider = provider;
    this.code = code;
  }
}

export const assertAnalyticsWindow = (startDate, endDate) => {
  if (!DATE_KEY_PATTERN.test(startDate) || !DATE_KEY_PATTERN.test(endDate)) {
    throw new AnalyticsProviderError("analytics", "INVALID_WINDOW", "Khoảng ngày không hợp lệ");
  }
  try {
    parseDateKey(startDate);
    parseDateKey(endDate);
  } catch {
    throw new AnalyticsProviderError("analytics", "INVALID_WINDOW", "Khoảng ngày không hợp lệ");
  }
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    days < 0 ||
    days > 366
  ) {
    throw new AnalyticsProviderError("analytics", "INVALID_WINDOW", "Khoảng ngày không hợp lệ");
  }
};

export const gaDateToDateKey = (value, provider) => {
  const normalized = String(value || "");
  if (!/^\d{8}$/.test(normalized)) {
    throw new AnalyticsProviderError(provider, "MALFORMED_RESPONSE", "Provider trả ngày không hợp lệ");
  }
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
};

export const providerMetric = (value, provider, { max = Infinity } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    throw new AnalyticsProviderError(provider, "MALFORMED_RESPONSE", "Provider trả metric không hợp lệ");
  }
  return parsed;
};

export const normalizeAnalyticsToken = (value, fallback = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized.length > 64 || !SAFE_TOKEN.test(normalized)) {
    return fallback;
  }
  return normalized;
};

const siteHostname = (siteUrl) => {
  if (String(siteUrl).startsWith("sc-domain:")) {
    return String(siteUrl).slice("sc-domain:".length).toLowerCase();
  }
  try {
    return new URL(siteUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
};

export const normalizeAnalyticsPagePath = (value, siteUrl) => {
  try {
    const url = String(value).startsWith("/")
      ? new URL(value, "https://local.invalid")
      : new URL(value);
    const expectedHost = siteHostname(siteUrl);
    if (
      url.hostname !== "local.invalid" &&
      expectedHost &&
      url.hostname !== expectedHost &&
      !url.hostname.endsWith(`.${expectedHost}`)
    ) {
      return "";
    }
    const path = url.pathname || "/";
    if (
      path.length > 300 ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      /[?#\\\s]/.test(path)
    ) {
      return "";
    }
    return path;
  } catch {
    return "";
  }
};

export const isSafeSearchQuery = (value) => {
  const query = String(value || "").trim();
  return Boolean(query && query.length <= 200 && !SENSITIVE_QUERY.test(query));
};

export const googleCredentialsFromEnv = (env = process.env) => {
  let raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw && env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      raw = fs.readFileSync(
        String(env.GOOGLE_APPLICATION_CREDENTIALS).trim(),
        "utf8",
      );
    } catch {
      throw new AnalyticsProviderError(
        "google",
        "INVALID_CONFIG",
        "Google credential không hợp lệ",
      );
    }
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw).replace(/^\uFEFF/, ""));
    if (!parsed.client_email || !parsed.private_key) throw new Error("missing fields");
    return {
      client_email: parsed.client_email,
      private_key: String(parsed.private_key).replaceAll("\\n", "\n"),
    };
  } catch {
    throw new AnalyticsProviderError("google", "INVALID_CONFIG", "Google credential không hợp lệ");
  }
};

export const classifyProviderError = (provider, error) => {
  if (error instanceof AnalyticsProviderError) return error;
  const timeoutCodes = new Set([4, "4", "ETIMEDOUT", "ESOCKETTIMEDOUT", "DEADLINE_EXCEEDED"]);
  if (timeoutCodes.has(error?.code)) {
    return new AnalyticsProviderError(provider, "PROVIDER_TIMEOUT", `${provider} không phản hồi kịp`);
  }
  return new AnalyticsProviderError(provider, "PROVIDER_ERROR", `${provider} tạm thời không khả dụng`);
};
