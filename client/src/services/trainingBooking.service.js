import api from "../utils/api";

export const getMyBookings = () => api.get("/training-bookings/me");
export const getMyTrainer = () => api.get("/training-bookings/me/trainer");
export const getBusyTimes = (trainerId, occurrenceDateKey) =>
  api.get("/training-bookings/busy-times", {
    params: { trainerId, occurrenceDateKey },
  });

export const createBooking = (data) => api.post("/training-bookings", data);

export const updateBooking = (id, data) => api.put(`/training-bookings/${id}`, data);

export const cancelBooking = (id, data) =>
  api.delete(`/training-bookings/${id}`, { data });
