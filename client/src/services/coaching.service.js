import api from "../utils/api";

// ================= KHÁCH HÀNG (CLIENT) =================

// 1. Lấy danh sách toàn bộ ngày tập của tôi
export const getMyPlans = () => api.get("/coaching/my-plans");

// 2. Lấy chi tiết bài tập ngày cụ thể
export const getMyPlanDetails = (dateString) =>
  api.get(`/coaching/my-plans/${dateString}`);

// 3. Khách hàng tích chọn hoàn thành bài, gửi phản hồi kèm file video phản hồi
export const submitFeedback = (dateString, formData) =>
  api.put(`/coaching/my-plans/${dateString}/feedback`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

// 3.b Khách hàng tải lên video phản hồi cho một bài tập cụ thể
export const uploadClientFeedbackVideo = (formData) =>
  api.post("/coaching/my-plans/upload-feedback-video", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

// ================= HUẤN LUYỆN VIÊN (TRAINER) =================

// 4. Lấy danh sách khách hàng đang hoạt động của Trainer
export const getTrainerClients = () => api.get("/coaching/trainer/clients");

// 5. Lấy dòng thời gian giáo án của một khách hàng cụ thể
export const getClientTimeline = (userId) =>
  api.get(`/coaching/trainer/clients/${userId}`);

// 6. Huấn luyện viên tạo mới hoặc cập nhật giáo án (Upsert)
export const upsertCoachingDay = (userId, data) =>
  api.post(`/coaching/trainer/clients/${userId}`, data);

// 7. Xoá giáo án của một ngày tập cụ thể
export const deleteCoachingDay = (userId, dateString) =>
  api.delete(`/coaching/trainer/clients/${userId}/${dateString}`);

// 8. Tải lên video demo bài tập của Trainer
export const uploadDemoVideo = (formData) =>
  api.post("/coaching/trainer/upload-demo", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
