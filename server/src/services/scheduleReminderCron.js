import ReminderDelivery from "../models/ReminderDelivery.js";
import TrainingSchedule from "../models/TrainingSchedule.js";
import User from "../models/User.js";
import { incrementMetric } from "../observability/metrics.js";
import { getAppDayOfWeek } from "./trainingOccurrence.service.js";
import { sendScheduleReminderMail } from "../utils/sendMail.js";
import { safeLog } from "../utils/safeLogger.js";

const INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_MINUTES = 30;
const WINDOW_TOLERANCE_MINUTES = 5;
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const RETRY_DELAY_MS = 60 * 1000;
const TIME_ZONE = "Asia/Ho_Chi_Minh";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const getZonedParts = (date) => {
  const values = {};
  for (const part of dateFormatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
};

const toDateKey = (parts) =>
  [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");

const toTime = (parts) =>
  String(parts.hour).padStart(2, "0") +
  ":" +
  String(parts.minute).padStart(2, "0");

export const buildReminderWindows = (now = new Date()) => {
  const start = new Date(
    now.getTime() +
      (REMINDER_MINUTES - WINDOW_TOLERANCE_MINUTES) * 60000,
  );
  const end = new Date(
    now.getTime() +
      (REMINDER_MINUTES + WINDOW_TOLERANCE_MINUTES) * 60000,
  );
  const startParts = getZonedParts(start);
  const endParts = getZonedParts(end);
  const startDateKey = toDateKey(startParts);
  const endDateKey = toDateKey(endParts);
  if (startDateKey === endDateKey) {
    return [
      {
        dateKey: startDateKey,
        dayOfWeek: getAppDayOfWeek(startDateKey),
        startTime: toTime(startParts),
        endTime: toTime(endParts),
      },
    ];
  }
  return [
    {
      dateKey: startDateKey,
      dayOfWeek: getAppDayOfWeek(startDateKey),
      startTime: toTime(startParts),
      endTime: "23:59",
    },
    {
      dateKey: endDateKey,
      dayOfWeek: getAppDayOfWeek(endDateKey),
      startTime: "00:00",
      endTime: toTime(endParts),
    },
  ];
};

const claimDelivery = async (schedule, occurrenceKey, now) => {
  try {
    return await ReminderDelivery.findOneAndUpdate(
      {
        scheduleId: schedule._id,
        occurrenceKey,
        channel: "email",
        $or: [
          { status: "pending" },
          {
            status: "failed",
            nextAttemptAt: { $lte: now },
          },
          {
            status: "claimed",
            claimedAt: {
              $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS),
            },
          },
        ],
      },
      {
        $setOnInsert: {
          scheduleId: schedule._id,
          occurrenceKey,
          channel: "email",
        },
        $set: {
          status: "claimed",
          claimedAt: now,
          lastError: "",
        },
        $inc: { attempts: 1 },
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
};

const markSent = async (deliveryId, schedule, occurrenceKey, sentAt) => {
  await Promise.all([
    ReminderDelivery.updateOne(
      { _id: deliveryId, status: "claimed" },
      {
        $set: { status: "sent", sentAt, nextAttemptAt: null },
      },
    ),
    TrainingSchedule.updateOne(
      { _id: schedule._id, status: "scheduled" },
      {
        $set: {
          reminderSent: true,
          lastReminderOccurrenceKey: occurrenceKey,
          lastReminderSentAt: sentAt,
        },
        $unset: {
          reminderClaimedOccurrenceKey: "",
          reminderClaimedAt: "",
        },
      },
    ),
  ]);
};

const markFailed = (deliveryId, error, now) =>
  ReminderDelivery.updateOne(
    { _id: deliveryId, status: "claimed" },
    {
      $set: {
        status: "failed",
        lastError: String(error.message || error).slice(0, 500),
        nextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS),
      },
    },
  );

export async function checkAndSendReminders(now = new Date()) {
  const windowStart = new Date(
    now.getTime() +
      (REMINDER_MINUTES - WINDOW_TOLERANCE_MINUTES) * 60000,
  );
  const windowEnd = new Date(
    now.getTime() +
      (REMINDER_MINUTES + WINDOW_TOLERANCE_MINUTES) * 60000,
  );
  const schedules = await TrainingSchedule.find({
    status: "scheduled",
    isActive: true,
    startAt: { $gte: windowStart, $lte: windowEnd },
  }).lean();
  if (schedules.length === 0) return { sent: 0, failed: 0 };

  const trainerIds = [
    ...new Set(schedules.map((schedule) => String(schedule.trainerId))),
  ];
  const trainers = await User.find({ _id: { $in: trainerIds } })
    .select("_id name email role")
    .lean();
  const trainerMap = new Map(
    trainers.map((trainer) => [String(trainer._id), trainer]),
  );

  let sent = 0;
  let failed = 0;
  for (const schedule of schedules) {
    const trainer = trainerMap.get(String(schedule.trainerId));
    if (!trainer?.email) continue;
    const occurrenceKey =
      schedule.occurrenceDateKey + "|" + schedule.startTime;
    const delivery = await claimDelivery(schedule, occurrenceKey, now);
    if (!delivery) continue;

    try {
      const recipientEmail =
        trainer.role === "admin"
          ? process.env.ADMIN_REAL_EMAIL || trainer.email
          : trainer.email;
      await sendScheduleReminderMail(recipientEmail, {
        trainerName: trainer.name || "Trainer",
        clientName: schedule.clientName,
        occurrenceDateKey: schedule.occurrenceDateKey,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        exerciseType: schedule.exerciseType,
        notes: schedule.notes,
      });
      await markSent(delivery._id, schedule, occurrenceKey, new Date());
      incrementMetric("schedule.reminders_sent");
      sent += 1;
    } catch (error) {
      await markFailed(delivery._id, error, now);
      incrementMetric("schedule.reminder_failures");
      safeLog.error("schedule.reminder_failed", error, {
        scheduleId: schedule._id,
      });
      failed += 1;
    }
  }
  return { sent, failed };
}

export function startScheduleReminderCron() {
  safeLog.info("schedule.reminder_cron_started", {
    reminderMinutes: REMINDER_MINUTES,
    intervalMinutes: INTERVAL_MS / 60000,
  });
  setTimeout(checkAndSendReminders, 10000);
  setInterval(checkAndSendReminders, INTERVAL_MS);
}
