import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { deprecatedRoute } from "../middlewares/deprecatedRoute.js";
import { scheduleMutationLimiter } from "../middlewares/rateLimit.js";
import {
  getMyBookings,
  getMyTrainer,
  getBusyTimes,
  createBooking,
  updateBooking,
  cancelBooking,
} from "../controllers/trainingBooking.controller.js";

// Bí danh cho /api/training-booking/* (tên cũ). Giữ cho client chưa cập nhật; gỡ khi api.deprecated_route_hits về 0.
const router = express.Router();

router.use(protect);

router.get("/my-booking", deprecatedRoute("/api/training-bookings/me"), getMyBookings);
router.get("/my-trainer", deprecatedRoute("/api/training-bookings/me/trainer"), getMyTrainer);
router.get("/busy-times", deprecatedRoute("/api/training-bookings/busy-times"), getBusyTimes);
router.post("/book", deprecatedRoute("/api/training-bookings"), scheduleMutationLimiter, csrfProtection, createBooking);
router.put("/book/:id", deprecatedRoute("/api/training-bookings/:id"), scheduleMutationLimiter, csrfProtection, updateBooking);
router.delete("/book/:id", deprecatedRoute("/api/training-bookings/:id"), scheduleMutationLimiter, csrfProtection, cancelBooking);

export default router;
