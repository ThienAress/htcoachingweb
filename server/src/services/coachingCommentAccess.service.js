import mongoose from "mongoose";
import Order from "../models/Order.js";

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
    let query = Order.findOne({
      userId: clientId,
      status: "approved",
      sessions: { $gt: 0 },
    }).select("_id trainerId");
    if (session) query = query.session(session);
    const order = await query.lean();
    if (order) {
      return {
        scope: "client",
        orderId: order._id,
        trainerId: order.trainerId,
      };
    }
  }
  if (actor.role === "trainer" || actor.canActAsTrainer) {
    let query = Order.findOne({
      userId: clientId,
      trainerId: actor.id,
      status: "approved",
      sessions: { $gt: 0 },
    }).select("_id");
    if (session) query = query.session(session);
    const order = await query.lean();
    if (order) {
      return {
        scope: "trainer",
        orderId: order._id,
        trainerId: actor.id,
      };
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
