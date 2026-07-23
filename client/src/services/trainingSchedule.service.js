import api from "../utils/api";

// Lấy tất cả lịch tập của trainer hiện tại
export const getMySchedules = () => api.get("/training-schedules");

export const getMyClients = () => api.get("/training-schedules/my-clients");

// Lấy danh sách loại bài tập cố định
export const getExerciseTypes = () => api.get("/training-schedules/exercise-types");

// Tạo 1 slot lịch tập
export const createSchedule = (data) => api.post("/training-schedules", data);

// Sửa 1 slot lịch tập
export const updateSchedule = (id, data) => api.put(`/training-schedules/${id}`, data);

// Xóa 1 slot lịch tập
export const deleteSchedule = (id, data) =>
  api.delete(`/training-schedules/${id}`, { data });

// Xóa tất cả lịch tập (reset tuần)
export const clearAllSchedules = (data) =>
  api.delete("/training-schedules", { data });

export const completeSchedule = (id, data) =>
  api.patch(`/training-schedules/${id}/complete`, data);
