import api from "../utils/api";

export const getFitnessPlusCatalog = ({ signal } = {}) =>
  api.get("/fitness-plus-subscriptions/catalog", { signal });

export const purchaseFitnessPlusPlan = (payload) =>
  api.post("/fitness-plus-subscriptions", payload);

export const getMyFitnessPlusSubscription = ({ signal } = {}) =>
  api.get("/fitness-plus-subscriptions/me", { signal });

export const getFitnessPlusPurchaseQuote = ({ planCode, billingCycle, signal } = {}) =>
  api.get("/fitness-plus-subscriptions/quotes", { params: { planCode, billingCycle }, signal });
