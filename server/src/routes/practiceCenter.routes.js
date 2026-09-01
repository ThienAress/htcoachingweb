import express from "express";

import {
  getPracticeCenter,
  sendPracticeCenterSimulation,
} from "../controllers/practiceCenter.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { practiceCenterLimiter } from "../middlewares/practiceCenterRateLimit.js";
import { requirePracticeCenterAccess } from "../middlewares/practiceCenterAccess.js";
import { validatePracticeCenterRequest } from "../middlewares/practiceCenterValidation.js";

const router = express.Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.use(protect, requirePracticeCenterAccess);

router.get("/", getPracticeCenter);
router.post(
  "/send",
  csrfProtection,
  practiceCenterLimiter,
  validatePracticeCenterRequest,
  sendPracticeCenterSimulation,
);

export default router;
