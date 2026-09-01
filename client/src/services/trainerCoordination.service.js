import api from "../utils/api";

export const getRecentTrainerOrders = (params = {}) =>
  api.get("/admin/trainer-coordination/orders/recent", { params });

export const getActiveTrainerAssignments = (params = {}) =>
  api.get("/admin/trainer-coordination/assignments/active", { params });

export const previewTrainerTransfer = (payload) =>
  api.post("/admin/trainer-coordination/transfers/preview", payload);

export const executeTrainerTransfer = (payload) =>
  api.post("/admin/trainer-coordination/transfers", payload);
