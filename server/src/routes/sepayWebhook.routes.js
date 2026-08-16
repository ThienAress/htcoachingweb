import express from "express";

import { receiveSePayWebhook } from "../controllers/sepayWebhook.controller.js";
import { sepayWebhookLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.post(
  "/",
  sepayWebhookLimiter,
  express.raw({ type: "application/json", limit: "64kb" }),
  receiveSePayWebhook,
);

export default router;
