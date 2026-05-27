import api from "../utils/api";

// Danh sách yêu cầu nạp tiền (filter)
export const getAdminDeposits = (status = "all") =>
  api.get(`/admin/deposits?status=${status}`);

// Duyệt nạp tiền
export const approveDeposit = (id) => api.post(`/admin/deposits/${id}/approve`);

// Từ chối nạp tiền
export const rejectDeposit = (id, reason) =>
  api.post(`/admin/deposits/${id}/reject`, { reason });

// Xóa yêu cầu nạp tiền
export const deleteAdminDeposit = (id) => api.delete(`/admin/deposits/${id}`);
