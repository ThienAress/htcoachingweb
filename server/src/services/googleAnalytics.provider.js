import { BetaAnalyticsDataClient } from "@google-analytics/data";

import {
  AnalyticsProviderError,
  assertAnalyticsWindow,
  classifyProviderError,
  gaDateToDateKey,
  googleCredentialsFromEnv,
  normalizeAnalyticsPagePath,
  normalizeAnalyticsToken,
  providerMetric,
} from "./seoAnalyticsProvider.js";

const ALLOWED_EVENTS = new Set([
  "blog_read_engaged",
  "consultation_cta_click",
  "generate_lead",
]);

const reports = [
  { type: "overview", dimensions: ["date"], metrics: ["activeUsers", "newUsers"] },
  { type: "page", dimensions: ["date", "pagePath"], metrics: ["activeUsers"] },
  {
    type: "source_medium",
    dimensions: ["date", "sessionSource", "sessionMedium"],
    metrics: ["activeUsers"],
  },
  {
    type: "page_source_medium",
    dimensions: ["date", "pagePath", "sessionSource", "sessionMedium"],
    metrics: ["activeUsers"],
  },
  { type: "device", dimensions: ["date", "deviceCategory"], metrics: ["activeUsers"] },
  {
    type: "page_device",
    dimensions: ["date", "pagePath", "deviceCategory"],
    metrics: ["activeUsers"],
  },
  { type: "event", dimensions: ["date", "eventName"], metrics: ["eventCount"] },
  {
    type: "blog_event",
    dimensions: ["date", "eventName", "customEvent:content_slug"],
    metrics: ["eventCount"],
    optional: true,
  },
];

const values = (row, key) =>
  key === "dimensions"
    ? (row.dimensionValues || []).map(({ value }) => value)
    : (row.metricValues || []).map(({ value }) => value);

const mapRow = (type, row) => {
  const dimensions = values(row, "dimensions");
  const metrics = values(row, "metrics");
  const base = {
    provider: "ga4",
    dateKey: gaDateToDateKey(dimensions[0], "ga4"),
    contentPath: "",
  };
  if (type === "overview") {
    const activeUsers = providerMetric(metrics[0], "ga4");
    const newUsers = providerMetric(metrics[1], "ga4");
    return {
      ...base,
      dimension: "overview",
      dimensionKey: "all",
      metrics: {
        activeUsers,
        newUsers,
        returningUsers: Math.max(activeUsers - newUsers, 0),
      },
    };
  }
  if (type === "page") {
    const pagePath = normalizeAnalyticsPagePath(dimensions[1]);
    if (!pagePath) return null;
    return {
      ...base,
      dimension: "page",
      dimensionKey: pagePath,
      metrics: { activeUsers: providerMetric(metrics[0], "ga4") },
    };
  }
  if (type === "source_medium" || type === "page_source_medium") {
    const pageOffset = type === "page_source_medium" ? 1 : 0;
    const pagePath = pageOffset
      ? normalizeAnalyticsPagePath(dimensions[1])
      : "";
    const source = normalizeAnalyticsToken(dimensions[1 + pageOffset]);
    const medium = normalizeAnalyticsToken(dimensions[2 + pageOffset]);
    if (pageOffset && !pagePath) return null;
    if (!source || !medium) return null;
    return {
      ...base,
      dimension: "source_medium",
      dimensionKey: `${source}/${medium}`,
      contentPath: pagePath,
      metrics: { activeUsers: providerMetric(metrics[0], "ga4") },
    };
  }
  if (type === "device" || type === "page_device") {
    const pageOffset = type === "page_device" ? 1 : 0;
    const pagePath = pageOffset
      ? normalizeAnalyticsPagePath(dimensions[1])
      : "";
    if (pageOffset && !pagePath) return null;
    const device = normalizeAnalyticsToken(dimensions[1 + pageOffset], "other");
    return {
      ...base,
      dimension: "device",
      dimensionKey: ["desktop", "mobile", "tablet"].includes(device) ? device : "other",
      contentPath: pagePath,
      metrics: { activeUsers: providerMetric(metrics[0], "ga4") },
    };
  }
  const eventName = normalizeAnalyticsToken(dimensions[1]);
  if (!ALLOWED_EVENTS.has(eventName)) return null;
  const blogSlug =
    type === "blog_event" ? normalizeAnalyticsToken(dimensions[2]) : "";
  if (type === "blog_event" && !blogSlug) return null;
  const count = providerMetric(metrics[0], "ga4");
  return {
    ...base,
    dimension: "event",
    dimensionKey: eventName,
    contentPath: blogSlug ? `/blog/${blogSlug}/` : "",
    metrics:
      eventName === "blog_read_engaged"
        ? { engagedReads: count }
        : eventName === "consultation_cta_click"
          ? { ctaClicks: count }
          : { leads: count },
  };
};

export const createGa4Provider = ({ client, propertyId, timeoutMs = 10_000 }) => {
  if (!client || !propertyId) {
    throw new AnalyticsProviderError("ga4", "INVALID_CONFIG", "GA4 chưa được cấu hình");
  }
  return {
    provider: "ga4",
    configured: true,
    async fetchWindow({ startDate, endDate }) {
      assertAnalyticsWindow(startDate, endDate);
      try {
        const responses = await Promise.all(
          reports.map(async (report) => {
            try {
              const [response] = await client.runReport(
                {
                  property: String(propertyId).startsWith("properties/")
                    ? String(propertyId)
                    : `properties/${propertyId}`,
                  dateRanges: [{ startDate, endDate }],
                  dimensions: report.dimensions.map((name) => ({ name })),
                  metrics: report.metrics.map((name) => ({ name })),
                  limit: 10_000,
                },
                { timeout: timeoutMs },
              );
              return {
                rows: (response?.rows || [])
                  .map((row) => mapRow(report.type, row))
                  .filter(Boolean),
                partial: false,
              };
            } catch (error) {
              if (report.optional) return { rows: [], partial: true };
              throw error;
            }
          }),
        );
        return {
          provider: "ga4",
          rows: responses.flatMap(({ rows }) => rows),
          partial: responses.some(({ partial }) => partial),
        };
      } catch (error) {
        throw classifyProviderError("ga4", error);
      }
    },
  };
};

export const createDefaultGa4Provider = ({ env = process.env } = {}) => {
  const propertyId = env.GA4_PROPERTY_ID;
  const hasCredential = Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS,
  );
  if (!propertyId || !hasCredential) {
    return { provider: "ga4", configured: false };
  }
  try {
    const credentials = googleCredentialsFromEnv(env);
    const client = new BetaAnalyticsDataClient(credentials ? { credentials } : {});
    return createGa4Provider({ client, propertyId });
  } catch (error) {
    return {
      provider: "ga4",
      configured: false,
      configurationError: error?.code || "INVALID_CONFIG",
    };
  }
};
