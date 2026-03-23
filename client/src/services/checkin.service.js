import api from "../utils/api";

export const getCheckins = () => api.get("/checkin");

export const createCheckin = (data) => api.post("/checkin", data);

export const updateCheckin = (id, data) => api.put(`/checkin/${id}`, data);

export const deleteCheckin = (id) => api.delete(`/checkin/${id}`);

export const getMyCheckins = () => api.get("/checkin/me");
