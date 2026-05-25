import api from "../utils/api";

// Mua gói HLV (thanh toán bằng ví)
export const purchaseTrainerPlan = (planTitle, billingCycle) =>
  api.post("/trainer-subscriptions/purchase", { planTitle, billingCycle });

// Xem gói hiện tại
export const getMySubscription = () => api.get("/trainer-subscriptions/my");

// Admin: Lấy tất cả HLV có gói active
export const getAllSubscribers = (page = 1, limit = 10, search = "") =>
  api.get(`/trainer-subscriptions/all?page=${page}&limit=${limit}&search=${search}`);

// Admin: Xóa gói HLV
export const deleteSubscription = (id) =>
  api.delete(`/trainer-subscriptions/${id}`);
