import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import {
  createContactMessage,
  getContactMessages,
  updateContactStatus,
  deleteContactMessage,
} from "../controllers/contact.controller.js";
import {
  validateId,
  validateContactMessage,
} from "../middlewares/validation.js";
import { contactLimiter } from "../../src/middlewares/rateLimit.js";

const router = express.Router();

// Public route – không cần đăng nhập
router.post("/", contactLimiter, validateContactMessage, createContactMessage);

// Admin routes
router.get("/", protect, requireRoles("admin"), getContactMessages);
router.patch(
  "/:id/status",
  protect,
  requireRoles("admin"),
  validateId,
  updateContactStatus,
);
router.delete(
  "/:id",
  protect,
  requireRoles("admin"),
  validateId,
  deleteContactMessage,
);

export default router;
