import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { validateId, validateFood } from "../middlewares/validation.js";
import {
  getFoods,
  getFoodById,
  createFood,
  createManyFoods,
  updateFood,
  deleteFood,
} from "../controllers/food.controller.js";

const router = express.Router();

// Public routes (ai cũng xem được)
router.get("/", getFoods);
router.get("/:id", validateId, getFoodById);

// Admin only
router.post(
  "/",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateFood,
  createFood,
);
router.post(
  "/batch",
  protect,
  csrfProtection,
  requireRoles("admin"),
  createManyFoods,
);
router.put(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  updateFood,
);
router.delete(
  "/:id",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  deleteFood,
);

export default router;
