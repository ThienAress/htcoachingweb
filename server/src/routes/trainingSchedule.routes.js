import express from "express";
import { protect, requireTrainerAccess } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { scheduleMutationLimiter } from "../middlewares/rateLimit.js";

import {
  getMySchedules,
  getMyClients,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  completeSchedule,
  clearAllSchedules,
  getExerciseTypes,
} from "../controllers/trainingSchedule.controller.js";

const router = express.Router();

// 📋 Lấy danh sách loại bài tập cố định
router.get("/exercise-types", protect, requireTrainerAccess, getExerciseTypes);

// 📅 Lấy tất cả lịch tập của trainer hiện tại
router.get("/", protect, requireTrainerAccess, getMySchedules);

// 👥 Lấy danh sách khách hàng của trainer hiện tại
router.get("/my-clients", protect, requireTrainerAccess, getMyClients);

// ➕ Tạo 1 slot lịch tập
router.post("/", protect, scheduleMutationLimiter, requireTrainerAccess, csrfProtection, createSchedule);

// ✏️ Sửa 1 slot lịch tập
router.put("/:id", protect, scheduleMutationLimiter, requireTrainerAccess, csrfProtection, updateSchedule);

router.patch(
  "/:id/complete",
  protect,
  scheduleMutationLimiter,
  requireTrainerAccess,
  csrfProtection,
  completeSchedule,
);

// ❌ Xóa 1 slot lịch tập
router.delete("/:id", protect, scheduleMutationLimiter, requireTrainerAccess, csrfProtection, deleteSchedule);

// 🗑️ Xóa tất cả lịch tập (reset tuần)
router.delete("/", protect, scheduleMutationLimiter, requireTrainerAccess, csrfProtection, clearAllSchedules);

export default router;
