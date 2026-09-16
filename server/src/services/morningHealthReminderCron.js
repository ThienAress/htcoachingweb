import { createHash } from "node:crypto";

import { getMorningHealthReminderMode } from "../config/backgroundJobs.js";
import DailyJournal from "../models/DailyJournal.js";
import MorningHealthReminderDelivery from "../models/MorningHealthReminderDelivery.js";
import NotificationPreference from "../models/NotificationPreference.js";
import User from "../models/User.js";
import { createRecurringJob } from "../operations/recurringJob.js";
import { resolveEffectiveCoachRecipients } from "./effectiveCoachRecipients.service.js";
import { safeLog } from "../utils/safeLogger.js";
import { sendMorningHealthReminderMail } from "../utils/sendMail.js";

const TIME_ZONE = "Asia/Ho_Chi_Minh";
const INTERVAL_MS = 10 * 60 * 1000;
const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;
const RETRY_DELAY_MS = 5 * 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const getVietnamDateTime = (date) => {
  const values = {};
  for (const part of dateFormatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
};

const isReminderWindow = ({ hour }) => hour === 7 || hour === 8;

const isEnabled = (env) => getMorningHealthReminderMode(env).enabled;

const reportTick = (result) => {
  safeLog.info("morning_health_reminder.tick", result);
  return result;
};

export const buildMorningHealthDeliveryKey = (recipientId, dateKey) =>
  createHash("sha256")
    .update(`morning-health:${String(recipientId)}:${dateKey}`)
    .digest("hex");

const countSkipReasons = (excluded) =>
  [...excluded.values()].reduce(
    (counts, reason) => ({ ...counts, [reason]: (counts[reason] || 0) + 1 }),
    {},
  );

const loadEligibleRecipients = async (dateKey, env) => {
  const preferences = await NotificationPreference.find({
    morningHealthEmail: true,
  })
    .select("recipientId")
    .lean();
  const recipientIds = preferences.map((item) => item.recipientId);
  if (recipientIds.length === 0) {
    return { recipients: [], suppressed: 0 };
  }

  const [users, submittedJournals] = await Promise.all([
    User.find({
      _id: { $in: recipientIds },
      role: "user",
      email: { $type: "string", $ne: "" },
    })
      .select("_id name email")
      .lean(),
    DailyJournal.find({
      clientId: { $in: recipientIds },
      dateKey,
      status: "submitted",
    })
      .select("clientId")
      .lean(),
  ]);

  const { eligibleRecipientIds, excluded } =
    await resolveEffectiveCoachRecipients({
      recipientIds: users.map((user) => user._id),
      env,
    });
  const submittedUserIds = new Set(
    submittedJournals.map((journal) => String(journal.clientId)),
  );
  const activeUsers = users.filter((user) =>
    eligibleRecipientIds.has(String(user._id)),
  );
  return {
    recipients: activeUsers.filter(
      (user) => !submittedUserIds.has(String(user._id)),
    ),
    suppressed: activeUsers.filter((user) =>
      submittedUserIds.has(String(user._id)),
    ).length,
    skipReasons: countSkipReasons(excluded),
  };
};

const claimDelivery = async ({ recipientId, dateKey, now }) => {
  const deliveryKey = buildMorningHealthDeliveryKey(recipientId, dateKey);
  try {
    return await MorningHealthReminderDelivery.findOneAndUpdate(
      {
        _id: deliveryKey,
        $or: [
          { status: "pending" },
          { status: "failed", nextAttemptAt: { $lte: now } },
          {
            status: "claimed",
            claimedAt: {
              $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS),
            },
          },
        ],
      },
      {
        $setOnInsert: { recipientId, dateKey },
        $set: {
          status: "claimed",
          claimedAt: now,
          lastErrorCode: "",
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

const markSent = (deliveryId, sentAt) =>
  MorningHealthReminderDelivery.updateOne(
    { _id: deliveryId, status: "claimed" },
    {
      $set: {
        status: "sent",
        sentAt,
        nextAttemptAt: null,
        lastErrorCode: "",
      },
    },
  );

const safeErrorCode = (error) => {
  const code = String(error?.code || "EMAIL_PROVIDER_FAILED").toUpperCase();
  return /^[A-Z0-9_]{1,80}$/.test(code) ? code : "EMAIL_PROVIDER_FAILED";
};

const markFailed = (deliveryId, error, now) =>
  MorningHealthReminderDelivery.updateOne(
    { _id: deliveryId, status: "claimed" },
    {
      $set: {
        status: "failed",
        lastErrorCode: safeErrorCode(error),
        nextAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS),
      },
    },
  );

export async function checkAndSendMorningHealthReminders(
  now = new Date(),
  env = process.env,
) {
  if (!isEnabled(env)) {
    return reportTick({
      eligible: 0,
      suppressed: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      alreadyHandled: 0,
      skipReasons: {},
      skipped: "disabled",
    });
  }
  const vietnamNow = getVietnamDateTime(now);
  if (!isReminderWindow(vietnamNow)) {
    return reportTick({
      dateKey: vietnamNow.dateKey,
      eligible: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
      alreadyHandled: 0,
      skipReasons: {},
      skipped: "outside_window",
    });
  }

  const { recipients, suppressed, skipReasons } = await loadEligibleRecipients(
    vietnamNow.dateKey,
    env,
  );
  let sent = 0;
  let failed = 0;
  let claimed = 0;
  let alreadyHandled = 0;
  for (const recipient of recipients) {
    const delivery = await claimDelivery({
      recipientId: recipient._id,
      dateKey: vietnamNow.dateKey,
      now,
    });
    if (!delivery) {
      alreadyHandled += 1;
      continue;
    }
    claimed += 1;

    try {
      await sendMorningHealthReminderMail(recipient.email, {
        name: recipient.name || "bạn",
        dateKey: vietnamNow.dateKey,
        deliveryKey: delivery._id,
      });
      await markSent(delivery._id, new Date());
      sent += 1;
    } catch (error) {
      await markFailed(delivery._id, error, now);
      safeLog.error("morning_health_reminder.delivery_failed", error, {
        dateKey: vietnamNow.dateKey,
      });
      failed += 1;
    }
  }
  const result = {
    dateKey: vietnamNow.dateKey,
    eligible: recipients.length,
    suppressed,
    claimed,
    sent,
    failed,
    alreadyHandled,
    skipReasons,
  };
  return reportTick(result);
}

const morningHealthReminderCron = createRecurringJob({
  name: "morning_health_reminder.cron",
  intervalMs: INTERVAL_MS,
  initialDelayMs: 20_000,
  task: checkAndSendMorningHealthReminders,
});

export const startMorningHealthReminderCron = () => {
  safeLog.info("morning_health_reminder.cron_started", {
    intervalMinutes: INTERVAL_MS / 60_000,
    timeZone: TIME_ZONE,
  });
  return morningHealthReminderCron.start();
};

export const stopMorningHealthReminderCron = () =>
  morningHealthReminderCron.stop();
