import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  getMyBookings,
  getMyTrainer,
  getBusyTimes,
  createBooking,
  updateBooking,
} from "../controllers/trainingBooking.controller.js";

const router = express.Router();

// Require login
router.use(protect);

// Chỉ user mới được tạo lịch booking. (Thực tế trainer cũng có role user, nhưng logic này dành cho client interface)
router.get("/my-booking", getMyBookings);
router.get("/my-trainer", getMyTrainer);
router.get("/busy-times", getBusyTimes);
router.post("/book", csrfProtection, createBooking);
router.put("/book/:id", csrfProtection, updateBooking);

export default router;
