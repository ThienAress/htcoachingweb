import api from "../utils/api";

// Trainer/Admin: danh sách plans
export const getWorkoutPlans = (params = {}) =>
  api.get("/workout-plans", { params });

// Khách hàng: xem giáo án của mình
export const getMyWorkoutPlans = () =>
  api.get("/workout-plans/my");

// Chi tiết 1 plan
export const getWorkoutPlanById = (id) =>
  api.get(`/workout-plans/${id}`);

// Tạo plan mới
export const createWorkoutPlan = (data) =>
  api.post("/workout-plans", data);

// Cập nhật plan
export const updateWorkoutPlan = (id, data) =>
  api.put(`/workout-plans/${id}`, data);

// Xóa plan
export const deleteWorkoutPlan = (id) =>
  api.delete(`/workout-plans/${id}`);

// Nhân bản plan
export const duplicateWorkoutPlan = (id, data = {}) =>
  api.post(`/workout-plans/${id}/duplicate`, data);
