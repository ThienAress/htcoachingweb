import mongoose from "mongoose";
import { assertEffectiveCoachAccess, resolveEffectiveClientCoach } from "./effectiveCoach.service.js";

export const commentError = (statusCode, message, codeName) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.codeName = codeName;
  return error;
};

export const assertCommentWritesEnabled = () => {
  if (process.env.TODAY_COMMENT_WRITES_ENABLED !== "true") {
    throw commentError(
      503,
      "Bình luận coaching đang tạm dừng ghi dữ liệu",
      "COACHING_COMMENT_WRITES_DISABLED",
    );
  }
};

export const assertCommentId = (value, field = "commentId") => {
  if (!mongoose.isValidObjectId(value)) {
    throw commentError(400, field + " không hợp lệ", "INVALID_COMMENT_ID");
  }
};

export const assertCommentTargetAccess = async ({
  actor,
  clientId,
  write = false,
  session = null,
}) => {
  if (
    ["user", "trainer"].includes(actor.role) &&
    String(actor.id) === String(clientId)
  ) {
    if (!write) return { scope: "client" };
    try {
      const { order, trainerId } = await resolveEffectiveClientCoach({ clientId, session });
      return {
        scope: "client",
        orderId: order._id,
        trainerId,
      };
    } catch (error) {
      if (error.statusCode !== 403) throw error;
    }
  }
  if (["trainer", "admin"].includes(actor.role) || actor.canActAsTrainer) {
    try {
      const { order, trainerId } = await assertEffectiveCoachAccess({ actor, clientId, session });
      return {
        scope: "trainer",
        orderId: order._id,
        trainerId,
      };
    } catch (error) {
      if (error.statusCode !== 403) throw error;
    }
  }
  throw commentError(
    403,
    write
      ? "Không có quyền bình luận vào nội dung này"
      : "Không có quyền xem luồng bình luận này",
    "COACHING_COMMENT_FORBIDDEN",
  );
};

export const assertCommentAuthor = (actor, comment) => {
  if (
    String(actor.id) !== String(comment.actorId) ||
    actor.role !== comment.actorRole
  ) {
    throw commentError(
      403,
      "Chỉ tác giả được sửa hoặc gỡ bình luận",
      "COACHING_COMMENT_AUTHOR_REQUIRED",
    );
  }
};
