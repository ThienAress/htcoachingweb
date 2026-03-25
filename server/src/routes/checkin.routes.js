import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";

import {
  createCheckin,
  getMyCheckins,
  getCheckins,
  updateCheckin,
  deleteCheckin,
} from "../controllers/checkin.controller.js";

const router = express.Router();

// 🔥 ADMIN ONLY
router.post("/", protect, requireRoles("admin", "trainer"), createCheckin);
router.get("/", protect, requireRoles("admin", "trainer"), getCheckins);
router.put("/:id", protect, requireRoles("admin"), updateCheckin);
router.delete("/:id", protect, requireRoles("admin"), deleteCheckin);

// 🔥 USER
router.get("/me", protect, getMyCheckins);

export default router;
