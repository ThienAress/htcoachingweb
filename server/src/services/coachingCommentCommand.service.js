import CoachingComment from "../models/CoachingComment.js";
import CoachingCommentRevision from "../models/CoachingCommentRevision.js";
import { incrementMetric } from "../observability/metrics.js";
import { commentError } from "./coachingCommentAccess.service.js";
import { hashCommentBody } from "./coachingCommentContent.service.js";

export const findCommentReplay = async ({
  actorId,
  requestId,
  action,
  payloadFingerprint,
  session = null,
}) => {
  let query = CoachingCommentRevision.findOne({ actorId, requestId }).select(
    "+payloadFingerprint",
  );
  if (session) query = query.session(session);
  const revision = await query;
  if (!revision) return null;
  if (
    revision.action !== action ||
    revision.payloadFingerprint !== payloadFingerprint
  ) {
    throw commentError(
      409,
      "requestId đã được dùng với thao tác hoặc dữ liệu khác",
      "COACHING_COMMENT_REQUEST_ID_REUSED",
    );
  }
  let commentQuery = CoachingComment.findById(revision.commentId);
  if (session) commentQuery = commentQuery.session(session);
  const comment = await commentQuery;
  incrementMetric("coaching_comment.idempotency_hits");
  return { comment, idempotentReplay: true };
};

export const createCommentRevision = ({
  comment,
  actor,
  action,
  requestId,
  payloadFingerprint,
  beforeBody,
  afterBody,
  session,
}) =>
  CoachingCommentRevision.create(
    [
      {
        commentId: comment._id,
        clientId: comment.clientId,
        revision: comment.revision,
        actorId: actor.id,
        actorRole: actor.role,
        action,
        requestId,
        payloadFingerprint,
        beforeHash: beforeBody === null ? null : hashCommentBody(beforeBody),
        afterHash: afterBody === null ? null : hashCommentBody(afterBody),
      },
    ],
    { session },
  );
