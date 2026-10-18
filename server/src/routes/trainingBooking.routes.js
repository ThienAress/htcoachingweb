import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { scheduleMutationLimiter } from "../middlewares/rateLimit.js";
import {
  getMyBookings,
  getMyTrainer,
  getBusyTimes,
  createBooking,
  updateBooking,
  cancelBooking,
} from "../controllers/trainingBooking.controller.js";

const router = express.Router();

// Require login
router.use(protect);

// Chỉ user mới được tạo lịch booking. (Thực tế trainer cũng có role user, nhưng logic này dành cho client interface)
// Đường mới theo quy tắc đặt tên API (.claude/rules/api-design.md). Đường cũ (/api/training-booking/...) nằm ở trainingBookingLegacy.routes.js.
router.get("/me", getMyBookings);
router.get("/me/trainer", getMyTrainer);
router.get("/busy-times", getBusyTimes);
router.post("/", scheduleMutationLimiter, csrfProtection, createBooking);
router.put("/:id", scheduleMutationLimiter, csrfProtection, updateBooking);
router.delete("/:id", scheduleMutationLimiter, csrfProtection, cancelBooking);

export default router;
