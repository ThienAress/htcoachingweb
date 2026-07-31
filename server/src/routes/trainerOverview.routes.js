import express from "express";
import { getTrainerOverview } from "../controllers/trainerOverview.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTrainerActor } from "../middlewares/trainerAccess.middleware.js";
import { progressReadLimiter } from "../middlewares/rateLimit.js";
import { validateTrainerOverview } from "../middlewares/validation.js";

const router = express.Router();
router.get(
  "/clients/:clientId",
  protect,
  requireTrainerActor,
  progressReadLimiter,
  validateTrainerOverview,
  getTrainerOverview,
);

export default router;
