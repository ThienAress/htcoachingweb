import express from "express";
import { protect, requireRoles, requireTrainerAccess } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  validateCheckin,
  validateUpdateCheckin,
  validateId,
} from "../middlewares/validation.js";

import {
  createCheckin,
  getMyCheckins,
  getCheckins,
  updateCheckin,
  deleteCheckin,
} from "../controllers/checkin.controller.js";

const router = express.Router();

// 🔥 ADMIN ONLY
router.post(
  "/",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateCheckin,
  createCheckin,
);
router.get("/", protect, requireTrainerAccess, getCheckins);
router.put(
  "/:id",
  protect,
  csrfProtection,
  requireTrainerAccess,
  validateUpdateCheckin,
  updateCheckin,
);
router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteCheckin,
);

// 🔥 USER
router.get("/me", protect, getMyCheckins);

export default router;
