import api from "../utils/api";

export const sendContactMessage = (data) => api.post("/contact", data);
export const getContactMessages = (
  page = 1,
  limit = 10,
  status = "",
  search = "",
) => {
  let url = `/contact?page=${page}&limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return api.get(url);
};
export const updateContactStatus = (id, status) =>
  api.patch(`/contact/${id}/status`, { status });
export const deleteContactMessage = (id) => api.delete(`/contact/${id}`);
