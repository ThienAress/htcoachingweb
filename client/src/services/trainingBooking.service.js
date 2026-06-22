import api from "../utils/api";

export const getMyBookings = () => api.get("/training-booking/my-booking");
export const getMyTrainer = () => api.get("/training-booking/my-trainer");
export const getBusyTimes = (trainerId, dayOfWeek) => 
  api.get(`/training-booking/busy-times?trainerId=${trainerId}&dayOfWeek=${dayOfWeek}`);

export const createBooking = (data) => api.post("/training-booking/book", data);

export const updateBooking = (id, data) => api.put(`/training-booking/book/${id}`, data);
