import {
  createCoachingComment,
  editCoachingComment,
  removeCoachingComment,
} from "../services/coachingComment.service.js";
import { listCoachingComments } from "../services/coachingCommentRead.service.js";
import {
  deleteCoachingCommentData,
  exportCoachingCommentData,
} from "../services/coachingCommentPrivacy.service.js";
import { safeLog } from "../utils/safeLogger.js";
import AuditLog from "../models/AuditLog.js";
import { getContextualRequestActor } from "../utils/requestActor.js";

const actor = getContextualRequestActor;
const privateResponse = (res) =>
  res.setHeader("Cache-Control", "private, no-store");
const sendError = (res, error, event) => {
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code: error.codeName || error.code || "COACHING_COMMENT_FAILED",
    message:
      status >= 500
        ? "Không thể xử lý bình luận coaching lúc này"
        : error.message,
  });
};
const auditTrainer = (req, action, clientId, metadata) => {
  if (
    !actor(req).canActAsTrainer ||
    String(clientId) === String(req.user.id)
  ) {
    return null;
  }
  return AuditLog.create({
    actorId: req.user.id,
    actorRole: "trainer",
    action,
    targetType: "user",
    targetId: clientId,
    metadata,
  });
};

export const createComment = async (req, res) => {
  privateResponse(res);
  try {
    const result = await createCoachingComment({
      actor: actor(req),
      targetType: req.body.targetType,
      targetId: req.body.targetId,
      requestId: req.body.requestId,
      body: req.body.body,
    });
    const { auditClientId, ...publicResult } = result;
    await auditTrainer(
      req,
      "write_coaching_comment",
      auditClientId,
      { operation: "create", targetType: req.body.targetType },
    );
    return res
      .status(result.idempotentReplay ? 200 : 201)
      .json({ success: true, ...publicResult });
  } catch (error) {
    return sendError(res, error, "coaching_comment.create_failed");
  }
};

export const listComments = async (req, res) => {
  privateResponse(res);
  try {
    const result = await listCoachingComments({
      actor: actor(req),
      targetType: req.params.targetType,
      targetId: req.params.targetId,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 30),
    });
    const { auditClientId, ...data } = result;
    await auditTrainer(
      req,
      "read_coaching_comment_thread",
      auditClientId,
      {
        targetType: req.params.targetType,
        returned: data.items.length,
      },
    );
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "coaching_comment.list_failed");
  }
};

const mutate = (service, event) => async (req, res) => {
  privateResponse(res);
  try {
    const result = await service({
      actor: actor(req),
      commentId: req.params.commentId,
      expectedRevision: req.body.expectedRevision,
      requestId: req.body.requestId,
      body: req.body.body,
    });
    const { auditClientId, ...publicResult } = result;
    await auditTrainer(
      req,
      "write_coaching_comment",
      auditClientId,
      {
        operation:
          service === editCoachingComment ? "edit" : "remove",
      },
    );
    return res.json({ success: true, ...publicResult });
  } catch (error) {
    return sendError(res, error, event);
  }
};

export const editComment = mutate(
  editCoachingComment,
  "coaching_comment.edit_failed",
);
export const removeComment = mutate(
  removeCoachingComment,
  "coaching_comment.remove_failed",
);

export const exportMyComments = async (req, res) => {
  privateResponse(res);
  try {
    const data = await exportCoachingCommentData({
      clientId: req.user.id,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 50),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "coaching_comment.export_failed");
  }
};

export const deleteMyComments = async (req, res) => {
  privateResponse(res);
  try {
    const data = await deleteCoachingCommentData({ actor: actor(req) });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "coaching_comment.privacy_delete_failed");
  }
};
