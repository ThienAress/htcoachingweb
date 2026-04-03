import api from "../utils/api";

export const createBooking = (data) => api.post("/bookings", data);

export const getBookings = (page = 1, limit = 20, status = "", search = "") => {
  let url = `/bookings?page=${page}&limit=${limit}`;
  if (status) url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return api.get(url);
};

export const updateBookingStatus = (id, status, noteAdmin) =>
  api.patch(`/bookings/${id}/status`, { status, noteAdmin });

export const deleteBooking = (id) => api.delete(`/bookings/${id}`);

export const checkUserHasBookings = () => api.get("/bookings/check-user");
