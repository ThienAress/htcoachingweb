import api from "../utils/api";

// Danh sách yêu cầu nạp tiền (filter)
export const getAdminDeposits = (status = "all") =>
  api.get(`/admin/deposits?status=${status}`);

// Duyệt nạp tiền
export const approveDeposit = (id) => api.post(`/admin/deposits/${id}/approve`);

// Từ chối nạp tiền
export const rejectDeposit = (id, reason) =>
  api.post(`/admin/deposits/${id}/reject`, { reason });

export const reverseDeposit = (id, reason) =>
  api.post("/admin/deposits/" + id + "/reverse", { reason });

// Chỉ xóa yêu cầu expired/rejected chưa tạo ledger.
export const deleteAdminDeposit = (id) => api.delete(`/admin/deposits/${id}`);

export const getIncomingBankTransactions = ({
  status = "needs_review",
  page = 1,
  limit = 25,
  signal,
} = {}) =>
  api.get("/admin/deposits/incoming", {
    params: { status, page, limit },
    signal,
  });

export const approveIncomingBankTransaction = (id, payload) =>
  api.post(`/admin/deposits/incoming/${id}/approve`, payload);

export const ignoreIncomingBankTransaction = (id, reason) =>
  api.post(`/admin/deposits/incoming/${id}/ignore`, { reason });

export const reverseIncomingBankTransaction = (id, reason) =>
  api.post(`/admin/deposits/incoming/${id}/reverse`, { reason });
