import api from "../utils/api";

// Mua gói HLV (thanh toán bằng ví)
export const purchaseTrainerPlan = (planTitle, billingCycle, requestId) =>
  api.post("/trainer-subscriptions/purchase", {
    planTitle,
    billingCycle,
    requestId,
  });

// Xem gói hiện tại
export const getMySubscription = () => api.get("/trainer-subscriptions/my");

// Admin: Lấy tất cả HLV có gói active
export const getAllSubscribers = (page = 1, limit = 10, search = "") =>
  api.get(`/trainer-subscriptions/all?page=${page}&limit=${limit}&search=${search}`);

// Admin: Hủy entitlement, giữ nguyên subscription và ledger để đối soát.
export const cancelSubscription = (id, reason) =>
  api.post("/trainer-subscriptions/" + id + "/cancel", { reason });
