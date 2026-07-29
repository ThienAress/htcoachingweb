import CoachingDay from "../models/CoachingDay.js";
import DailyJournal from "../models/DailyJournal.js";
import User from "../models/User.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import {
  assertCommentId,
  assertCommentTargetAccess,
  commentError,
} from "./coachingCommentAccess.service.js";
import { getVietnamDateKey } from "../utils/dateKey.js";

const MODELS = {
  daily_journal: DailyJournal,
  weekly_checkin: WeeklyCheckin,
  coaching_day: CoachingDay,
  workout_plan: WorkoutPlan,
};

const findTarget = async ({ targetType, targetId, session }) => {
  const Model = MODELS[targetType];
  if (!Model) {
    throw commentError(
      400,
      "targetType không hợp lệ",
      "INVALID_COMMENT_TARGET_TYPE",
    );
  }
  assertCommentId(targetId, "targetId");
  let query = Model.findById(targetId);
  if (session) query = query.session(session);
  const target = await query.lean();
  if (!target) {
    throw commentError(
      404,
      "Không tìm thấy nội dung được bình luận",
      "COMMENT_TARGET_NOT_FOUND",
    );
  }
  return target;
};

const targetOwner = async ({ targetType, target, session }) => {
  if (targetType === "daily_journal") {
    return { clientId: target.clientId, targetDateKey: target.dateKey };
  }
  if (targetType === "weekly_checkin") {
    return {
      clientId: target.clientId,
      targetDateKey: target.weekStartDateKey,
    };
  }
  if (targetType === "coaching_day") {
    return { clientId: target.userId, targetDateKey: target.dateString };
  }
  if (target.clientId) {
    return {
      clientId: target.clientId,
      targetDateKey: getVietnamDateKey(target.planDate),
    };
  }
  let userQuery = User.findOne({ email: target.clientEmail }).select("_id");
  if (session) userQuery = userQuery.session(session);
  const user = await userQuery.lean();
  if (!user) {
    throw commentError(
      409,
      "Workout Plan legacy chưa gắn được khách hàng",
      "COMMENT_TARGET_OWNER_REQUIRED",
    );
  }
  return {
    clientId: user._id,
    targetDateKey: getVietnamDateKey(target.planDate),
  };
};

export const resolveCoachingCommentTarget = async ({
  actor,
  targetType,
  targetId,
  write = false,
  session = null,
}) => {
  const target = await findTarget({ targetType, targetId, session });
  const owner = await targetOwner({ targetType, target, session });
  const access = await assertCommentTargetAccess({
    actor,
    clientId: owner.clientId,
    write,
    session,
  });
  if (
    targetType === "weekly_checkin" &&
    access.scope === "trainer" &&
    target.status === "draft"
  ) {
    throw commentError(
      404,
      "Không tìm thấy nội dung được bình luận",
      "COMMENT_TARGET_NOT_FOUND",
    );
  }
  return { ...owner, target, access };
};
