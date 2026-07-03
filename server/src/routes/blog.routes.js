import express from "express";
import {
  getPublicBlogPosts,
  getPublicBlogPostBySlug,
  getAdminBlogPosts,
  getAdminBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  uploadBlogImage,
} from "../controllers/blog.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { validateId } from "../middlewares/validation.js";
import { uploadBlogImageMiddleware } from "../middlewares/blogUpload.js";

const router = express.Router();

// ==================== ADMIN ====================
router.get("/admin", protect, requireRoles("admin"), getAdminBlogPosts);
router.get(
  "/admin/:id",
  protect,
  requireRoles("admin"),
  validateId,
  getAdminBlogPostById,
);
router.post(
  "/admin",
  protect,
  csrfProtection,
  requireRoles("admin"),
  createBlogPost,
);
router.post(
  "/admin/upload",
  protect,
  csrfProtection,
  requireRoles("admin"),
  uploadBlogImageMiddleware.single("file"),
  uploadBlogImage,
);
router.patch(
  "/admin/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  updateBlogPost,
);
router.delete(
  "/admin/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteBlogPost,
);

// ==================== PUBLIC ====================
router.get("/", getPublicBlogPosts);
router.get("/:slug", getPublicBlogPostBySlug);

export default router;
