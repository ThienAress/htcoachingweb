import { Router } from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import {
  getEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  createFromConversation,
  searchEntries,
  getStats,
  regenerateEmbedding,
  mergeVariant,
  getVariants,
  deleteVariant,
  getAllConversations,
  getFullConversation,
  getCategories,
  suggestFromConversations,
} from "../controllers/knowledgeBase.controller.js";

const router = Router();

// Tất cả routes cần admin auth
router.use(protect, requireRoles("admin"));

// Read-only routes (không cần CSRF)
router.get("/", getEntries);
router.get("/search", searchEntries);
router.get("/stats", getStats);
router.get("/categories", getCategories);
router.get("/conversations", getAllConversations);
router.get("/conversations/:id", getFullConversation);

// Mutating routes (cần CSRF)
router.post("/", csrfProtection, createEntry);
router.put("/:id", csrfProtection, updateEntry);
router.delete("/:id", csrfProtection, deleteEntry);
router.post("/from-conversation", csrfProtection, createFromConversation);
router.post("/ai-suggest", csrfProtection, suggestFromConversations);
router.post("/:id/regenerate-embedding", csrfProtection, regenerateEmbedding);
router.post("/:id/merge", csrfProtection, mergeVariant);
router.get("/:id/variants", getVariants);
router.delete("/:id/variants/:variantId", csrfProtection, deleteVariant);

export default router;
