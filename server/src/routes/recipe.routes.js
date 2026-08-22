import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { recipeReviewMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateId,
  validateRecipeId,
  validateRecipeReview,
  validateRecipeNutrition,
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
import {
  getReviews,
  removeReview,
  upsertReview,
} from "../controllers/recipeReview.controller.js";

const router = express.Router();

// Public routes
router.get("/", getRecipes);
router.get("/categories", getRecipeCategories);
router.get("/areas", getRecipeAreas);
router.get("/detail/:slug", getRecipeBySlug);
router.get(
  "/:recipeId/reviews",
  optionalAuth,
  validateRecipeId,
  getReviews,
);
router.put(
  "/:recipeId/reviews",
  protect,
  csrfProtection,
  recipeReviewMutationLimiter,
  validateRecipeReview,
  upsertReview,
);
router.delete(
  "/:recipeId/reviews",
  protect,
  csrfProtection,
  recipeReviewMutationLimiter,
  validateRecipeId,
  removeReview,
);

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
  validateRecipeNutrition,
  createRecipe,
);
router.put(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  validateRecipeNutrition,
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
