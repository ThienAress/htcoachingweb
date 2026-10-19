import api from "../utils/api";

export const getCheckins = (paramsOrPage = 1, limit = 10, signal) => {
  if (typeof paramsOrPage === 'string' && paramsOrPage.includes('page=')) {
    return api.get(`/check-ins?${paramsOrPage}`, { signal });
  }
  return api.get(`/check-ins?page=${paramsOrPage}&limit=${limit}`, { signal });
};

export const createCheckin = (data) => api.post("/check-ins", data);

export const updateCheckin = (id, data) => api.put(`/check-ins/${id}`, data);

export const deleteCheckin = (id) => api.delete(`/check-ins/${id}`);

export const getMyCheckins = () => api.get("/check-ins/me");
