import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { aiChatLimiter } from "../middlewares/aiRateLimit.js";
import { chatStream, getHistory, clearHistory } from "../controllers/ai.controller.js";

const router = express.Router();

// Tất cả routes đều cần đăng nhập
router.post("/chat", protect, csrfProtection, aiChatLimiter, chatStream);
router.get("/history", protect, getHistory);
router.delete("/history", protect, csrfProtection, clearHistory);

export default router;
