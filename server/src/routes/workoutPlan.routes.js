import express from "express";
import { protect, requireRoles, requireTrainerAccess } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { validateId } from "../middlewares/validation.js";
import {
  getWorkoutPlans,
  getMyWorkoutPlans,
  getWorkoutPlanById,
  createWorkoutPlan,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  duplicateWorkoutPlan,
} from "../controllers/workoutPlan.controller.js";

const router = express.Router();

// Khách hàng xem giáo án của mình (phải đặt TRƯỚC /:id)
router.get("/my", protect, getMyWorkoutPlans);

// Trainer/Admin: danh sách plans
router.get("/", protect, requireTrainerAccess, getWorkoutPlans);

// Trainer/Admin: chi tiết plan (client cũng xem được — check trong controller)
router.get("/:id", protect, validateId, getWorkoutPlanById);

// Trainer/Admin: tạo plan
router.post("/", protect, csrfProtection, requireTrainerAccess, createWorkoutPlan);

// Trainer/Admin: cập nhật plan
router.put("/:id", protect, csrfProtection, requireTrainerAccess, validateId, updateWorkoutPlan);

// Trainer/Admin: nhân bản plan
router.post("/:id/duplicate", protect, csrfProtection, requireTrainerAccess, validateId, duplicateWorkoutPlan);

// Trainer/Admin: xóa plan
router.delete("/:id", protect, csrfProtection, requireTrainerAccess, validateId, deleteWorkoutPlan);

export default router;
