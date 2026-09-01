import express from "express";

import {
  getRecentTrainerOrders,
  getActiveTrainerAssignments,
  previewTrainerTransfer,
  transferTrainer,
} from "../controllers/trainerTransfer.controller.js";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  validateRecentTrainerOrders,
  validateTrainerTransfer,
  validateTrainerTransferPreview,
} from "../middlewares/validation.js";

const router = express.Router();

router.use(protect, requireRoles("admin"));
router.get("/orders/recent", validateRecentTrainerOrders, getRecentTrainerOrders);
router.get("/assignments/active", validateRecentTrainerOrders, getActiveTrainerAssignments);
router.post(
  "/transfers/preview",
  csrfProtection,
  validateTrainerTransferPreview,
  previewTrainerTransfer,
);
router.post(
  "/transfers",
  csrfProtection,
  validateTrainerTransfer,
  transferTrainer,
);

export default router;
