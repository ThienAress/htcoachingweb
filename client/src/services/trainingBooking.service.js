import api from "../utils/api";

export const getMyBookings = () => api.get("/training-booking/my-booking");
export const getMyTrainer = () => api.get("/training-booking/my-trainer");
export const getBusyTimes = (trainerId, occurrenceDateKey) =>
  api.get("/training-booking/busy-times", {
    params: { trainerId, occurrenceDateKey },
  });

export const createBooking = (data) => api.post("/training-booking/book", data);

export const updateBooking = (id, data) => api.put(`/training-booking/book/${id}`, data);

export const cancelBooking = (id, data) =>
  api.delete(`/training-booking/book/${id}`, { data });
