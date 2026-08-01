import api from "../utils/api";

export const getTrainerPlanCatalog = () =>
  api.get("/trainer-subscriptions/catalog");

export const purchaseTrainerPlan = (payload) =>
  api.post("/trainer-subscriptions/purchase", payload);

export const getMySubscription = ({ signal } = {}) =>
  api.get("/trainer-subscriptions/my", { signal });

export const getAllSubscribers = (page = 1, limit = 10, search = "") =>
  api.get("/trainer-subscriptions/all", {
    params: { page, limit, search },
  });

export const cancelSubscription = (id, reason) =>
  api.post(`/trainer-subscriptions/${id}/cancel`, { reason });

export const grantTrainerPlanByEmail = (payload) =>
  api.post("/trainer-subscriptions/admin/grants", payload);

export const getPendingTrainerGrants = (page = 1, limit = 20) =>
  api.get("/trainer-subscriptions/admin/grants/pending", {
    params: { page, limit },
  });

export const revokePendingTrainerGrant = (id) =>
  api.post(`/trainer-subscriptions/admin/grants/${id}/revoke`);
