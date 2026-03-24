import api from "../utils/api";

export const getOrders = (page = 1) => api.get(`/orders?page=${page}`);

export const createOrder = (data) => api.post("/orders", data);

export const updateOrder = (id, data) => api.put(`/orders/${id}`, data);

export const approveOrder = (id) => api.put(`/orders/${id}/approve`);

export const deleteOrder = (id) => api.delete(`/orders/${id}`);
