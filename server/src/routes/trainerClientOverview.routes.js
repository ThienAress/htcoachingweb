import express from "express";
import { readTrainerClientOverview } from "../controllers/trainerClientOverview.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireTrainerActor } from "../middlewares/trainerAccess.middleware.js";
import { progressReadLimiter } from "../middlewares/rateLimit.js";
import { validateTrainerClientOverview } from "../middlewares/validation.js";

const router = express.Router();
router.get(
  "/:clientId",
  protect,
  requireTrainerActor,
  progressReadLimiter,
  validateTrainerClientOverview,
  readTrainerClientOverview,
);

export default router;
