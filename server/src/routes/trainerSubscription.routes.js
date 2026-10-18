import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { deprecatedRoute } from "../middlewares/deprecatedRoute.js";
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
// Mua gói là tạo một đăng ký: POST vào tập hợp. /purchase cũ giữ làm bí danh; gỡ khi api.deprecated_route_hits về 0.
router.post("/", protect, csrfProtection, validateTrainerPlanPurchase, purchaseTrainerPlan);
router.post(
  "/purchase",
  protect,
  csrfProtection,
  deprecatedRoute("/api/trainer-subscriptions"),
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
