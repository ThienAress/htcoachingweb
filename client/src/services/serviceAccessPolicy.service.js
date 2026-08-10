import api from "../utils/api";

export const getServiceAccessPolicies = (signal) =>
  api.get("/admin/service-access-policies", { signal });

export const getCommunityFeatureReport = (filters, signal) =>
  api.get("/admin/service-access-policies/community-features/report", {
    params: filters,
    signal,
  });

export const downloadCommunityFeatureReportPdf = (filters) =>
  api.get("/admin/service-access-policies/community-features/report.pdf", {
    params: filters,
    responseType: "blob",
  });
