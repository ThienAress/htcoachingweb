import Checkin from "../models/Checkin.js";
import CoachingDay from "../models/CoachingDay.js";
import DailyJournal from "../models/DailyJournal.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import { toDailyJournalDto } from "./dailyJournalDto.service.js";

export const TODAY_SOURCE_DEFINITIONS = {
  schedule: {
    source: "training_schedule",
    deepLink: "/book-training",
    code: "SCHEDULE_SOURCE_UNAVAILABLE",
    message: "Không thể tải lịch tập lúc này",
  },
  coaching: {
    source: "coaching_day",
    deepLink: "/online-coaching",
    code: "COACHING_SOURCE_UNAVAILABLE",
    message: "Không thể tải coaching lúc này",
  },
  workout: {
    source: "workout_plan",
    deepLink: "/workout-plans",
    code: "WORKOUT_SOURCE_UNAVAILABLE",
    message: "Không thể tải giáo án lúc này",
  },
  attendance: {
    source: "checkin",
    deepLink: "/my-history",
    code: "ATTENDANCE_SOURCE_UNAVAILABLE",
    message: "Không thể tải lịch sử điểm danh lúc này",
  },
  journal: {
    source: "daily_journal",
    deepLink: "/today",
    code: "JOURNAL_SOURCE_UNAVAILABLE",
    message: "Không thể tải nhật ký ngày lúc này",
  },
};

const id = (value) => (value ? String(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);

const hasDayPayload = (name) =>
  name === "coaching" || name === "journal";

export const emptyTodaySection = (name) => ({
  status: "empty",
  source: TODAY_SOURCE_DEFINITIONS[name].source,
  ...(hasDayPayload(name) ? { day: null } : { items: [] }),
  deepLink: TODAY_SOURCE_DEFINITIONS[name].deepLink,
  error: null,
});

export const getEmptyTodaySections = () =>
  Object.fromEntries(
    Object.keys(TODAY_SOURCE_DEFINITIONS).map((name) => [
      name,
      emptyTodaySection(name),
    ]),
  );

const loadSchedule = async ({ userId, dateKey, range }) => {
  const documents = await TrainingSchedule.find({
    clientId: userId,
    status: { $in: ["scheduled", "completed"] },
    $or: [
      { occurrenceDateKey: dateKey },
      {
        occurrenceDateKey: { $in: [null, ""] },
        startAt: { $gte: range.start, $lt: range.end },
      },
    ],
  })
    .select(
      "_id occurrenceDateKey startAt endAt startTime endTime exerciseType notes status",
    )
    .sort({ startAt: 1, startTime: 1 })
    .limit(100)
    .lean();
  return documents.map((item) => ({
    _id: id(item._id),
    occurrenceDateKey: item.occurrenceDateKey || dateKey,
    startAt: iso(item.startAt),
    endAt: iso(item.endAt),
    startTime: item.startTime,
    endTime: item.endTime,
    exerciseType: item.exerciseType,
    notes: item.notes || "",
    status: item.status,
  }));
};

const loadCoaching = async ({ userId, dateKey }) => {
  const day = await CoachingDay.findOne({ userId, dateString: dateKey })
    .select(
      "_id title note clientStatus exercises.name exercises.sets exercises.reps exercises.weight exercises.completed",
    )
    .lean();
  if (!day) return null;
  return {
    _id: id(day._id),
    title: day.title,
    note: day.note || "",
    clientStatus: day.clientStatus,
    exercises: (day.exercises || []).map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      weight: exercise.weight,
      completed: Boolean(exercise.completed),
    })),
  };
};

const loadWorkout = async ({ userId, email, range }) => {
  const documents = await WorkoutPlan.find({
    status: { $in: ["published", "completed"] },
    planDate: { $gte: range.start, $lt: range.end },
    $or: [{ clientId: userId }, { clientId: null, clientEmail: email }],
  })
    .select("_id title planDate status sections.name sections.exercises.name")
    .sort({ planDate: 1, createdAt: 1 })
    .limit(100)
    .lean();
  return documents.map((plan) => ({
    _id: id(plan._id),
    title: plan.title,
    planDate: iso(plan.planDate),
    status: plan.status,
    sectionCount: (plan.sections || []).length,
    exerciseCount: (plan.sections || []).reduce(
      (total, section) => total + (section.exercises || []).length,
      0,
    ),
    deepLink: "/workout-plans/" + id(plan._id),
  }));
};

const loadAttendance = async ({ orderIds, range }) => {
  if (orderIds.length === 0) return [];
  const documents = await Checkin.find({
    orderId: { $in: orderIds },
    time: { $gte: range.start, $lt: range.end },
  })
    .select("_id orderId time muscle remainingSessions")
    .sort({ time: 1 })
    .limit(100)
    .lean();
  return documents.map((item) => ({
    _id: id(item._id),
    orderId: id(item.orderId),
    time: iso(item.time),
    muscle: item.muscle,
    remainingSessions: item.remainingSessions,
  }));
};

const loadJournal = async ({ userId, dateKey, actorScope = "client" }) =>
  toDailyJournalDto(
    await DailyJournal.findOne({ clientId: userId, dateKey }).lean(),
    { includePrivate: actorScope !== "trainer" },
  );

export const loadTodaySources = ({
  userId,
  dateKey,
  email,
  orderIds,
  range,
  actorScope = "client",
}) => ({
  schedule: loadSchedule({ userId, dateKey, range }),
  coaching: loadCoaching({ userId, dateKey }),
  workout: loadWorkout({ userId, email, range }),
  attendance: loadAttendance({ orderIds, range }),
  journal: loadJournal({ userId, dateKey, actorScope }),
});

export const readyTodaySection = (name, value) => ({
  status:
    value && (Array.isArray(value) ? value.length > 0 : true)
      ? "ready"
      : "empty",
  source: TODAY_SOURCE_DEFINITIONS[name].source,
  ...(hasDayPayload(name) ? { day: value } : { items: value }),
  deepLink: TODAY_SOURCE_DEFINITIONS[name].deepLink,
  error: null,
});

export const errorTodaySection = (name) => {
  const definition = TODAY_SOURCE_DEFINITIONS[name];
  return {
    ...emptyTodaySection(name),
    status: "error",
    error: { code: definition.code, message: definition.message },
  };
};
