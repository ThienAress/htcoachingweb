import api from "../utils/api";

export const getGyms = (district, search) => {
  const params = new URLSearchParams();
  if (district && district !== "Tất cả") params.append("district", district);
  if (search) params.append("search", search);
  return api.get(`/gyms?${params.toString()}`);
};

export const getAllGyms = () => api.get("/gyms/all");

export const getDistricts = () => api.get("/gyms/districts");

export const createGym = (formData) => api.post("/gyms", formData, {
  headers: { "Content-Type": "multipart/form-data" }
});

export const updateGym = (id, formData) => api.put(`/gyms/${id}`, formData, {
  headers: { "Content-Type": "multipart/form-data" }
});

export const deleteGym = (id) => api.delete(`/gyms/${id}`);

export const seedGyms = () => api.post("/gyms/seed");
