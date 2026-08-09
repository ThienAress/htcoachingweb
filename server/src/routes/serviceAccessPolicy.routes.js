import express from "express";

import { getServiceAccessPolicies } from "../controllers/serviceAccessPolicy.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", protect, requireRoles("admin"), getServiceAccessPolicies);

export default router;
