import api from "../utils/api";

export const getAnalyticsOverview = (params, signal) =>
  api.get("/admin/analytics/overview", { params, signal });

export const getAnalyticsProviders = (signal) =>
  api.get("/admin/analytics/providers", { signal });

export const getAnalyticsBlogs = (params, signal) =>
  api.get("/admin/analytics/blog", { params, signal });

export const getAnalyticsKeywords = (params, signal) =>
  api.get("/admin/analytics/keywords", { params, signal });

export const getAnalyticsBlogDetail = (slug, params, signal) =>
  api.get(`/admin/analytics/blog/${encodeURIComponent(slug)}`, {
    params,
    signal,
  });

export const syncAnalyticsProvider = (data) =>
  api.post("/admin/analytics/sync", data);
