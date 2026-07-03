import { Router } from "express";
import { getGyms, getAllGyms, getDistricts, createGym, updateGym, deleteGym, seedGyms } from "../controllers/gym.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { uploadGymImage } from "../middlewares/gymUpload.js";

const router = Router();

// Public
router.get("/", getGyms);
router.get("/districts", getDistricts);

// Admin only
router.get("/all", protect, requireRoles("admin"), getAllGyms);
router.post("/", protect, csrfProtection, requireRoles("admin"), uploadGymImage.single("image"), createGym);
router.put("/:id", protect, csrfProtection, requireRoles("admin"), uploadGymImage.single("image"), updateGym);
router.delete("/:id", protect, csrfProtection, requireRoles("admin"), deleteGym);
router.post("/seed", protect, csrfProtection, requireRoles("admin"), seedGyms);

export default router;
