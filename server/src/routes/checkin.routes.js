import express from "express";
import { protect, requireAdmin } from "../middlewares/auth.middleware.js";

import {
  createCheckin,
  getMyCheckins,
  getCheckins,
  updateCheckin,
  deleteCheckin,
} from "../controllers/checkin.controller.js";

const router = express.Router();

// 🔥 ADMIN ONLY
router.post("/", protect, requireAdmin, createCheckin);
router.put("/:id", protect, requireAdmin, updateCheckin);
router.delete("/:id", protect, requireAdmin, deleteCheckin);
router.get("/", protect, requireAdmin, getCheckins);

// 🔥 USER
router.get("/me", protect, getMyCheckins);

export default router;
