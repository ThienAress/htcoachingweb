import api from "../utils/api";

export const getCheckins = (paramsOrPage = 1, limit = 10, signal) => {
  if (typeof paramsOrPage === 'string' && paramsOrPage.includes('page=')) {
    return api.get(`/checkin?${paramsOrPage}`, { signal });
  }
  return api.get(`/checkin?page=${paramsOrPage}&limit=${limit}`, { signal });
};

export const createCheckin = (data) => api.post("/checkin", data);

export const updateCheckin = (id, data) => api.put(`/checkin/${id}`, data);

export const deleteCheckin = (id) => api.delete(`/checkin/${id}`);

export const getMyCheckins = () => api.get("/checkin/me");
