import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { bookingLimiter } from "../middlewares/rateLimit.js";
import { validateCreateBooking } from "../middlewares/validation.js";
import {
  createBooking,
  getBookings,
  updateBookingStatus,
  checkUserHasBookings,
  deleteBooking,
} from "../controllers/booking.controller.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";

const router = express.Router();

// Public route – có rate limit và validation
router.post(
  "/",
  bookingLimiter,
  validateCreateBooking,
  optionalAuth,
  createBooking,
);

// Admin routes
router.get("/", protect, requireRoles("admin"), getBookings);
router.patch(
  "/:id/status",
  protect,
  requireRoles("admin"),
  updateBookingStatus,
);
router.get("/check-user", protect, checkUserHasBookings);
router.delete("/:id", protect, requireRoles("admin"), deleteBooking);

export default router;
