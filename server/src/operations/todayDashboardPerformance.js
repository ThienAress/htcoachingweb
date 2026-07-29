import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "../config/env.js";
import connectDB from "../config/db.js";
import {
  assertConnectedMigrationTarget,
  assertMigrationEnvironment,
} from "../config/migrationSafety.js";
import CoachingCommentRevision from "../models/CoachingCommentRevision.js";
import CoachingHabit from "../models/CoachingHabit.js";
import DailyJournal from "../models/DailyJournal.js";
import InAppNotification from "../models/InAppNotification.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import {
  addDaysToDateKey,
  getVietnamDateKey,
  getVietnamDayRangeUtc,
} from "../utils/dateKey.js";
import { getCoachingActivity } from "../services/coachingActivity.service.js";
import { getClientProgress } from "../services/progress.service.js";
import { getTodayDashboard } from "../services/todayDashboard.service.js";

export const TODAY_PERFORMANCE_BUDGETS = Object.freeze({
  p95Ms: 2000,
  maxPayloadBytes: 512 * 1024,
  queryDocuments: {
    daily_journal_range: 100,
    weekly_checkin_range: 20,
    coaching_habit_range: 500,
    coaching_comment_activity: 200,
    notification_inbox: 50,
    training_schedule_range: 200,
    workout_plan_range: 200,
  },
});

const collectStages = (value, stages = new Set()) => {
  if (!value || typeof value !== "object") return stages;
  if (typeof value.stage === "string") stages.add(value.stage);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) collectStages(item, stages);
    } else {
      collectStages(child, stages);
    }
  }
  return stages;
};

const explain = async ({ name, query, maxDocuments }) => {
  const result = await query.explain("executionStats");
  const stages = [
    ...collectStages(result.queryPlanner?.winningPlan),
  ].sort();
  const statistics = result.executionStats || {};
  return {
    name,
    stages,
    nReturned: statistics.nReturned || 0,
    totalKeysExamined: statistics.totalKeysExamined || 0,
    totalDocsExamined: statistics.totalDocsExamined || 0,
    maxDocuments,
    pass:
      !stages.includes("COLLSCAN") &&
      (statistics.totalDocsExamined || 0) <= maxDocuments,
  };
};

const percentile = (values, ratio) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * ratio) - 1, sorted.length - 1)];
};

const explainCriticalQueries = async ({
  clientId,
  startDateKey,
  endDateKey,
  budgets,
}) => {
  const start = getVietnamDayRangeUtc(startDateKey).start;
  const end = getVietnamDayRangeUtc(endDateKey).end;
  const specs = [
    {
      name: "daily_journal_range",
      query: DailyJournal.find({
        clientId,
        dateKey: { $gte: startDateKey, $lte: endDateKey },
      })
        .select("_id dateKey")
        .hint("uniq_daily_journal_client_date")
        .limit(100),
    },
    {
      name: "weekly_checkin_range",
      query: WeeklyCheckin.find({
        clientId,
        weekStartDateKey: { $gte: startDateKey, $lte: endDateKey },
      })
        .select("_id weekStartDateKey")
        .hint("uniq_weekly_checkin_client_week")
        .limit(20),
    },
    {
      name: "coaching_habit_range",
      query: CoachingHabit.find({
        clientId,
        createdAt: { $lt: end },
        "schedule.startDateKey": { $lte: endDateKey },
      })
        .select("_id createdAt")
        .hint("coaching_habit_client_progress_range")
        .limit(500),
    },
    {
      name: "coaching_comment_activity",
      query: CoachingCommentRevision.find({
        clientId,
        changedAt: { $gte: start, $lt: end },
      })
        .select("_id changedAt")
        .hint("coaching_comment_revision_client_history")
        .limit(200),
    },
    {
      name: "notification_inbox",
      query: InAppNotification.find({ recipientId: clientId })
        .select("_id createdAt")
        .sort({ createdAt: -1 })
        .hint("in_app_notification_history")
        .limit(50),
    },
    {
      name: "training_schedule_range",
      query: TrainingSchedule.find({
        clientId,
        occurrenceDateKey: { $gte: startDateKey, $lte: endDateKey },
      })
        .select("_id occurrenceDateKey")
        .hint("training_schedule_client_day_range")
        .limit(200),
    },
    {
      name: "workout_plan_range",
      query: WorkoutPlan.find({
        clientId,
        status: { $in: ["published", "completed"] },
        planDate: { $gte: start, $lt: end },
      })
        .select("_id planDate")
        .hint("workout_plan_client_status_range")
        .limit(200),
    },
  ];
  const plans = [];
  for (const spec of specs) {
    plans.push(
      await explain({
        ...spec,
        maxDocuments: budgets.queryDocuments[spec.name],
      }),
    );
  }
  return plans;
};

const runLoadSmoke = async ({
  clientId,
  dateKey,
  iterations,
  budgets,
}) => {
  const durations = [];
  let maxPayloadBytes = 0;
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    const [today, progress, activity] = await Promise.all([
      getTodayDashboard({ userId: clientId, dateKey }),
      getClientProgress({ clientId, days: 90 }),
      getCoachingActivity({ clientId, days: 90 }),
    ]);
    durations.push(performance.now() - startedAt);
    maxPayloadBytes = Math.max(
      maxPayloadBytes,
      Buffer.byteLength(
        JSON.stringify({ today, progress, activity }),
        "utf8",
      ),
    );
  }
  const p95Ms = Number(percentile(durations, 0.95).toFixed(2));
  return {
    iterations,
    p95Ms,
    maxPayloadBytes,
    pass:
      p95Ms <= budgets.p95Ms &&
      maxPayloadBytes <= budgets.maxPayloadBytes,
  };
};

export const runTodayDashboardPerformanceCheck = async ({
  clientId,
  dateKey = getVietnamDateKey(),
  iterations = 3,
  budgets = TODAY_PERFORMANCE_BUDGETS,
}) => {
  if (!mongoose.isValidObjectId(clientId)) {
    throw new Error("PERFORMANCE_CLIENT_ID không hợp lệ");
  }
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 20) {
    throw new Error("iterations phải từ 1 đến 20");
  }
  const startDateKey = addDaysToDateKey(dateKey, -89);
  const queryPlans = await explainCriticalQueries({
    clientId,
    startDateKey,
    endDateKey: dateKey,
    budgets,
  });
  const load = await runLoadSmoke({
    clientId,
    dateKey,
    iterations,
    budgets,
  });
  const issues = [
    ...queryPlans
      .filter((plan) => !plan.pass)
      .map((plan) => "query_budget:" + plan.name),
    ...(load.pass ? [] : ["load_or_payload_budget"]),
  ];
  return {
    range: { startDateKey, endDateKey: dateKey },
    queryPlans,
    load,
    budgets,
    issues,
    totalIssues: issues.length,
  };
};

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const authorization = assertMigrationEnvironment({
    confirmationVariable: "CONFIRM_TODAY_DASHBOARD_PERFORMANCE_CHECK",
  });
  await connectDB();
  try {
    assertConnectedMigrationTarget(mongoose.connection, authorization);
    const result = await runTodayDashboardPerformanceCheck({
      clientId: process.env.PERFORMANCE_CLIENT_ID,
      dateKey: process.env.PERFORMANCE_DATE_KEY || getVietnamDateKey(),
      iterations: Number(process.env.PERFORMANCE_ITERATIONS || 3),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.totalIssues > 0) process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
