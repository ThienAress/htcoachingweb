import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import {
  setupTestDB,
  teardownTestDB,
} from "../../__tests__/setup.js";
import CoachingComment from "../../models/CoachingComment.js";
import CoachingHabit from "../../models/CoachingHabit.js";
import DailyJournal from "../../models/DailyJournal.js";
import InAppNotification from "../../models/InAppNotification.js";
import TrainingSchedule from "../../models/TrainingSchedule.js";
import WeeklyCheckin from "../../models/WeeklyCheckin.js";
import WorkoutPlan from "../../models/WorkoutPlan.js";

const collectStages = (value, stages = []) => {
  if (!value || typeof value !== "object") return stages;
  if (typeof value.stage === "string") stages.push(value.stage);
  for (const child of Object.values(value)) collectStages(child, stages);
  return stages;
};

const clientId = new mongoose.Types.ObjectId();
const targetId = new mongoose.Types.ObjectId();
const dateRange = { $gte: "2026-07-01", $lte: "2026-07-29" };
const timeRange = {
  $gte: new Date("2026-07-01T00:00:00.000Z"),
  $lt: new Date("2026-07-30T00:00:00.000Z"),
};

const CASES = [
  {
    name: "Daily Journal client/date range",
    model: DailyJournal,
    filter: { clientId, dateKey: dateRange },
    index: "uniq_daily_journal_client_date",
  },
  {
    name: "Weekly Check-in client/week range",
    model: WeeklyCheckin,
    filter: { clientId, weekStartDateKey: dateRange },
    index: "uniq_weekly_checkin_client_week",
  },
  {
    name: "Coaching Comment target thread",
    model: CoachingComment,
    filter: { targetType: "daily_journal", targetId },
    index: "coaching_comment_target_thread",
    sort: { createdAt: 1 },
  },
  {
    name: "Notification recipient inbox",
    model: InAppNotification,
    filter: { recipientId: clientId, readAt: null },
    index: "in_app_notification_inbox",
    sort: { createdAt: -1 },
  },
  {
    name: "Training Schedule client/date range",
    model: TrainingSchedule,
    filter: { clientId, occurrenceDateKey: dateRange },
    index: "training_schedule_client_day_range",
    sort: { startAt: 1 },
  },
  {
    name: "Workout Plan client/status/date range",
    model: WorkoutPlan,
    filter: {
      clientId,
      status: { $in: ["published", "completed"] },
      planDate: timeRange,
    },
    index: "workout_plan_client_status_range",
    sort: { planDate: 1 },
  },
  {
    name: "Coaching Habit progress range",
    model: CoachingHabit,
    filter: {
      clientId,
      createdAt: { $lt: timeRange.$lt },
      "schedule.startDateKey": { $lte: dateRange.$lte },
    },
    index: "coaching_habit_client_progress_range",
    sort: { createdAt: 1 },
  },
];

beforeAll(async () => {
  await setupTestDB();
  await Promise.all([...new Set(CASES.map(({ model }) => model))].map(
    (model) => model.init(),
  ));
});
afterAll(teardownTestDB);

describe("Today Dashboard critical query plans", () => {
  it.each(CASES)("$name uses an indexed bounded plan", async ({
    model,
    filter,
    index,
    sort,
  }) => {
    let query = model.find(filter).hint(index).limit(100);
    if (sort) query = query.sort(sort);
    const explain = await query.explain("executionStats");

    expect(collectStages(explain)).toContain("IXSCAN");
    expect(explain.executionStats.totalDocsExamined).toBe(0);
  });
});
