import api from "../utils/api";

export const getServiceAccessPolicies = (signal) =>
  api.get("/admin/service-access-policies", { signal });
