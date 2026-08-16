import express from "express";

import { addSource, getSkillRadar, previewSource } from "../controllers/skillRadar.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { skillRadarMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateSkillRadarPreview,
  validateSkillRadarCreate,
} from "../middlewares/validation.js";

const router = express.Router();

router.get("/", protect, requireRoles("admin"), getSkillRadar);
router.post(
  "/preview",
  protect,
  requireRoles("admin"),
  skillRadarMutationLimiter,
  csrfProtection,
  validateSkillRadarPreview,
  previewSource,
);
router.post(
  "/sources",
  protect,
  requireRoles("admin"),
  skillRadarMutationLimiter,
  csrfProtection,
  validateSkillRadarCreate,
  addSource,
);

export default router;
