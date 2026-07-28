import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  validateId,
  validateTrainerPlanGrant,
  validateTrainerPlanPurchase,
} from "../middlewares/validation.js";
import {
  getAllSubscribers,
  cancelSubscription,
} from "../controllers/trainerSubscription.controller.js";
import {
  getMySubscription,
  getPendingTrainerGrants,
  getTrainerPlanCatalog,
  grantTrainerPlan,
  purchaseTrainerPlan,
  revokeTrainerGrant,
} from "../controllers/trainerSubscriptionLifecycle.controller.js";

const router = express.Router();

router.get("/catalog", getTrainerPlanCatalog);
router.post(
  "/purchase",
  protect,
  csrfProtection,
  validateTrainerPlanPurchase,
  purchaseTrainerPlan,
);
router.get("/my", protect, getMySubscription);

router.get("/all", protect, requireRoles("admin"), getAllSubscribers);
router.get(
  "/admin/grants/pending",
  protect,
  requireRoles("admin"),
  getPendingTrainerGrants,
);
router.post(
  "/admin/grants",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateTrainerPlanGrant,
  grantTrainerPlan,
);
router.post(
  "/admin/grants/:id/revoke",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  revokeTrainerGrant,
);

router.post(
  "/:id/cancel",
  protect,
  csrfProtection,
  requireRoles("admin"),
  validateId,
  cancelSubscription,
);

export default router;
