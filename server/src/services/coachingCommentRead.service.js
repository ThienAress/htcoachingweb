import CoachingComment from "../models/CoachingComment.js";
import { toCoachingCommentDto } from "./coachingCommentDto.service.js";
import { resolveCoachingCommentTarget } from "./coachingCommentTarget.service.js";
import { assertCommentTargetAccess } from "./coachingCommentAccess.service.js";

export const listCoachingComments = async ({
  actor,
  targetType,
  targetId,
  page = 1,
  limit = 30,
}) => {
  const target = await resolveCoachingCommentTarget({
    actor,
    targetType,
    targetId,
  });
  let canComment = false;
  if (process.env.TODAY_COMMENT_WRITES_ENABLED === "true") {
    try {
      await assertCommentTargetAccess({
        actor,
        clientId: target.clientId,
        write: true,
      });
      canComment = true;
    } catch (error) {
      if (error.statusCode !== 403) throw error;
    }
  }
  const filter = { targetType, targetId };
  const [documents, total] = await Promise.all([
    CoachingComment.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CoachingComment.countDocuments(filter),
  ]);
  return {
    items: documents.map((comment) =>
      toCoachingCommentDto(comment, actor.id),
    ),
    pagination: { page, limit, total },
    capabilities: { canComment },
    auditClientId: String(target.clientId),
  };
};
