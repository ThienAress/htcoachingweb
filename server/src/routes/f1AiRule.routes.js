import express from "express";
import { protect, requireRoles } from "../middlewares/auth.middleware.js";
import {
  getAiRules,
  getAiRuleById,
  createAiRule,
  updateAiRule,
  deleteAiRule,
} from "../controllers/f1AiRule/f1AiRule.controller.js";

const router = express.Router();

// All routes require admin access
router.use(protect, requireRoles("admin"));

router.route("/").get(getAiRules).post(createAiRule);

router
  .route("/:id")
  .get(getAiRuleById)
  .put(updateAiRule)
  .delete(deleteAiRule);

export default router;
