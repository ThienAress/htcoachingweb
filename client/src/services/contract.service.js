import api from "../utils/api";

export const getContracts = (params) => api.get("/contracts", { params });

export const getApprovedOrders = () => api.get("/contracts/approved-orders");

export const createContract = (orderId) => api.post("/contracts", { orderId });

export const getContractById = (id) => api.get(`/contracts/${id}`);

export const updateContract = (id, data) => api.put(`/contracts/${id}`, data);

export const sendContractToClient = (id) => api.post(`/contracts/${id}/send`);

export const signContract = (id, signatureImage) =>
  api.post(`/contracts/${id}/sign`, { signatureImage });

export const markAsViewed = (id) => api.post(`/contracts/${id}/view`);

export const downloadContract = (id) =>
  api.get(`/contracts/${id}/download`, { responseType: "blob" });

export const cancelContract = (id) => api.put(`/contracts/${id}/cancel`);

export const deleteContractApi = (id) => api.delete(`/contracts/${id}`);

export const getMyContracts = () => api.get("/contracts/my");

export const clientDownloadContract = (id) =>
  api.get(`/contracts/${id}/client-download`, { responseType: "blob" });
