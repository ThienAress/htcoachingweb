import DailyJournal from "../models/DailyJournal.js";
import Order from "../models/Order.js";
import SavedMealPlan from "../models/SavedMealPlan.js";
import CoachingHabit from "../models/CoachingHabit.js";
import WeeklyCheckin from "../models/WeeklyCheckin.js";
import CoachingComment from "../models/CoachingComment.js";
import { isTodayPlatformEnabled } from "../config/todayPlatform.js";
import InAppNotification from "../models/InAppNotification.js";
import WellnessTarget from "../models/WellnessTarget.js";

const RETAINED_MODELS = [
  { model: DailyJournal, ownerField: "clientId" },
  { model: SavedMealPlan, ownerField: "ownerId" },
  { model: CoachingHabit, ownerField: "clientId" },
  { model: WeeklyCheckin, ownerField: "clientId" },
  { model: CoachingComment, ownerField: "clientId" },
  { model: InAppNotification, ownerField: "clientId" },
  { model: WellnessTarget, ownerField: "clientId" },
];

const updateRetainedDocuments = async ({
  clientId,
  filter,
  update,
  session,
}) => {
  const results = [];
  for (const { model, ownerField } of RETAINED_MODELS) {
    results.push(
      await model.updateMany(
        { [ownerField]: clientId, ...filter },
        update,
        session ? { session } : {},
      ),
    );
  }
  return results.reduce(
    (total, result) => total + result.modifiedCount,
    0,
  );
};

export const getDailyJournalRetentionDays = () => {
  const configured = Number(
    process.env.TODAY_JOURNAL_RETENTION_DAYS || 365,
  );
  return Number.isInteger(configured) && configured >= 30 && configured <= 3650
    ? configured
    : 365;
};

export const calculateDailyJournalRetentionDeadline = (
  coachingEndedAt,
) => {
  const endedAt = new Date(coachingEndedAt);
  if (Number.isNaN(endedAt.getTime())) return null;
  return new Date(
    endedAt.getTime() +
      getDailyJournalRetentionDays() * 24 * 60 * 60 * 1000,
  );
};

export const syncDailyJournalRetentionForClient = async ({
  clientId,
  coachingEndedAt = null,
  session = null,
}) => {
  if (!isTodayPlatformEnabled()) {
    return { updated: 0, state: "feature_disabled" };
  }

  if (!clientId) return { updated: 0, state: "missing_client" };
  let activeQuery = Order.exists({
    userId: clientId,
    status: "approved",
    sessions: { $gt: 0 },
  });
  if (session) activeQuery = activeQuery.session(session);
  const hasActiveOrder = await activeQuery;
  if (hasActiveOrder) {
    const updated = await updateRetainedDocuments({
      clientId,
      filter: { retentionExpiresAt: { $ne: null } },
      update: { $set: { retentionExpiresAt: null } },
      session,
    });
    return { updated, state: "active" };
  }
  const deadline = calculateDailyJournalRetentionDeadline(coachingEndedAt);
  if (!deadline) {
    return { updated: 0, state: "missing_end_timestamp" };
  }
  const updated = await updateRetainedDocuments({
    clientId,
    filter: { retentionExpiresAt: null },
    update: { $set: { retentionExpiresAt: deadline } },
    session,
  });
  return {
    updated,
    state: "retention_scheduled",
    retentionExpiresAt: deadline,
  };
};
