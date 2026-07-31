import express from "express";
import {
  createComment,
  editComment,
  exportMyComments,
  deleteMyComments,
  listComments,
  removeComment,
} from "../controllers/coachingComment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { attachOptionalTrainerAccess } from "../middlewares/trainerAccess.middleware.js";
import { csrfProtection } from "../middlewares/csrf.js";
import { coachingCommentMutationLimiter } from "../middlewares/rateLimit.js";
import {
  validateCoachingCommentCreate,
  validateCoachingCommentList,
  validateCoachingCommentEdit,
  validateCoachingCommentRemove,
  validateCoachingCommentExport,
  validateDeleteCoachingComments,
} from "../middlewares/validation.js";

const router = express.Router();
router.use(protect, attachOptionalTrainerAccess);
router.get(
  "/privacy/export",
  validateCoachingCommentExport,
  exportMyComments,
);
router.delete(
  "/privacy",
  coachingCommentMutationLimiter,
  csrfProtection,
  validateDeleteCoachingComments,
  deleteMyComments,
);
router.get(
  "/:targetType/:targetId",
  validateCoachingCommentList,
  listComments,
);
router.post(
  "/",
  coachingCommentMutationLimiter,
  csrfProtection,
  validateCoachingCommentCreate,
  createComment,
);
router.patch(
  "/:commentId",
  coachingCommentMutationLimiter,
  csrfProtection,
  validateCoachingCommentEdit,
  editComment,
);
router.delete(
  "/:commentId",
  coachingCommentMutationLimiter,
  csrfProtection,
  validateCoachingCommentRemove,
  removeComment,
);

export default router;
