// routes/food.routes.js
import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
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
router.post("/", protect, requireRoles("admin"), validateFood, createFood);
router.post("/batch", protect, requireRoles("admin"), createManyFoods);
router.put("/:id", protect, requireRoles("admin"), validateId, updateFood);
router.delete("/:id", protect, requireRoles("admin"), validateId, deleteFood);

export default router;
