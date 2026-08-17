import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { ensureAiActor } from "../middlewares/aiGuestSession.js";
import { optionalAiAuth } from "../middlewares/optionalAiAuth.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { enforceSharedServiceUsage } from "../middlewares/serviceUsageLedger.js";
import { aiConfirmationLimiter } from "../middlewares/rateLimit.js";
import { prepareAiChatRequest } from "../middlewares/aiChatRequest.js";
import {
  aiChatLimiter,
  aiGuestChatLimiter,
  fitnessPlusAiChatLimiter,
} from "../middlewares/aiRateLimit.js";
import { resolveServiceAccessTierMiddleware } from "../middlewares/resolveServiceAccessTier.js";
import {
  chatStream,
  getHistory,
  clearHistory,
  getConversations,
  getConversationById,
  deleteConversation,
  forkConversation,
  submitFeedback,
} from "../controllers/ai.controller.js";
import {
  exportMyAiMemory,
  getMyAiMemory,
  removeAllMyAiMemory,
  removeMyAiMemory,
  updateMyAiMemory,
  updateMyAiMemoryConsent,
} from "../controllers/aiMemory.controller.js";
import {
  validateAiMemoryConsent,
  validateAiMemoryKind,
  validateAiMemoryUpdate,
  validateAiToolConfirmation,
} from "../middlewares/validation.js";
import {
  cancelAiTool,
  confirmAiTool,
} from "../controllers/aiToolConfirmation.controller.js";

const router = express.Router();

// Chat cho phép guest có quota; history và thao tác conversation vẫn cần login.
router.post(
  "/chat",
  optionalAiAuth,
  ensureAiActor,
  csrfProtection,
  prepareAiChatRequest,
  resolveServiceAccessTierMiddleware,
  aiGuestChatLimiter,
  fitnessPlusAiChatLimiter,
  aiChatLimiter,
  enforceSharedServiceUsage("ai_chat"),
  chatStream,
);
router.get("/history", protect, getHistory);
router.delete("/history", protect, csrfProtection, clearHistory);

// Explicit, owner-controlled long-term memory. Guest access is never allowed.
router.get("/memory", protect, getMyAiMemory);
router.get("/memory/export", protect, exportMyAiMemory);
router.put(
  "/memory/consent",
  protect,
  csrfProtection,
  validateAiMemoryConsent,
  updateMyAiMemoryConsent,
);
router.put(
  "/memory/:kind",
  protect,
  csrfProtection,
  validateAiMemoryUpdate,
  updateMyAiMemory,
);
router.delete(
  "/memory/:kind",
  protect,
  csrfProtection,
  validateAiMemoryKind,
  removeMyAiMemory,
);
router.delete("/memory", protect, csrfProtection, removeAllMyAiMemory);

router.post(
  "/tool-confirmations/confirm",
  protect,
  aiConfirmationLimiter,
  csrfProtection,
  validateAiToolConfirmation,
  confirmAiTool,
);
router.post(
  "/tool-confirmations/cancel",
  protect,
  aiConfirmationLimiter,
  csrfProtection,
  validateAiToolConfirmation,
  cancelAiTool,
);

// Multi-conversation support
router.get("/conversations", protect, getConversations);
router.get("/conversations/:id", protect, getConversationById);
router.delete("/conversations/:id", protect, csrfProtection, deleteConversation);
router.post("/conversations/:id/fork", protect, csrfProtection, forkConversation);

// Feedback
router.post("/conversations/:id/feedback", protect, csrfProtection, submitFeedback);

export default router;
