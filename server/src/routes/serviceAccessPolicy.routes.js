import express from "express";

import {
  downloadCommunityFeatureReportPdf,
  getCommunityFeatureReport,
  getServiceAccessPolicies,
} from "../controllers/serviceAccessPolicy.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/community-features/report.pdf",
  protect,
  requireRoles("admin"),
  downloadCommunityFeatureReportPdf,
);
router.get(
  "/community-features/report",
  protect,
  requireRoles("admin"),
  getCommunityFeatureReport,
);
router.get("/", protect, requireRoles("admin"), getServiceAccessPolicies);

export default router;
