import CoachingCommentRevision from "../models/CoachingCommentRevision.js";
import CoachingDay from "../models/CoachingDay.js";
import DailyJournal from "../models/DailyJournal.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import {
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../utils/dateKey.js";
import { createProgressRange } from "./progressReadModel.service.js";

const id = (value) => (value ? String(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);
const event = ({
  eventType,
  occurredAt,
  targetType,
  sourceId,
  dateKey,
}) => ({
  eventType,
  occurredAt: iso(occurredAt),
  timeZone: "Asia/Ho_Chi_Minh",
  targetType,
  sourceId: id(sourceId),
  dateKey: dateKey || getVietnamDateKey(occurredAt),
});

const bounds = (range) => ({
  start: getVietnamDayRangeUtc(range.startDateKey).start,
  end: getVietnamDayRangeUtc(range.endDateKey).end,
});

const loadJournalEvents = async (clientId, range) => {
  const documents = await DailyJournal.find({
    clientId,
    dateKey: { $gte: range.startDateKey, $lte: range.endDateKey },
  })
    .select("_id dateKey status submittedAt createdAt updatedAt")
    .limit(100)
    .lean();
  return documents.map((item) =>
    event({
      eventType:
        item.status === "submitted"
          ? "daily_journal_submitted"
          : "daily_journal_updated",
      occurredAt: item.submittedAt || item.updatedAt || item.createdAt,
      targetType: "daily_journal",
      sourceId: item._id,
      dateKey: item.dateKey,
    }),
  );
};

const loadWeeklyEvents = async (clientId, range) => {
  const documents = await WeeklyCheckin.find({
    clientId,
    weekStartDateKey: {
      $gte: range.startDateKey,
      $lte: range.endDateKey,
    },
  })
    .select(
      "_id weekStartDateKey status submittedAt trainerReview.reviewedAt createdAt updatedAt",
    )
    .limit(20)
    .lean();
  return documents.map((item) => {
    const reviewedAt = item.trainerReview?.reviewedAt;
    return event({
      eventType: reviewedAt
        ? "weekly_checkin_reviewed"
        : item.submittedAt
          ? "weekly_checkin_submitted"
          : "weekly_checkin_updated",
      occurredAt: reviewedAt || item.submittedAt || item.updatedAt || item.createdAt,
      targetType: "weekly_checkin",
      sourceId: item._id,
      dateKey: item.weekStartDateKey,
    });
  });
};

const loadCommentEvents = async (clientId, rangeBounds) => {
  const revisions = await CoachingCommentRevision.find({
    clientId,
    changedAt: { $gte: rangeBounds.start, $lt: rangeBounds.end },
  })
    .select("commentId action changedAt")
    .sort({ changedAt: -1 })
    .limit(200)
    .lean();
  return revisions.map((item) =>
    event({
      eventType: "coaching_comment_" + item.action,
      occurredAt: item.changedAt,
      targetType: "coaching_comment",
      sourceId: item.commentId,
    }),
  );
};

const loadScheduleEvents = async (clientId, range, rangeBounds) => {
  const documents = await TrainingSchedule.find({
    clientId,
    status: { $in: ["completed", "cancelled"] },
    $or: [
      {
        occurrenceDateKey: {
          $gte: range.startDateKey,
          $lte: range.endDateKey,
        },
      },
      {
        occurrenceDateKey: { $in: [null, ""] },
        startAt: { $gte: rangeBounds.start, $lt: rangeBounds.end },
      },
    ],
  })
    .select(
      "_id occurrenceDateKey startAt status completedAt cancelledAt updatedAt",
    )
    .sort({ startAt: -1 })
    .limit(200)
    .lean();
  return documents.map((item) =>
    event({
      eventType: "training_schedule_" + item.status,
      occurredAt:
        item.completedAt || item.cancelledAt || item.updatedAt || item.startAt,
      targetType: "training_schedule",
      sourceId: item._id,
      dateKey: item.occurrenceDateKey || getVietnamDateKey(item.startAt),
    }),
  );
};

const loadPlanEvents = async (clientId, range, rangeBounds) => {
  const [coaching, workouts] = await Promise.all([
    CoachingDay.find({
      userId: clientId,
      clientStatus: "completed",
      dateString: { $gte: range.startDateKey, $lte: range.endDateKey },
    })
      .select("_id dateString updatedAt")
      .limit(100)
      .lean(),
    WorkoutPlan.find({
      clientId,
      status: "completed",
      planDate: { $gte: rangeBounds.start, $lt: rangeBounds.end },
    })
      .select("_id planDate updatedAt")
      .sort({ planDate: -1 })
      .limit(200)
      .lean(),
  ]);
  return [
    ...coaching.map((item) =>
      event({
        eventType: "coaching_day_completed",
        occurredAt: item.updatedAt,
        targetType: "coaching_day",
        sourceId: item._id,
        dateKey: item.dateString,
      }),
    ),
    ...workouts.map((item) =>
      event({
        eventType: "workout_plan_completed",
        occurredAt: item.updatedAt,
        targetType: "workout_plan",
        sourceId: item._id,
        dateKey: getVietnamDateKey(item.planDate),
      }),
    ),
  ];
};

export const getCoachingActivity = async ({
  clientId,
  days,
  now = new Date(),
}) => {
  const range = createProgressRange(days, now);
  const rangeBounds = bounds(range);
  const groups = await Promise.all([
    loadJournalEvents(clientId, range),
    loadWeeklyEvents(clientId, range),
    loadCommentEvents(clientId, rangeBounds),
    loadScheduleEvents(clientId, range, rangeBounds),
    loadPlanEvents(clientId, range, rangeBounds),
  ]);
  const items = groups
    .flat()
    .filter((item) => item.occurredAt)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 200);
  return {
    formulaVersion: "coaching-activity-v1",
    timeZone: "Asia/Ho_Chi_Minh",
    range,
    items,
  };
};
