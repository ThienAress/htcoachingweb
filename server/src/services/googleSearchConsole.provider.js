import { google } from "googleapis";

import {
  AnalyticsProviderError,
  assertAnalyticsWindow,
  classifyProviderError,
  googleCredentialsFromEnv,
  isSafeSearchQuery,
  normalizeAnalyticsPagePath,
  normalizeAnalyticsToken,
  providerMetric,
} from "./seoAnalyticsProvider.js";

const reportDefinitions = [
  { type: "overview", dimensions: ["date"] },
  { type: "page", dimensions: ["date", "page"] },
  { type: "query", dimensions: ["date", "query", "page"] },
  { type: "device", dimensions: ["date", "device"] },
];

const mapMetrics = (row) => ({
  clicks: providerMetric(row.clicks ?? 0, "gsc"),
  impressions: providerMetric(row.impressions ?? 0, "gsc"),
  ctr: providerMetric(row.ctr ?? 0, "gsc", { max: 1 }),
  position: providerMetric(row.position ?? 0, "gsc"),
});

const mapRow = (type, row, siteUrl) => {
  const keys = row.keys || [];
  const base = {
    provider: "gsc",
    dateKey: String(keys[0] || ""),
    metrics: mapMetrics(row),
    contentPath: "",
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base.dateKey)) {
    throw new AnalyticsProviderError("gsc", "MALFORMED_RESPONSE", "GSC trả ngày không hợp lệ");
  }
  if (type === "overview") return { ...base, dimension: "overview", dimensionKey: "all" };
  if (type === "page") {
    const path = normalizeAnalyticsPagePath(keys[1], siteUrl);
    return path ? { ...base, dimension: "page", dimensionKey: path } : null;
  }
  if (type === "query") {
    const query = String(keys[1] || "").trim();
    const path = normalizeAnalyticsPagePath(keys[2], siteUrl);
    return isSafeSearchQuery(query) && path
      ? { ...base, dimension: "query", dimensionKey: query, contentPath: path }
      : null;
  }
  const device = normalizeAnalyticsToken(keys[1], "other");
  return {
    ...base,
    dimension: "device",
    dimensionKey: ["desktop", "mobile", "tablet"].includes(device) ? device : "other",
  };
};

export const createSearchConsoleProvider = ({
  client,
  siteUrl,
  timeoutMs = 10_000,
  rowLimit = 5_000,
  maxPages = 4,
}) => {
  if (!client?.searchanalytics?.query || !siteUrl) {
    throw new AnalyticsProviderError("gsc", "INVALID_CONFIG", "GSC chưa được cấu hình");
  }
  return {
    provider: "gsc",
    configured: true,
    async fetchWindow({ startDate, endDate }) {
      assertAnalyticsWindow(startDate, endDate);
      let partial = false;
      try {
        const reports = await Promise.all(
          reportDefinitions.map(async ({ type, dimensions }) => {
            const mapped = [];
            for (let page = 0; page < maxPages; page += 1) {
              const response = await client.searchanalytics.query({
                siteUrl,
                requestBody: {
                  startDate,
                  endDate,
                  dimensions,
                  rowLimit,
                  startRow: page * rowLimit,
                },
                timeout: timeoutMs,
              });
              const rows = response?.data?.rows || [];
              mapped.push(...rows.map((row) => mapRow(type, row, siteUrl)).filter(Boolean));
              if (rows.length < rowLimit) break;
              if (page === maxPages - 1) partial = true;
            }
            return mapped;
          }),
        );
        return {
          provider: "gsc",
          rows: reports.flat(),
          partial,
          topRowsOnly: true,
        };
      } catch (error) {
        throw classifyProviderError("gsc", error);
      }
    },
  };
};

export const createDefaultSearchConsoleProvider = ({ env = process.env } = {}) => {
  const siteUrl = env.GSC_SITE_URL;
  const hasCredential = Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS,
  );
  if (!siteUrl || !hasCredential) {
    return { provider: "gsc", configured: false };
  }
  try {
    const credentials = googleCredentialsFromEnv(env);
    const auth = new google.auth.GoogleAuth({
      ...(credentials ? { credentials } : {}),
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const client = google.webmasters({ version: "v3", auth });
    return createSearchConsoleProvider({ client, siteUrl });
  } catch (error) {
    return {
      provider: "gsc",
      configured: false,
      configurationError: error?.code || "INVALID_CONFIG",
    };
  }
};
