import express from "express";
import {
  createCustomerStory,
  deleteCustomerStory,
  getAdminCustomerStories,
  getAdminCustomerStoryById,
  getCustomerStories,
  getCustomerStoryBySlug,
  updateCustomerStory,
  updateCustomerStoryStatus,
  uploadCustomerStoryImageFile,
} from "../controllers/customerStory.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { validateId } from "../middlewares/validation.js";
import { uploadCustomerStoryImage } from "../middlewares/customerStoryUpload.js";

const router = express.Router();

router.get("/admin", protect, requireRoles("admin"), getAdminCustomerStories);
router.get(
  "/admin/:id",
  protect,
  requireRoles("admin"),
  validateId,
  getAdminCustomerStoryById,
);
router.post(
  "/admin",
  protect,
  csrfProtection,
  requireRoles("admin"),
  createCustomerStory,
);
router.post(
  "/admin/upload",
  protect,
  csrfProtection,
  requireRoles("admin"),
  uploadCustomerStoryImage.single("file"),
  uploadCustomerStoryImageFile,
);
router.patch(
  "/admin/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  updateCustomerStory,
);
router.patch(
  "/admin/:id/status",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  updateCustomerStoryStatus,
);
router.delete(
  "/admin/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteCustomerStory,
);

router.get("/", getCustomerStories);
router.get("/:slug", getCustomerStoryBySlug);

export default router;
