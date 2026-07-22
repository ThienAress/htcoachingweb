import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  validateId,
  validateRecipeId,
} from "../middlewares/validation.js";
import upload from "../middlewares/recipeUpload.js";
import {
  getRecipes,
  getRecipeBySlug,
  getRecipeCategories,
  getRecipeAreas,
  toggleBookmark,
  addBookmark,
  removeBookmark,
  getBookmarkedRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getAdminRecipes,
  uploadThumbnail,
  loadRecipeForUpload,
} from "../controllers/recipe.controller.js";

const router = express.Router();

// Public routes
router.get("/", getRecipes);
router.get("/categories", getRecipeCategories);
router.get("/areas", getRecipeAreas);
router.get("/detail/:slug", getRecipeBySlug);

// User routes (cần đăng nhập)
router.get("/bookmarks", protect, getBookmarkedRecipes);
router.post(
  "/bookmarks/:recipeId",
  protect,
  csrfProtection,
  validateRecipeId,
  toggleBookmark,
);
router.put(
  "/bookmarks/:recipeId",
  protect,
  csrfProtection,
  validateRecipeId,
  addBookmark,
);
router.delete(
  "/bookmarks/:recipeId",
  protect,
  csrfProtection,
  validateRecipeId,
  removeBookmark,
);

// Admin routes
router.get(
  "/admin/list",
  protect,
  requireRoles("admin"),
  getAdminRecipes
);

router.post(
  "/",
  protect,
  csrfProtection,
  requireRoles("admin"),
  createRecipe,
);
router.put(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  updateRecipe,
);
router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteRecipe,
);

router.post(
  "/:id/thumbnail",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  loadRecipeForUpload,
  upload.single("image"),
  uploadThumbnail
);

export default router;
