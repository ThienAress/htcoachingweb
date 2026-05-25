import api from "../utils/api";

export const getOrders = (page = 1, limit = 5) => api.get(`/orders?page=${page}&limit=${limit}`);

export const createOrder = (data) => api.post("/orders", data);

export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);

export const approveOrder = (id) => api.put(`/orders/${id}/approve`);

export const deleteOrder = (id) => api.delete(`/orders/${id}`);
