import api from "../utils/api";

export const sendContactMessage = (data) => api.post("/contact-messages", data);
export const getContactMessages = (
  page = 1,
  limit = 10,
  status = "",
  search = "",
  signal,
) => {
  let url = `/contact-messages?page=${page}&limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return api.get(url, { signal });
};
export const updateContactStatus = (id, status) =>
  api.patch(`/contact-messages/${id}/status`, { status });
export const deleteContactMessage = (id) => api.delete(`/contact-messages/${id}`);
