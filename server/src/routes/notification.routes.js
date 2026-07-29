import express from "express";
import {
  getMyNotificationPreference,
  listMyNotifications,
  readAllNotifications,
  readNotification,
  updateMyNotificationPreference,
} from "../controllers/notification.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { notificationMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateNotificationList,
  validateNotificationPreference,
  validateNotificationRead,
} from "../middlewares/validation.js";

const router = express.Router();
router.use(protect);
router.get("/preferences", getMyNotificationPreference);
router.put(
  "/preferences",
  notificationMutationLimiter,
  csrfProtection,
  validateNotificationPreference,
  updateMyNotificationPreference,
);
router.post(
  "/read-all",
  notificationMutationLimiter,
  csrfProtection,
  readAllNotifications,
);
router.post(
  "/:notificationId/read",
  notificationMutationLimiter,
  csrfProtection,
  validateNotificationRead,
  readNotification,
);
router.get("/", validateNotificationList, listMyNotifications);

export default router;
