import express from "express";

import { getSkillRadar } from "../controllers/skillRadar.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, requireRoles("admin"), getSkillRadar);

export default router;
