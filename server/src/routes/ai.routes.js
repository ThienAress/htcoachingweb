import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { aiChatLimiter } from "../middlewares/aiRateLimit.js";
import {
  chatStream,
  getHistory,
  clearHistory,
  getConversations,
  getConversationById,
  deleteConversation,
} from "../controllers/ai.controller.js";

const router = express.Router();

// Tất cả routes đều cần đăng nhập
router.post("/chat", protect, csrfProtection, aiChatLimiter, chatStream);
router.get("/history", protect, getHistory);
router.delete("/history", protect, csrfProtection, clearHistory);

// Multi-conversation support
router.get("/conversations", protect, getConversations);
router.get("/conversations/:id", protect, getConversationById);
router.delete("/conversations/:id", protect, csrfProtection, deleteConversation);

export default router;
