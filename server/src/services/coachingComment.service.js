import mongoose from "mongoose";
import CoachingComment from "../models/CoachingComment.js";
import { incrementMetric } from "../observability/metrics.js";
import {
  assertCommentAuthor,
  assertCommentId,
  assertCommentWritesEnabled,
  commentError,
} from "./coachingCommentAccess.service.js";
import { createCommentRevision, findCommentReplay } from "./coachingCommentCommand.service.js";
import { commentFingerprint, normalizeCommentBody } from "./coachingCommentContent.service.js";
import { toCoachingCommentDto } from "./coachingCommentDto.service.js";
import { resolveCoachingCommentTarget } from "./coachingCommentTarget.service.js";
import { createInAppNotification } from "./inAppNotification.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assertRequestId = (requestId) => {
  if (!UUID_PATTERN.test(String(requestId || ""))) {
    throw commentError(400, "requestId không hợp lệ", "INVALID_REQUEST_ID");
  }
};
const assertRevision = (revision) => {
  if (!Number.isInteger(revision) || revision < 1) {
    throw commentError(400, "expectedRevision không hợp lệ", "INVALID_REVISION");
  }
};
const assertActor = (actor) => {
  if (!["user", "trainer"].includes(actor.role)) {
    throw commentError(403, "Role không được bình luận", "COMMENT_ROLE_FORBIDDEN");
  }
};
const stale = () =>
  commentError(
    409,
    "Bình luận đã thay đổi, vui lòng tải lại",
    "STALE_COMMENT_REVISION",
  );
const result = (comment, viewerId, idempotentReplay = false) => ({
  data: toCoachingCommentDto(comment, viewerId),
  idempotentReplay,
  auditClientId: String(comment.clientId),
});
const actorForTarget = (actor, target) => ({
  ...actor,
  role: target.access.scope === "trainer" ? "trainer" : "user",
});

export const createCoachingComment = async ({
  actor,
  targetType,
  targetId,
  requestId,
  body,
}) => {
  assertCommentWritesEnabled();
  assertActor(actor);
  assertRequestId(requestId);
  const normalizedBody = normalizeCommentBody(body);
  await resolveCoachingCommentTarget({
    actor,
    targetType,
    targetId,
    write: true,
  });
  const payloadFingerprint = commentFingerprint({
    action: "create",
    targetType,
    targetId: String(targetId),
    body: normalizedBody,
  });
  const prior = await findCommentReplay({
    actorId: actor.id,
    requestId,
    action: "create",
    payloadFingerprint,
  });
  if (prior) return result(prior.comment, actor.id, true);

  const session = await mongoose.startSession();
  let output;
  let didCreate = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findCommentReplay({
        actorId: actor.id,
        requestId,
        action: "create",
        payloadFingerprint,
        session,
      });
      if (replay) {
        output = replay;
        return;
      }
      const target = await resolveCoachingCommentTarget({
        actor,
        targetType,
        targetId,
        write: true,
        session,
      });
      const commandActor = actorForTarget(actor, target);
      const [comment] = await CoachingComment.create(
        [
          {
            clientId: target.clientId,
            targetType,
            targetId,
            targetDateKey: target.targetDateKey,
            actorId: actor.id,
            actorRole: commandActor.role,
            body: normalizedBody,
            revision: 1,
          },
        ],
        { session },
      );
      await createCommentRevision({
        comment,
        actor: commandActor,
        action: "create",
        requestId,
        payloadFingerprint,
        beforeBody: null,
        afterBody: normalizedBody,
        session,
      });
      const recipientId =
        commandActor.role === "trainer"
          ? target.clientId
          : target.access.trainerId;
      if (recipientId) {
        await createInAppNotification({
          recipientId,
          actorId: actor.id,
          clientId: target.clientId,
          type: "coaching_comment_created",
          targetType: "coaching_comment",
          targetId: comment._id,
          dedupeKey:
            "coaching-comment:create:" +
            comment._id +
            ":" +
            comment.revision,
          deepLink:
            commandActor.role === "user"
              ? "/trainer/coaching"
              : targetType === "weekly_checkin"
                ? "/progress"
                : targetType === "workout_plan"
                  ? "/workout-plans/" + targetId
                  : targetType === "coaching_day"
                    ? "/online-coaching"
                    : "/today",
          session,
        });
      }
      didCreate = true;
      output = { comment, idempotentReplay: false };
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const replay = await findCommentReplay({
      actorId: actor.id,
      requestId,
      action: "create",
      payloadFingerprint,
    });
    if (!replay) throw stale();
    output = replay;
  } finally {
    await session.endSession();
  }
  if (didCreate) incrementMetric("coaching_comment.creates");
  return result(output.comment, actor.id, output.idempotentReplay);
};

const mutateComment = async ({
  actor,
  commentId,
  expectedRevision,
  requestId,
  body,
  action,
  now = new Date(),
}) => {
  assertCommentWritesEnabled();
  assertActor(actor);
  assertCommentId(commentId);
  assertRevision(expectedRevision);
  assertRequestId(requestId);
  const normalizedBody = action === "edit" ? normalizeCommentBody(body) : "";
  const existing = await CoachingComment.findById(commentId);
  if (!existing) {
    throw commentError(404, "Không tìm thấy bình luận", "COMMENT_NOT_FOUND");
  }
  const existingTarget = await resolveCoachingCommentTarget({
    actor,
    targetType: existing.targetType,
    targetId: existing.targetId,
    write: true,
  });
  assertCommentAuthor(actorForTarget(actor, existingTarget), existing);
  const payloadFingerprint = commentFingerprint({
    action,
    commentId: String(commentId),
    expectedRevision,
    body: normalizedBody,
  });
  const prior = await findCommentReplay({
    actorId: actor.id,
    requestId,
    action,
    payloadFingerprint,
  });
  if (prior) return result(prior.comment, actor.id, true);

  const session = await mongoose.startSession();
  let output;
  let didSave = false;
  try {
    await session.withTransaction(async () => {
      const replay = await findCommentReplay({
        actorId: actor.id,
        requestId,
        action,
        payloadFingerprint,
        session,
      });
      if (replay) {
        output = replay;
        return;
      }
      const comment = await CoachingComment.findById(commentId).session(session);
      if (!comment) {
        throw commentError(404, "Không tìm thấy bình luận", "COMMENT_NOT_FOUND");
      }
      const target = await resolveCoachingCommentTarget({
        actor,
        targetType: comment.targetType,
        targetId: comment.targetId,
        write: true,
        session,
      });
      const commandActor = actorForTarget(actor, target);
      assertCommentAuthor(commandActor, comment);
      if (comment.status === "removed") {
        throw commentError(409, "Bình luận đã được gỡ", "COMMENT_REMOVED");
      }
      if (comment.revision !== expectedRevision) {
        incrementMetric("coaching_comment.conflicts");
        throw stale();
      }
      const beforeBody = comment.body;
      const setFields =
        action === "edit"
          ? { body: normalizedBody, editedAt: now }
          : { body: "", status: "removed", removedAt: now };
      const updated = await CoachingComment.findOneAndUpdate(
        { _id: commentId, revision: expectedRevision },
        { $set: setFields, $inc: { revision: 1 } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!updated) throw stale();
      await createCommentRevision({
        comment: updated,
        actor: commandActor,
        action,
        requestId,
        payloadFingerprint,
        beforeBody,
        afterBody: action === "edit" ? normalizedBody : null,
        session,
      });
      didSave = true;
      output = { comment: updated, idempotentReplay: false };
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const replay = await findCommentReplay({
      actorId: actor.id,
      requestId,
      action,
      payloadFingerprint,
    });
    if (!replay) throw stale();
    output = replay;
  } finally {
    await session.endSession();
  }
  if (didSave) {
    incrementMetric(
      action === "edit"
        ? "coaching_comment.edits"
        : "coaching_comment.removals",
    );
  }
  return result(output.comment, actor.id, output.idempotentReplay);
};

export const editCoachingComment = (input) =>
  mutateComment({ ...input, action: "edit" });
export const removeCoachingComment = (input) =>
  mutateComment({ ...input, action: "remove" });
