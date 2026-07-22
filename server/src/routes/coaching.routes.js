import express from "express";
import {
  protect,
  requireRoles,
  requireTrainerAccess,
} from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { uploadCoachingVideo } from "../middlewares/coachingUpload.js";
import {
  getMyPlans,
  getMyPlanDetails,
  submitFeedback,
  getTrainerClients,
  getClientTimeline,
  upsertCoachingDay,
  deleteCoachingDay,
  uploadCoachingDemoVideo,
  uploadClientFeedbackVideo,
} from "../controllers/coaching.controller.js";

const router = express.Router();

// ================= ROUTES CHO KHÁCH HÀNG (CLIENT) =================
// 1. Lấy danh sách toàn bộ ngày tập của khách hàng hiện tại
router.get("/my-plans", protect, getMyPlans);

// 2. Lấy chi tiết giáo án ngày tập cụ thể
router.get("/my-plans/:dateString", protect, getMyPlanDetails);

// 3. Khách tích chọn hoàn thành bài, gửi text feedback + file video phản hồi
router.put(
  "/my-plans/:dateString/feedback",
  protect,
  csrfProtection,
  uploadCoachingVideo.single("video"),
  submitFeedback
);

// 3.b Khách hàng tải lên video phản hồi cho một bài tập cụ thể
router.post(
  "/my-plans/upload-feedback-video",
  protect,
  csrfProtection,
  uploadCoachingVideo.single("video"),
  uploadClientFeedbackVideo
);

// ================= ROUTES CHO HUẤN LUYỆN VIÊN (TRAINER) =================
// 4. Lấy danh sách khách hàng đang hoạt động của Trainer
router.get("/trainer/clients", protect, requireTrainerAccess, getTrainerClients);

// 5. Lấy dòng thời gian giáo án của một khách hàng cụ thể
router.get("/trainer/clients/:userId", protect, requireTrainerAccess, getClientTimeline);

// 6. Tạo mới hoặc cập nhật giáo án tập luyện của một khách hàng trong ngày cụ thể
router.post("/trainer/clients/:userId", protect, requireTrainerAccess, csrfProtection, upsertCoachingDay);

// 7. Xoá giáo án tập luyện của một khách hàng trong ngày cụ thể
router.delete("/trainer/clients/:userId/:dateString", protect, requireTrainerAccess, csrfProtection, deleteCoachingDay);

// 8. Tải lên video demo bài tập của Trainer
router.post(
  "/trainer/upload-demo",
  protect,
  requireRoles("admin", "trainer"),
  csrfProtection,
  uploadCoachingVideo.single("video"),
  uploadCoachingDemoVideo
);

export default router;
